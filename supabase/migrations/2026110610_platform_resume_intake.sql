-- Canonical private platform registry. Needle receives version events, never
-- owns person identity or the original Drive write. Internal compatibility
-- evidence keeps the reviewed candidate-save transaction's existing guarantees.
begin;
create table public.resume_files (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 drive_file_id text,filename text not null,size_bytes bigint not null check(size_bytes between 1 and 10485760),
 source text not null,external_id text,uploader_id uuid not null,
 storage_status text not null default 'pending' check(storage_status in ('pending','stored','failed')),
 lease_token uuid,lease_until timestamptz,created_at timestamptz not null default now(),
 unique(organization_id,content_hash),unique(organization_id,id)
);
create table public.resume_versions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,file_id uuid not null,
 candidate_id uuid references public.prospects(id),identity_status text not null default 'unreviewed'
 check(identity_status in ('unreviewed','held','linked')),
 created_at timestamptz not null default now(),unique(organization_id,file_id),
 foreign key(organization_id,file_id) references public.resume_files(organization_id,id)
);
create table public.resume_extractions (
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.resume_versions(id),
 extractor_version text not null,contract_version text not null,payload jsonb not null,
 status text not null check(status in ('needs_review','partial','failed')),
 created_at timestamptz not null default now(),unique(version_id,extractor_version)
);
create table public.resume_identity_reviews (
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.resume_versions(id),
 actor_id uuid not null,decision text not null check(decision in ('new','link','hold')),
 candidate_id uuid references public.prospects(id),reviewed_fields jsonb not null,
 created_at timestamptz not null default now()
);
create table public.resume_index_events (
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.resume_versions(id),
 organization_id uuid not null,event_type text not null default 'resume.registered',contract_version integer not null default 1,
 status text not null default 'pending' check(status in ('pending','delivered')),
 last_error_code text,attempts integer not null default 0,created_at timestamptz not null default now(),delivered_at timestamptz,
 unique(version_id,event_type,contract_version)
);
do $$ declare t text;begin
 foreach t in array array['resume_files','resume_versions','resume_extractions','resume_identity_reviews','resume_index_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.claim_platform_resume(p_org uuid,p_hash text,p_filename text,p_size bigint,p_source text,p_actor uuid,p_lease uuid,p_external_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.resume_files;v public.resume_versions;
begin
 if p_org<>public.needle_pilot_organization_id() or p_hash !~ '^[a-f0-9]{64}$' or p_size not between 1 and 10485760
 or length(p_filename)>250 or p_actor is null or p_lease is null then raise exception 'invalid_resume_registration';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_hash,0));
 insert into public.resume_files(organization_id,content_hash,filename,size_bytes,source,uploader_id,external_id)
 values(p_org,p_hash,p_filename,p_size,p_source,p_actor,p_external_id) on conflict(organization_id,content_hash) do nothing;
 select * into f from public.resume_files where organization_id=p_org and content_hash=p_hash for update;
 if f.size_bytes<>p_size then raise exception 'resume_hash_metadata_conflict';end if;
 if f.storage_status<>'stored' and f.lease_until>now() and f.lease_token<>p_lease then raise exception 'resume_registration_busy' using errcode='55P03';end if;
 if f.storage_status<>'stored' then
  update public.resume_files set lease_token=p_lease,lease_until=now()+interval '5 minutes' where id=f.id returning * into f;
 end if;
 insert into public.resume_versions(organization_id,file_id) values(p_org,f.id) on conflict do nothing;
 select * into v from public.resume_versions where organization_id=p_org and file_id=f.id;
 return jsonb_build_object('file',to_jsonb(f),'version',to_jsonb(v));
