-- One pilot organization. Verified Needle evidence precedes every new person.
-- Additive: existing people without a resume remain editable and visible.
begin;

create or replace function public.needle_pilot_organization_id()
returns uuid language sql immutable set search_path=public,pg_temp as $$
  select '00000000-0000-4000-8000-0000000000a1'::uuid
$$;
revoke all on function public.needle_pilot_organization_id() from public,anon;
grant execute on function public.needle_pilot_organization_id() to authenticated,service_role;

create table public.needle_resume_registry (
  organization_id uuid not null references public.organizations(id),
  resume_id text not null check (resume_id ~ '^[a-f0-9]{64}$'),
  filename text not null,
  status text not null check (status in ('pending','ready','failed')),
  engine_version text,
  facts_revision text,
  original_available boolean not null default false,
  verified_at timestamptz not null default now(),
  primary key (organization_id,resume_id)
);
create table public.needle_resume_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  resume_id text not null,
  actor_id uuid not null references public.profiles(id),
  stage_id text,
  source text not null check (source in ('needle_search','holmes_upload')),
  engine_version text,
  facts_revision text,
  created_at timestamptz not null default now(),
  foreign key (organization_id,resume_id) references public.needle_resume_registry(organization_id,resume_id)
);
alter table public.needle_resume_registry enable row level security;
alter table public.needle_resume_evidence enable row level security;
revoke all on public.needle_resume_registry,public.needle_resume_evidence from anon,authenticated;
grant all on public.needle_resume_registry,public.needle_resume_evidence to service_role;
grant select on public.needle_resume_registry to authenticated;
create policy needle_resume_registry_reader on public.needle_resume_registry
for select to authenticated using (
  organization_id=public.needle_pilot_organization_id()
  and public.has_permission(auth.uid(),'view_prospects')
);

alter table public.prospects
  add column needle_resume_id text,
  add column resume_evidence_id uuid references public.needle_resume_evidence(id),
  add column resume_source text,
  add constraint prospects_resume_registry_fk foreign key (organization_id,needle_resume_id)
    references public.needle_resume_registry(organization_id,resume_id),
  alter column dob drop not null,
  alter column nationality_id drop not null,
  alter column rank_applied_for_id drop not null,
  alter column vessel_type_id drop not null,
  alter column exp_in_rank_months drop not null,
  alter column telephone drop not null,
  alter column email drop not null,
  drop constraint if exists prospects_previous_employer_check;

create table public.prospect_resumes (
  organization_id uuid not null,
  resume_id text not null,
  prospect_id uuid not null references public.prospects(id),
  evidence_id uuid not null references public.needle_resume_evidence(id),
  source text not null,
  stage_id text,
  engine_version text,
  facts_revision text,
  linked_by uuid not null references public.profiles(id),
  linked_at timestamptz not null default now(),
  primary key (organization_id,resume_id),
  foreign key (organization_id,resume_id) references public.needle_resume_registry(organization_id,resume_id)
);
create index prospect_resumes_person_idx on public.prospect_resumes(prospect_id,linked_at desc);
alter table public.prospect_resumes enable row level security;
revoke all on public.prospect_resumes from anon,authenticated;
grant select on public.prospect_resumes to authenticated;
grant all on public.prospect_resumes to service_role;
create policy prospect_resumes_reader on public.prospect_resumes
for select to authenticated using (
  organization_id=public.needle_pilot_organization_id()
  and public.has_permission(auth.uid(),'view_prospects')
);

create or replace function public.prospect_contact_complete(p public.prospects)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select nullif(trim(p.telephone),'') is not null and nullif(trim(p.email),'') is not null
    and p.dob is not null and p.nationality_id is not null
$$;
revoke all on function public.prospect_contact_complete(public.prospects) from public,anon;
grant execute on function public.prospect_contact_complete(public.prospects) to authenticated,service_role;

