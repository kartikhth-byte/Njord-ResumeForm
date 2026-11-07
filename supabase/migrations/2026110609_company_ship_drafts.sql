-- Platform company/ship identities are reviewed explicitly, never inferred from
-- legacy display strings. Legacy rows remain visible until mapped by a recruiter.
begin;
create table public.client_companies (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null default public.needle_pilot_organization_id(),
 name text not null check(length(trim(name)) between 1 and 200),
 created_by uuid not null default auth.uid(),created_at timestamptz not null default now(),
 archived_at timestamptz,unique(organization_id,id)
);
create table public.client_ships (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null default public.needle_pilot_organization_id(),
 company_id uuid not null,name text not null check(length(trim(name)) between 1 and 200),
 imo text check(imo is null or imo ~ '^[0-9]{7}$'),
 created_by uuid not null default auth.uid(),created_at timestamptz not null default now(),archived_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,company_id) references public.client_companies(organization_id,id)
);
create unique index client_ship_imo_unique on public.client_ships(organization_id,imo) where imo is not null;
create table public.requirement_location_audit (
 id uuid primary key default gen_random_uuid(),requirement_id uuid not null references public.requirements(id),
 actor_id uuid not null,old_company_id uuid,old_ship_id uuid,new_company_id uuid,new_ship_id uuid,
 reason text not null,created_at timestamptz not null default now()
);
alter table public.client_companies enable row level security;
alter table public.client_ships enable row level security;
alter table public.requirement_location_audit enable row level security;
grant select,insert,update on public.client_companies,public.client_ships to authenticated;
grant select on public.requirement_location_audit to authenticated;
grant all on public.client_companies,public.client_ships,public.requirement_location_audit to service_role;
create policy client_companies_read on public.client_companies for select to authenticated
 using(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'view_requirements'));
create policy client_companies_write on public.client_companies for all to authenticated
 using(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'edit_requirements'))
 with check(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'edit_requirements'));
create policy client_ships_read on public.client_ships for select to authenticated
 using(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'view_requirements'));
create policy client_ships_write on public.client_ships for all to authenticated
 using(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'edit_requirements'))
 with check(organization_id=public.needle_pilot_organization_id() and public.has_permission(auth.uid(),'edit_requirements'));
create policy requirement_location_audit_read on public.requirement_location_audit for select to authenticated
 using(public.has_permission(auth.uid(),'view_requirements'));
revoke all on public.client_companies,public.client_ships,public.requirement_location_audit from anon;
alter table public.requirements add column company_id uuid references public.client_companies(id),
 add column ship_id uuid references public.client_ships(id),add column location_reviewed_at timestamptz;
alter table public.requirements drop constraint requirements_status_check;
alter table public.requirements add constraint requirements_status_check check(status in ('draft','open','closed','cancelled'));
alter table public.requirements alter column rank_id drop not null,alter column vessel_type_id drop not null,
 alter column positions_required drop not null,alter column target_days drop not null;
alter table public.requirements add constraint requirement_open_fields check(status='draft' or
 (rank_id is not null and vessel_type_id is not null and positions_required is not null and target_days is not null and positions_required>=1 and target_days>=1));

create or replace function public.guard_requirement_location()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare ship public.client_ships; company public.client_companies; changed boolean;
begin
 changed:=tg_op='INSERT';
 if tg_op='UPDATE' then changed:=new.company_id is distinct from old.company_id or new.ship_id is distinct from old.ship_id; end if;
 if new.company_id is not null then
  select * into company from public.client_companies where id=new.company_id and organization_id=public.needle_pilot_organization_id() and archived_at is null for share;
  if not found then raise exception 'reviewed_company_required' using errcode='22023'; end if;
  new.customer_name:=company.name;
 end if;
 if new.ship_id is not null then
  select * into ship from public.client_ships where id=new.ship_id and organization_id=public.needle_pilot_organization_id() and archived_at is null for share;
  if not found or ship.company_id is distinct from new.company_id then raise exception 'ship_company_mismatch' using errcode='22023'; end if;
  new.vessel_name:=ship.name;
 end if;
 if tg_op='UPDATE' and old.status<>'draft' and changed then
  if coalesce(current_setting('holmes.location_correction',true),'')<>new.id::text then
   raise exception 'audited_ship_correction_required' using errcode='42501';
  end if;
 end if;
 if changed then
  new.location_reviewed_at:=case when new.ship_id is not null and new.company_id is not null then now() else null end;
 elsif tg_op='UPDATE' then new.location_reviewed_at:=old.location_reviewed_at;
 end if;
 if new.status='open' and (tg_op='INSERT' or changed or (tg_op='UPDATE' and old.status<>'open')) then
  if new.ship_id is null or new.company_id is null or new.location_reviewed_at is null then
   raise exception 'reviewed_ship_required_to_open' using errcode='22023';
  end if;
 end if;
 return new;
