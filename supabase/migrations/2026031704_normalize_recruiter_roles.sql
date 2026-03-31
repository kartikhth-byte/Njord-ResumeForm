-- Normalize recruiter RBAC to the supported role set:
-- 1. Master Recruiter
-- 2. Recruiter
-- 3. Coordinator
-- Also prevent deletion/demotion of the last remaining Master Recruiter.

begin;

insert into public.roles (name, description)
values
  ('Master Recruiter', 'Full recruiter administration and hiring workflow access'),
  ('Recruiter', 'Operational recruiter access across applications, search, and scheduling'),
  ('Coordinator', 'Limited support access for scheduling and candidate coordination')
on conflict (name) do update
set description = excluded.description;

do $$
declare
  viewer_role_id uuid;
  coordinator_role_id uuid;
begin
  select id into viewer_role_id
  from public.roles
  where name = 'Viewer';

  select id into coordinator_role_id
  from public.roles
  where name = 'Coordinator';

  if viewer_role_id is not null then
    insert into public.user_roles (user_id, role_id, assigned_by, assigned_at)
    select ur.user_id, coordinator_role_id, ur.assigned_by, ur.assigned_at
    from public.user_roles ur
    where ur.role_id = viewer_role_id
      and not exists (
        select 1
        from public.user_roles existing
        where existing.user_id = ur.user_id
          and existing.role_id = coordinator_role_id
      );

    insert into public.role_permissions (role_id, permission_id)
    select coordinator_role_id, rp.permission_id
    from public.role_permissions rp
    where rp.role_id = viewer_role_id
      and not exists (
        select 1
        from public.role_permissions existing
        where existing.role_id = coordinator_role_id
          and existing.permission_id = rp.permission_id
      );

    delete from public.user_roles
    where role_id = viewer_role_id;

    delete from public.role_permissions
    where role_id = viewer_role_id;

    delete from public.roles
    where id = viewer_role_id;
  end if;
end $$;

create or replace function public.prevent_last_master_recruiter_change()
returns trigger
language plpgsql
as $$
declare
  master_role_id uuid;
  remaining_master_count integer;
  removing_master boolean := false;
begin
  select id into master_role_id
  from public.roles
  where name = 'Master Recruiter';

  if master_role_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    removing_master := old.role_id = master_role_id;
  elsif tg_op = 'UPDATE' then
    removing_master := old.role_id = master_role_id and new.role_id <> master_role_id;
  end if;

  if removing_master then
    select count(*)
    into remaining_master_count
    from public.user_roles
    where role_id = master_role_id
      and user_id <> old.user_id;

    if remaining_master_count = 0 then
      raise exception 'Cannot remove or demote the last Master Recruiter';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_roles_prevent_last_master_recruiter_change on public.user_roles;

create trigger user_roles_prevent_last_master_recruiter_change
before update or delete on public.user_roles
for each row
execute function public.prevent_last_master_recruiter_change();

commit;