create or replace function public.guard_prospect_entry_and_contacts()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare evidence public.needle_resume_evidence; core_changed boolean;
begin
  if new.organization_id is distinct from public.needle_pilot_organization_id() then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if tg_op='UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization_cannot_be_changed' using errcode='42501';
  end if;
  new.name:=nullif(trim(new.name),'');
  new.email:=nullif(lower(trim(new.email)),'');
  new.telephone:=nullif(trim(new.telephone),'');
  if new.name is null then raise exception 'candidate_name_required' using errcode='23514'; end if;
  if new.email is null and new.telephone is null then
    raise exception 'phone_or_email_required' using errcode='23514';
  end if;
  if new.email is not null and (length(new.email)>320 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'valid_email_required' using errcode='23514';
  end if;
  if tg_op='INSERT' then
    if new.needle_resume_id is null or new.resume_evidence_id is null then
      raise exception 'verified_resume_required' using errcode='23514';
    end if;
  end if;
  if tg_op='INSERT' or new.needle_resume_id is distinct from old.needle_resume_id
     or new.resume_evidence_id is distinct from old.resume_evidence_id then
    if new.needle_resume_id is not null then
      select * into evidence from public.needle_resume_evidence
      where id=new.resume_evidence_id and resume_id=new.needle_resume_id
        and organization_id=new.organization_id and actor_id=auth.uid();
      if not found or not exists(select 1 from public.needle_resume_registry r
        where r.organization_id=new.organization_id and r.resume_id=new.needle_resume_id and r.original_available) then
        raise exception 'verified_resume_required' using errcode='23514';
      end if;
      if exists(select 1 from public.prospect_resumes r where r.organization_id=new.organization_id
        and r.resume_id=new.needle_resume_id and r.prospect_id<>new.id) then
        raise exception 'resume_already_linked' using errcode='23505';
      end if;
      new.resume_source:=evidence.source;
    elsif tg_op='UPDATE' and old.needle_resume_id is not null then
      raise exception 'resume_cannot_be_removed' using errcode='23514';
    end if;
  end if;
  core_changed:=tg_op='INSERT';
  if tg_op='UPDATE' then
    core_changed:=(new.dob,new.nationality_id,new.telephone,new.email)
      is distinct from (old.dob,old.nationality_id,old.telephone,old.email);
  end if;
  if (new.status='approved' and (tg_op='INSERT' or new.status is distinct from old.status or core_changed))
    or (core_changed and exists(select 1 from public.recruitment_cases c where c.prospect_id=new.id
      and c.status not in ('sourced','contacted','legacy','closed','rejected','withdrawn'))) then
    if not public.prospect_contact_complete(new) then
      raise exception 'complete_phone_email_dob_nationality_before_progressing' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_prospect_entry_and_contacts() from public,anon,authenticated;
create trigger prospects_resume_entry_guard before insert or update on public.prospects
for each row execute function public.guard_prospect_entry_and_contacts();

create or replace function public.link_prospect_primary_resume()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.needle_resume_id is not null then
    insert into public.prospect_resumes(organization_id,resume_id,prospect_id,evidence_id,source,stage_id,engine_version,facts_revision,linked_by)
    select e.organization_id,e.resume_id,new.id,e.id,e.source,e.stage_id,e.engine_version,e.facts_revision,e.actor_id
    from public.needle_resume_evidence e where e.id=new.resume_evidence_id
    on conflict (organization_id,resume_id) do nothing;
    if not exists(select 1 from public.prospect_resumes r where r.organization_id=new.organization_id
      and r.resume_id=new.needle_resume_id and r.prospect_id=new.id) then
      raise exception 'resume_already_linked' using errcode='23505';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.link_prospect_primary_resume() from public,anon,authenticated;
create trigger prospects_link_primary_resume after insert or update of needle_resume_id,resume_evidence_id
on public.prospects for each row execute function public.link_prospect_primary_resume();

create or replace function public.guard_case_contact_completion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.prospects;
begin
  if new.status not in ('sourced','contacted','legacy','closed','rejected','withdrawn')
    and (tg_op='INSERT' or new.status is distinct from old.status) then
    select * into p from public.prospects where id=new.prospect_id;
    if not public.prospect_contact_complete(p) then
      raise exception 'complete_phone_email_dob_nationality_before_progressing' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_case_contact_completion() from public,anon,authenticated;
create trigger recruitment_cases_contact_guard before insert or update of status on public.recruitment_cases
for each row execute function public.guard_case_contact_completion();

-- Matching is an editor-only, pilot-org scoped preview, never an automatic merge.
create or replace function public.find_resume_candidate_matches(
  p_resume_id text,p_email text default null,p_telephone text default null,
  p_name text default null,p_dob date default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare matches jsonb;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects')
    or not public.has_permission(auth.uid(),'view_prospects') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'telephone',p.telephone,
    'reason',case when r.resume_id is not null then 'resume' when p.email_normalized=nullif(lower(trim(p_email)),'') then 'email' else 'possible_identity' end)),'[]'::jsonb)
  into matches from public.prospects p left join public.prospect_resumes r
    on r.prospect_id=p.id and r.organization_id=p.organization_id and r.resume_id=p_resume_id
  where p.organization_id=public.needle_pilot_organization_id() and p.deleted_at is null and p.archived_at is null
    and (r.resume_id is not null or p.email_normalized=nullif(lower(trim(p_email)),'')
      or p.telephone=nullif(trim(p_telephone),'')
      or (p_dob is not null and p.dob=p_dob and lower(trim(p.name))=lower(trim(p_name))));
  return matches;