end $$;
create trigger requirement_location_guard before insert or update on public.requirements
for each row execute function public.guard_requirement_location();
revoke all on function public.guard_requirement_location() from public,anon,authenticated;

create or replace function public.correct_requirement_location(p_id uuid,p_company_id uuid,p_ship_id uuid,p_reason text,p_expected_version integer)
returns public.requirements language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.requirements; old_company uuid;old_ship uuid;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'edit_requirements') then raise exception 'permission_denied' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'correction_reason_required' using errcode='22023'; end if;
 select * into r from public.requirements where id=p_id and deleted_at is null and archived_at is null for update;
 if not found then raise exception 'requirement_not_found'; end if;
 if p_expected_version is null or r.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001'; end if;
 old_company:=r.company_id;old_ship:=r.ship_id;
 perform set_config('holmes.location_correction',r.id::text,true);
 update public.requirements set company_id=p_company_id,ship_id=p_ship_id where id=p_id returning * into r;
 perform set_config('holmes.location_correction','',true);
 insert into public.requirement_location_audit(requirement_id,actor_id,old_company_id,old_ship_id,new_company_id,new_ship_id,reason)
 values(r.id,auth.uid(),old_company,old_ship,r.company_id,r.ship_id,trim(p_reason));
 return r;
end $$;
revoke all on function public.correct_requirement_location(uuid,uuid,uuid,text,integer) from public,anon;
grant execute on function public.correct_requirement_location(uuid,uuid,uuid,text,integer) to authenticated;

-- Keep the previous case-opening authorization/idempotency implementation as
-- an owner-only helper. The public wrapper adds lifecycle and identity checks.
alter function public.recruitment_case_open(uuid,uuid,text,text) rename to recruitment_case_open_before_platform;
revoke all on function public.recruitment_case_open_before_platform(uuid,uuid,text,text) from public,anon,authenticated;
create function public.recruitment_case_open(p_prospect_id uuid,p_requirement_id uuid,p_source text default 'recruiter',p_idempotency_key text default null)
returns public.recruitment_cases language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'edit_junction_status') then raise exception 'permission_denied' using errcode='42501'; end if;
 perform 1 from public.requirements r join public.client_ships s on s.id=r.ship_id and s.company_id=r.company_id
 join public.client_companies c on c.id=r.company_id
 where r.id=p_requirement_id and r.status='open' and r.archived_at is null and r.deleted_at is null
 and r.location_reviewed_at is not null and s.archived_at is null and c.archived_at is null
 and s.organization_id=public.needle_pilot_organization_id() and c.organization_id=s.organization_id for share of r,s,c;
 if not found then raise exception 'requirement_not_open' using errcode='22023'; end if;
 perform 1 from public.prospects where id=p_prospect_id and organization_id=public.needle_pilot_organization_id() and archived_at is null and deleted_at is null;
 if not found then raise exception 'candidate_not_found' using errcode='42501'; end if;
 return public.recruitment_case_open_before_platform(p_prospect_id,p_requirement_id,p_source,p_idempotency_key);
end $$;
revoke all on function public.recruitment_case_open(uuid,uuid,text,text) from public,anon;
grant execute on function public.recruitment_case_open(uuid,uuid,text,text) to authenticated;
create or replace function public.prepare_requirement_row()
returns trigger
language plpgsql
as $function$
declare
  generated_sequence integer;
  generated_display text;
  expected_display text;
  normalized_year_month text;
