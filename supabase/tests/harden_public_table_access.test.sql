-- Scratch PostgreSQL only: this creates stand-in roles and tables, then applies
-- the migration. Run with psql -v ON_ERROR_STOP=1 -f on a disposable database.

create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.test_permissions (user_id uuid, name text);
create function public.has_permission(user_uuid uuid, permission_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.test_permissions
    where user_id = user_uuid and name = permission_name
  )
$$;

create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  user_type text not null default 'applicant',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.applicant_magic_link_requests (id integer);
create table public.application_data_backup (id integer);
create table public.applications_backup (id integer);
create table public.deleted_junk_recruiters_20260316 (id integer);
create table public.profiles_backup (id integer);
create table public.recruiter_settings (id integer);
create table public.role_assignments_backup_20260317 (id integer);
create table public.role_assignments_orphans_20260317 (id integer);
create table public.user_roles_backup_20260317 (id integer);
create table public.countries (id integer, name text);
create table public.ranks (id integer, name text);
create table public.vessel_types (id integer, name text);

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on all tables in schema public to anon, authenticated, service_role;

insert into public.profiles (id, full_name, user_type) values
  ('00000000-0000-0000-0000-000000000001', 'Applicant A', 'applicant'),
  ('00000000-0000-0000-0000-000000000002', 'Applicant B', 'applicant'),
  ('00000000-0000-0000-0000-000000000003', 'Recruiter', 'recruiter');
insert into public.test_permissions values
  ('00000000-0000-0000-0000-000000000003', 'view_requirements');
insert into public.countries values (1, 'Country');
insert into public.ranks values (1, 'Rank');
insert into public.vessel_types values (1, 'Vessel type');
insert into public.applicant_magic_link_requests values (1);

\ir ../migrations/2026110200_harden_public_table_access.sql

do $$
declare
  table_name text;
  relation_name text;
begin
  foreach table_name in array array[
    'applicant_magic_link_requests', 'application_data_backup',
    'applications_backup', 'deleted_junk_recruiters_20260316',
    'profiles_backup', 'recruiter_settings',
    'role_assignments_backup_20260317', 'role_assignments_orphans_20260317',
    'user_roles_backup_20260317'
  ] loop
    relation_name := format('public.%I', table_name);
    if not (select relrowsecurity from pg_class where oid = relation_name::regclass)
       or has_table_privilege('anon', relation_name, 'SELECT,INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated', relation_name, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'internal table remains exposed: %', table_name;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.profiles', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('authenticated', 'public.profiles', 'SELECT,INSERT,UPDATE')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
    raise exception 'profile grants are wrong';
  end if;

  foreach table_name in array array['countries', 'ranks', 'vessel_types'] loop
    relation_name := format('public.%I', table_name);
    if not (select relrowsecurity from pg_class where oid = relation_name::regclass)
       or not has_table_privilege('anon', relation_name, 'SELECT')
       or has_table_privilege('anon', relation_name, 'INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated', relation_name, 'INSERT,UPDATE,DELETE') then
      raise exception 'lookup grants are wrong: %', table_name;
    end if;
  end loop;
end;
$$;

set role anon;
do $$
begin
  if (select count(*) from public.countries) <> 1 then
    raise exception 'anon lookup read failed';
  end if;
  begin
    perform 1 from public.profiles;
    raise exception 'anon profile read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.applicant_magic_link_requests;
    raise exception 'anon internal read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
declare
  affected integer;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'applicant can read another profile';
  end if;
  update public.profiles set full_name = 'Updated' where id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'applicant self-update failed';
  end if;
  update public.profiles set full_name = 'Wrong' where id =
    '00000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'applicant updated another profile';
  end if;
  begin
    update public.profiles set user_type = 'recruiter' where id = auth.uid();
    raise exception 'applicant privilege escalation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.applicant_magic_link_requests;
    raise exception 'authenticated internal read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
insert into public.profiles (id, full_name, user_type) values
  (auth.uid(), 'Applicant C', 'applicant')
on conflict (id) do update set full_name = excluded.full_name,
  user_type = excluded.user_type;
insert into public.profiles (id, full_name, user_type) values
  (auth.uid(), 'Applicant C updated', 'applicant')
on conflict (id) do update set full_name = excluded.full_name,
  user_type = excluded.user_type;
do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'applicant upsert did not produce own profile';
  end if;
  begin
    insert into public.profiles (id, full_name, user_type) values
      ('00000000-0000-0000-0000-000000000005', 'Fake recruiter', 'recruiter');
    raise exception 'recruiter profile creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
begin
  if (select count(*) from public.profiles) <> 4 then
    raise exception 'recruiter profile list failed';
  end if;
end;
$$;
reset role;

set role service_role;
do $$
begin
  if (select count(*) from public.applicant_magic_link_requests) <> 1 then
    raise exception 'Edge Function service-role access failed';
  end if;
  insert into public.applicant_magic_link_requests values (2);
  if (select count(*) from public.applicant_magic_link_requests) <> 2 then
    raise exception 'Edge Function service-role write failed';
  end if;
end;
$$;
reset role;

select 'public table access tests passed' as result;