end $$;
create function public.finish_platform_resume(p_file uuid,p_lease uuid,p_drive_id text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.resume_files;v uuid;
begin
 if nullif(trim(p_drive_id),'') is null then raise exception 'drive_original_required';end if;
 select * into f from public.resume_files where id=p_file for update;
 if not found then raise exception 'resume_not_found';end if;
 if f.storage_status='stored' then
  if f.drive_file_id<>p_drive_id then raise exception 'immutable_original_conflict';end if;
 elsif f.lease_token is distinct from p_lease or f.lease_until is null or f.lease_until<now() then raise exception 'resume_lease_expired';
 else update public.resume_files set drive_file_id=p_drive_id,storage_status='stored',lease_until=null,lease_token=null where id=p_file;
 end if;
 select id into v from public.resume_versions where file_id=p_file;
 insert into public.resume_index_events(version_id,organization_id) values(v,f.organization_id) on conflict do nothing;
 return v;
end $$;
create function public.release_platform_resume(p_file uuid,p_lease uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
 update public.resume_files set lease_until=null,lease_token=null where id=p_file and lease_token=p_lease and storage_status<>'stored'
$$;
revoke all on function public.claim_platform_resume(uuid,text,text,bigint,text,uuid,uuid,text),public.finish_platform_resume(uuid,uuid,text),public.release_platform_resume(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_platform_resume(uuid,text,text,bigint,text,uuid,uuid,text),public.finish_platform_resume(uuid,uuid,text),public.release_platform_resume(uuid,uuid) to service_role;

-- Explicit decision and candidate/source save commit atomically. OCR never
-- updates confirmed fields of an existing person; that transaction retains them.
create function public.review_platform_resume(p_version uuid,p_evidence uuid,p_decision text,p_fields jsonb,
 p_link uuid default null,p_confirm_new boolean default false,p_requirement uuid default null,p_requirement_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.resume_versions;f public.resume_files;e public.needle_resume_evidence;result jsonb;person uuid;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects') or not public.has_permission(auth.uid(),'view_prospects') then
  raise exception 'permission_denied' using errcode='42501';end if;
 if p_decision is null or p_decision not in ('new','link','hold') then raise exception 'identity_review_required';end if;
 select * into v from public.resume_versions where id=p_version and organization_id=public.needle_pilot_organization_id() for update;
 if not found then raise exception 'resume_version_not_found';end if;
 select * into f from public.resume_files where id=v.file_id and organization_id=v.organization_id and storage_status='stored';
 select * into e from public.needle_resume_evidence where id=p_evidence and actor_id=auth.uid() and organization_id=v.organization_id and resume_id=f.content_hash;
 if not found or f.id is null then raise exception 'verified_resume_required';end if;
 if p_decision='hold' then
  if v.candidate_id is not null then raise exception 'reviewed_identity_cannot_be_unlinked';end if;
  update public.resume_versions set identity_status='held' where id=v.id;
  result:=jsonb_build_object('held',true,'resume_version_id',v.id);
 else
  if p_decision='link' and p_link is null then raise exception 'explicit_candidate_link_required';end if;
  if p_decision='new' and p_link is not null then raise exception 'invalid_identity_decision';end if;
  if v.candidate_id is not null then
   if p_link is not null and p_link<>v.candidate_id then raise exception 'resume_already_linked';end if;
   p_link:=v.candidate_id;
  end if;
  result:=public.save_resume_candidate(p_evidence,p_fields,p_requirement,p_link,p_confirm_new,p_requirement_version);
  person:=(result->>'prospect_id')::uuid;
  update public.resume_versions set candidate_id=person,identity_status='linked' where id=v.id;
 end if;
 insert into public.resume_identity_reviews(version_id,actor_id,decision,candidate_id,reviewed_fields)
 values(v.id,auth.uid(),p_decision,person,coalesce(p_fields,'{}'::jsonb));
 return result;
end $$;
revoke all on function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) from public,anon;
grant execute on function public.review_platform_resume(uuid,uuid,text,jsonb,uuid,boolean,uuid,integer) to authenticated;
revoke execute on function public.save_resume_candidate(uuid,jsonb,uuid,uuid,boolean,integer) from public,anon,authenticated;
create function public.guard_resume_file_immutable() returns trigger language plpgsql as $$
begin
 if old.storage_status='stored' and (new.drive_file_id is distinct from old.drive_file_id or
 new.content_hash<>old.content_hash or new.organization_id<>old.organization_id or new.size_bytes<>old.size_bytes or new.storage_status<>'stored') then
  raise exception 'immutable_original_conflict';end if;
 return new;
end $$;
create trigger resume_file_immutable before update on public.resume_files for each row execute function public.guard_resume_file_immutable();
create function public.linked_platform_resume_version(p_prospect uuid,p_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'view_prospects') then raise exception 'permission_denied' using errcode='42501';end if;
 select v.id into result from public.resume_versions v join public.resume_files f on f.id=v.file_id
 join public.prospect_resumes r on r.organization_id=v.organization_id and r.resume_id=f.content_hash and r.prospect_id=p_prospect
 where v.organization_id=public.needle_pilot_organization_id() and f.content_hash=p_hash;
 return result;
end $$;
create function public.platform_resume_review_queue()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_permission(auth.uid(),'create_prospects') or not public.has_permission(auth.uid(),'view_prospects') then raise exception 'permission_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(row),'[]'::jsonb) into result from
 (select v.id as resume_version_id,v.identity_status,v.created_at,f.filename,f.content_hash as resume_id,
 (select e.status from public.resume_extractions e where e.version_id=v.id order by e.created_at desc limit 1) as extraction_status
 from public.resume_versions v join public.resume_files f on f.id=v.file_id
 where v.organization_id=public.needle_pilot_organization_id() and v.identity_status<>'linked' and f.storage_status='stored'
 order by v.created_at desc limit 100) row;
 return result;
end $$;
revoke all on function public.linked_platform_resume_version(uuid,text),public.platform_resume_review_queue() from public,anon;
grant execute on function public.linked_platform_resume_version(uuid,text),public.platform_resume_review_queue() to authenticated;

create function public.guard_resume_version_identity() returns trigger language plpgsql as $$
begin
 if new.file_id<>old.file_id or new.organization_id<>old.organization_id or
 (old.candidate_id is not null and (new.candidate_id is distinct from old.candidate_id or new.identity_status<>'linked')) then
 raise exception 'immutable_reviewed_version';end if;return new;
end $$;
create trigger resume_version_identity before update on public.resume_versions for each row execute function public.guard_resume_version_identity();
commit;