begin
  if tg_op = 'INSERT' then
    new.req_year_month := coalesce(nullif(btrim(new.req_year_month), ''), to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'));
    new.date_opened := coalesce(new.date_opened, timezone('Asia/Kolkata', now())::date);
    new.status := coalesce(nullif(btrim(new.status), ''), 'open');

    if new.status not in ('draft','open') then
      raise exception 'Requirements must start as draft or open';
    end if;

    if new.req_sequence is null and (new.req_id_display is null or btrim(new.req_id_display) = '') then
      select req_sequence, req_id_display
      into generated_sequence, generated_display
      from public.allocate_requirement_identifier(new.req_year_month);

      new.req_sequence := generated_sequence;
      new.req_id_display := generated_display;
    elsif new.req_sequence is not null then
      expected_display := public.build_requirement_display_id(new.req_year_month, new.req_sequence);
      if new.req_id_display is null or btrim(new.req_id_display) = '' then
        new.req_id_display := expected_display;
      elsif new.req_id_display <> expected_display then
        raise exception 'req_id_display must match req_year_month and req_sequence when seq is provided';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if new.req_year_month is distinct from old.req_year_month then
    raise exception 'req_year_month cannot be changed after insert';
  end if;

  normalized_year_month := old.req_year_month;

  if new.req_sequence is distinct from old.req_sequence then
    raise exception 'req_sequence cannot be changed after insert';
  end if;

  if new.req_id_display is distinct from old.req_id_display then
    if new.req_sequence is not null then
      expected_display := public.build_requirement_display_id(normalized_year_month, new.req_sequence);
      if new.req_id_display <> expected_display then
        raise exception 'req_id_display must remain aligned with req_year_month and req_sequence';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status in ('open','cancelled') then
      if new.status='open' then new.date_opened:=timezone('Asia/Kolkata',now())::date; end if;
    elsif old.status = 'open' and new.status = 'closed' then
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    elsif old.status = 'open' and new.status = 'cancelled' then
      if nullif(trim(new.closure_reason), '') is null then
        raise exception 'closure_reason is required when cancelling a requirement';
      end if;
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    elsif old.status in ('closed', 'cancelled') and new.status = 'open' then
      new.date_closed := null;
      new.closure_reason := null;
    else
      raise exception 'Invalid requirement status transition from % to %', old.status, new.status;
    end if;
  end if;

  if new.status = 'cancelled' and nullif(trim(new.closure_reason), '') is null then
    raise exception 'closure_reason is required when cancelling a requirement';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;


-- One transaction for the form, including reviewed location correction, version
-- check and remark. Never leave a half-saved correction if validation fails.
create function public.save_platform_requirement(p_fields jsonb,p_id uuid default null,p_expected_version integer default null,p_correction_reason text default null)
returns public.requirements language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.requirements; company uuid:=nullif(p_fields->>'company_id','')::uuid;
 ship uuid:=nullif(p_fields->>'ship_id','')::uuid; old_company uuid;old_ship uuid;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),case when p_id is null then 'create_requirements' else 'edit_requirements' end) then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_id is not null then
  select * into r from public.requirements where id=p_id and archived_at is null and deleted_at is null for update;
  if not found then raise exception 'requirement_not_found'; end if;
  if p_expected_version is null or r.version<>p_expected_version then raise exception 'version_conflict' using errcode='40001'; end if;
  old_company:=r.company_id;old_ship:=r.ship_id;
  if r.status<>'draft' and (company is distinct from r.company_id or ship is distinct from r.ship_id) then
   r:=public.correct_requirement_location(r.id,company,ship,p_correction_reason,r.version);
  end if;
  update public.requirements set company_id=company,ship_id=ship,
   vessel_name=case when ship is null then nullif(p_fields->>'vessel_name','') else vessel_name end,
   customer_name=case when company is null then nullif(p_fields->>'customer_name','') else customer_name end,
   rank_id=nullif(p_fields->>'rank_id','')::uuid,vessel_type_id=nullif(p_fields->>'vessel_type_id','')::uuid,
   positions_required=nullif(p_fields->>'positions_required','')::integer,target_days=nullif(p_fields->>'target_days','')::integer,
   status=coalesce(nullif(p_fields->>'status',''),status) where id=p_id returning * into r;
 else
  insert into public.requirements(company_id,ship_id,vessel_name,customer_name,rank_id,vessel_type_id,positions_required,target_days,status,owner_recruiter_id,created_by_recruiter_id)
  values(company,ship,nullif(p_fields->>'vessel_name',''),nullif(p_fields->>'customer_name',''),
   nullif(p_fields->>'rank_id','')::uuid,nullif(p_fields->>'vessel_type_id','')::uuid,
   nullif(p_fields->>'positions_required','')::integer,nullif(p_fields->>'target_days','')::integer,
   coalesce(nullif(p_fields->>'status',''),'draft'),auth.uid(),auth.uid()) returning * into r;
 end if;
 if nullif(trim(p_fields->>'notes'),'') is not null then perform public.add_requirement_remark(r.id,trim(p_fields->>'notes'),'internal'); end if;
 return r;
end $$;
revoke all on function public.save_platform_requirement(jsonb,uuid,integer,text) from public,anon;
grant execute on function public.save_platform_requirement(jsonb,uuid,integer,text) to authenticated;
commit;
