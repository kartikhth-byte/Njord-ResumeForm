\set ON_ERROR_STOP on
-- Run in an isolated PostgreSQL database: psql -f supabase/tests/directory_ids_and_notes.sql
create role authenticated;
create role anon;
create role service_role;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
create function public.needle_pilot_organization_id() returns uuid language sql immutable as $$
  select '00000000-0000-4000-8000-000000000001'::uuid
$$;
create function public.has_permission(p_actor uuid, p_permission text) returns boolean language sql stable as $$
  select p_actor = '00000000-0000-4000-8000-000000000002'::uuid
    or (p_actor = '00000000-0000-4000-8000-000000000003'::uuid
      and p_permission in ('view_requirements', 'view_prospects'))
$$;
create table public.profiles (id uuid primary key);
create table public.requirements (id uuid primary key, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.prospects (id uuid primary key, organization_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.resume_lead_drafts (id uuid primary key, organization_id uuid not null, name text, telephone text, email text,
  version integer default 1, created_by uuid, created_at timestamptz default now(), status text default 'draft');
create table public.recruitment_cases (id uuid primary key, organization_id uuid not null);
create table public.applications (id uuid primary key, prospect_id uuid references public.prospects(id), submitted_at timestamptz);
create function public.recruitment_workspace_can_read(p_case uuid) returns boolean language sql stable security definer as $$
  select public.has_permission(auth.uid(), 'view_requirements') and exists (
    select 1 from public.recruitment_cases where id = p_case and organization_id = public.needle_pilot_organization_id())
$$;
create function public.list_candidate_drafts()
returns table(id uuid, name text, telephone text, email text, version integer, created_by uuid, created_at timestamptz)
language sql as $$ select id, name, telephone, email, version, created_by, created_at from public.resume_lead_drafts $$;
insert into public.profiles values ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000003');
insert into public.requirements(id) values ('00000000-0000-4000-8000-000000000011');
insert into public.prospects(id, organization_id) values
  ('00000000-0000-4000-8000-000000000012', public.needle_pilot_organization_id()),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000099');
insert into public.resume_lead_drafts(id, organization_id, name) values
  ('00000000-0000-4000-8000-000000000013', public.needle_pilot_organization_id(), 'Draft candidate');
insert into public.recruitment_cases(id, organization_id) values
  ('00000000-0000-4000-8000-000000000014', public.needle_pilot_organization_id());
insert into public.applications(id, prospect_id) values
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000012'),
  ('00000000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000022');
insert into public.applications(id, submitted_at) values
  ('00000000-0000-4000-8000-000000000035', now()),
  ('00000000-0000-4000-8000-000000000045', null);

\ir ../migrations/2026111401_directory_ids_and_notes.sql
\ir ../migrations/2026111402_directory_notes_for_legacy_applications.sql

do $$ begin
  if (select display_id from public.requirements where id = '00000000-0000-4000-8000-000000000011') <> 'REQ-000001'
    or (select display_id from public.prospects where id = '00000000-0000-4000-8000-000000000012') <> 'CAN-000001'
    or (select display_id from public.resume_lead_drafts where id = '00000000-0000-4000-8000-000000000013') <> 'CAN-D-000001'
    or (select display_id from public.recruitment_cases where id = '00000000-0000-4000-8000-000000000014') <> 'REC-000001'
    or (select display_id from public.applications where id = '00000000-0000-4000-8000-000000000015') <> 'APP-000001' then
    raise exception 'directory backfill failed';
  end if;
  begin
    update public.requirements set display_id = 'REQ-999999' where id = '00000000-0000-4000-8000-000000000011';
    raise exception 'display ID should be immutable';
  exception when others then
    if sqlerrm <> 'display_id_is_immutable' then raise; end if;
  end;
end $$;
insert into public.requirements(id) values ('00000000-0000-4000-8000-000000000021');
grant insert on public.requirements to service_role;
set role service_role;
insert into public.requirements(id) values ('00000000-0000-4000-8000-000000000031');
reset role;
do $$ begin
  if (select display_id from public.requirements where id = '00000000-0000-4000-8000-000000000021') <> 'REQ-000002' then
    raise exception 'new requirement ID failed';
  end if;
  if (select display_id from public.requirements where id = '00000000-0000-4000-8000-000000000031') <> 'REQ-000003' then
    raise exception 'service role requirement ID failed';
  end if;
end $$;

set role authenticated;
select set_config('test.uid', '00000000-0000-4000-8000-000000000002', false);
insert into public.directory_notes(application_id, body) values
  ('00000000-0000-4000-8000-000000000015', 'Application note');
insert into public.directory_notes(case_id, body) values
  ('00000000-0000-4000-8000-000000000014', 'Recruitment note');
insert into public.directory_notes(draft_id, body) values
  ('00000000-0000-4000-8000-000000000013', 'Draft note');
insert into public.directory_notes(application_id, body) values
  ('00000000-0000-4000-8000-000000000035', 'Unlinked submitted form note');
do $$ begin
  if (select count(*) from public.directory_notes) <> 4 then raise exception 'recruiter note visibility failed'; end if;
  begin
    insert into public.directory_notes(application_id, body) values
      ('00000000-0000-4000-8000-000000000025', 'Cross-organization note');
    raise exception 'cross-organization insert should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.directory_notes(application_id, body) values
      ('00000000-0000-4000-8000-000000000045', 'Unsubmitted form note');
    raise exception 'unsubmitted unlinked application insert should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('test.uid', '00000000-0000-4000-8000-000000000003', false);
do $$ begin
  if (select count(*) from public.directory_notes) <> 4 then raise exception 'Coordinator note visibility failed'; end if;
  begin
    insert into public.directory_notes(application_id, body) values
      ('00000000-0000-4000-8000-000000000015', 'Denied');
    raise exception 'Coordinator insert should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('test.uid', '00000000-0000-4000-8000-000000000099', false);
do $$ begin
  if (select count(*) from public.directory_notes) <> 0 then raise exception 'outsider note visibility failed'; end if;
end $$;
reset role;
select 'directory IDs and notes PASS' as result;