end $$;
revoke all on function public.find_resume_candidate_matches(text,text,text,text,date) from public,anon;
grant execute on function public.find_resume_candidate_matches(text,text,text,text,date) to authenticated;

-- One transaction owns candidate, provenance, optional note and case creation.
create or replace function public.save_resume_candidate(
  p_evidence_id uuid,p_fields jsonb default '{}'::jsonb,p_requirement_id uuid default null,
  p_link_to uuid default null,p_confirm_new boolean default false,
  p_expected_requirement_version integer default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); e public.needle_resume_evidence; p public.prospects;
  req public.requirements; c public.recruitment_cases; existing uuid; matches jsonb;
  email_text text:=nullif(lower(trim(p_fields->>'email')),''); phone_text text:=nullif(trim(p_fields->>'telephone'),'');
  created boolean:=false; created_by uuid;
begin
  if actor is null or not public.has_permission(actor,'create_prospects')
    or not public.has_permission(actor,'view_prospects') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if p_requirement_id is not null and not public.has_permission(actor,'edit_junction_status') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select * into e from public.needle_resume_evidence where id=p_evidence_id and actor_id=actor
    and organization_id=public.needle_pilot_organization_id();
  if not found then raise exception 'verified_resume_required' using errcode='23514'; end if;
  -- Serialize concurrent adds of the same file; unique indexes remain the final guard.
  perform pg_advisory_xact_lock(hashtextextended(e.organization_id::text||':'||e.resume_id,0));
  if p_requirement_id is not null then
    select * into req from public.requirements where id=p_requirement_id for update;
    if not found or req.deleted_at is not null or req.archived_at is not null or req.status<>'open' then
      raise exception 'open_requirement_required' using errcode='22023';
    end if;
    if p_expected_requirement_version is not null and req.version<>p_expected_requirement_version then
      raise exception 'version_conflict' using errcode='40001';
    end if;
    if exists(select 1 from public.recruitment_cases rc where rc.requirement_id=req.id and rc.organization_id<>e.organization_id) then
      raise exception 'permission_denied' using errcode='42501';
    end if;
  end if;
  select prospect_id into existing from public.prospect_resumes where organization_id=e.organization_id and resume_id=e.resume_id;
  if existing is not null then
    if p_link_to is not null and p_link_to<>existing then raise exception 'resume_already_linked' using errcode='23505'; end if;
    select * into p from public.prospects where id=existing and deleted_at is null and archived_at is null;
    if not found then raise exception 'linked_candidate_requires_restore' using errcode='22023'; end if;
  elsif p_link_to is not null then
    if not public.has_permission(actor,'edit_prospects') then raise exception 'permission_denied' using errcode='42501'; end if;
    select * into p from public.prospects where id=p_link_to and organization_id=e.organization_id
      and deleted_at is null and archived_at is null for update;
    if not found then raise exception 'candidate_not_found' using errcode='P0002'; end if;
    -- Linking retains the existing person's fields; it never overwrites them from OCR.
    insert into public.prospect_resumes(organization_id,resume_id,prospect_id,evidence_id,source,stage_id,engine_version,facts_revision,linked_by)
    values(e.organization_id,e.resume_id,p.id,e.id,e.source,e.stage_id,e.engine_version,e.facts_revision,actor);
    if p.needle_resume_id is null then
      update public.prospects set needle_resume_id=e.resume_id,resume_evidence_id=e.id where id=p.id returning * into p;
    end if;
  else
    -- All identity locks have a stable order across different resume hashes.
    -- Email has a unique index too; phone/name matches require explicit review.
    perform pg_advisory_xact_lock(hashtextextended('contact:'||e.organization_id::text||':'||value,0))
    from unnest(array['email:'||email_text,'phone:'||phone_text,
      'person:'||lower(trim(p_fields->>'name'))||':'||(p_fields->>'dob')]) value
    where value is not null order by value;
    matches:=public.find_resume_candidate_matches(e.resume_id,email_text,phone_text,p_fields->>'name',nullif(p_fields->>'dob','')::date);
    if exists(select 1 from jsonb_array_elements(matches) m where m->>'reason' in ('email','resume')) then
      raise exception 'existing_candidate_requires_explicit_link' using errcode='23505';
    end if;
    if jsonb_array_length(matches)>0 and not p_confirm_new then
      raise exception 'possible_duplicate_requires_review' using errcode='23505';
    end if;
    created_by:=coalesce(nullif(p_fields->>'added_by','')::uuid,actor);
    if created_by<>actor and not public.is_master_recruiter_profile(actor) then
      raise exception 'permission_denied' using errcode='42501';
    end if;
    insert into public.prospects(organization_id,name,dob,nationality_id,rank_applied_for_id,vessel_type_id,
      exp_in_rank_months,previous_employer,is_first_time_at_sea,telephone,email,lead_source,status,
      first_contacted_at,created_by_recruiter_id,needle_resume_id,resume_evidence_id)
    values(e.organization_id,p_fields->>'name',nullif(p_fields->>'dob','')::date,
      nullif(p_fields->>'nationality_id','')::uuid,nullif(p_fields->>'rank_id','')::uuid,
      nullif(p_fields->>'vessel_type_id','')::uuid,
      nullif(p_fields->>'exp_in_rank_months','')::integer,nullif(trim(p_fields->>'previous_employer'),''),
      coalesce((p_fields->>'first_time_at_sea')::boolean,false),phone_text,email_text,coalesce(nullif(trim(p_fields->>'lead_source'),''),e.source),
      case when nullif(p_fields->>'contacted_at','') is null then 'open' else 'contacted' end,
      nullif(p_fields->>'contacted_at','')::timestamptz,created_by,e.resume_id,e.id) returning * into p;
    created:=true;
    if nullif(trim(p_fields->>'notes'),'') is not null then
      perform public.add_prospect_note(p.id,trim(p_fields->>'notes'),'internal');
    end if;
  end if;
  if p_requirement_id is not null then
    c:=public.recruitment_case_open(p.id,p_requirement_id,case when e.source='needle_search' then 'needle' else 'recruiter' end,'needle:'||e.id::text||':'||p_requirement_id::text);
  end if;
  return jsonb_build_object('prospect_id',p.id,'created',created,'linked',not created,'resume_id',e.resume_id,'case_id',c.id);
