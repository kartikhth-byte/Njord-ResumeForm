-- Run this only after:
-- 1. 20260317_01_align_rbac_to_user_roles.sql has been applied
-- 2. recruiter login, dashboard, team management, and scheduling have been smoke-tested
-- 3. no DB functions, views, or policies still reference role_assignments / recruiter_roles

begin;

do $$
declare
  role_assignment_refs integer;
  recruiter_role_refs integer;
begin
  select count(*)
  into role_assignment_refs
  from pg_proc
  where prokind in ('f', 'p')
    and pg_get_functiondef(pg_proc.oid) ilike '%role_assignments%';

  if role_assignment_refs > 0 then
    raise exception 'Cannot drop public.role_assignments: % function definitions still reference it', role_assignment_refs;
  end if;

  select count(*)
  into recruiter_role_refs
  from pg_proc
  where prokind in ('f', 'p')
    and pg_get_functiondef(pg_proc.oid) ilike '%recruiter_roles%';

  if recruiter_role_refs > 0 then
    raise exception 'Cannot drop public.recruiter_roles: % function definitions still reference it', recruiter_role_refs;
  end if;
end $$;

drop table if exists public.role_assignments;
drop table if exists public.recruiter_roles;

commit;