end $$;
revoke all on function public.save_resume_candidate(uuid,jsonb,uuid,uuid,boolean,integer) from public,anon;
grant execute on function public.save_resume_candidate(uuid,jsonb,uuid,uuid,boolean,integer) to authenticated;

-- The retired entry RPC cannot bypass the new resume requirement.
create or replace function public.create_prospect_with_requirement(
  p_requirement_id uuid,p_name text,p_dob date,p_exp_in_rank_months integer,
  p_previous_employer text default null,p_is_first_time_at_sea boolean default false,
  p_telephone text default null,p_email text default null,p_nationality_id uuid default null,
  p_lead_source text default null,p_correlation_id uuid default null
)
returns table(prospect_id uuid,prospect_requirement_id uuid,requirement_id uuid,req_id_display text,
  prospect_status text,junction_status text,should_prompt_close_requirement boolean,correlation_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  raise exception 'verified_resume_required_use_save_resume_candidate' using errcode='23514';
end $$;
revoke all on function public.create_prospect_with_requirement(uuid,text,date,integer,text,boolean,text,text,uuid,text,uuid) from public,anon;
grant execute on function public.create_prospect_with_requirement(uuid,text,date,integer,text,boolean,text,text,uuid,text,uuid) to authenticated;

create or replace function public.update_resume_candidate_contacts(
  p_id uuid,p_expected_version integer,p_fields jsonb
)
returns public.prospects language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.prospects;
begin
  if auth.uid() is null or not public.has_permission(auth.uid(),'edit_prospects') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select * into p from public.prospects where id=p_id
    and organization_id=public.needle_pilot_organization_id()
    and deleted_at is null and archived_at is null for update;
  if not found then raise exception 'candidate_not_found' using errcode='P0002'; end if;
  if p_expected_version is null or p.version<>p_expected_version then
    raise exception 'version_conflict' using errcode='40001';
  end if;
  update public.prospects set name=p_fields->>'name',dob=nullif(p_fields->>'dob','')::date,
    nationality_id=nullif(p_fields->>'nationality_id','')::uuid,
    email=nullif(trim(p_fields->>'email'),''),telephone=nullif(trim(p_fields->>'telephone'),''),
    version=version+1 where id=p_id returning * into p;
  return p;
end $$;
revoke all on function public.update_resume_candidate_contacts(uuid,integer,jsonb) from public,anon;
grant execute on function public.update_resume_candidate_contacts(uuid,integer,jsonb) to authenticated;

commit;
