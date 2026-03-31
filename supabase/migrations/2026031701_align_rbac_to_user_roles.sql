-- RBAC cleanup migration
-- Goal:
-- 1. Standardize RBAC on public.user_roles
-- 2. Backfill from legacy public.role_assignments
-- 3. Rewrite drifting permission functions to use public.user_roles consistently
-- 4. Keep legacy tables in place for verification before any drop

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'role_assignments'
  ) then
    execute '
      create table if not exists public.role_assignments_backup_20260317 as
      select *
      from public.role_assignments
      where false
    ';

    execute '
      insert into public.role_assignments_backup_20260317
      select *
      from public.role_assignments ra
      where not exists (
        select 1
        from public.role_assignments_backup_20260317 b
        where b.id = ra.id
      )
    ';
  end if;
end $$;

create table if not exists public.user_roles_backup_20260317 as
select *
from public.user_roles
where false;

insert into public.user_roles_backup_20260317
select *
from public.user_roles ur
where not exists (
  select 1
  from public.user_roles_backup_20260317 b
  where b.user_id = ur.user_id
    and b.role_id = ur.role_id
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'role_assignments'
  ) then
    execute '
      create table if not exists public.role_assignments_orphans_20260317 as
      select *
      from public.role_assignments
      where false
    ';

    execute '
      insert into public.role_assignments_orphans_20260317
      select ra.*
      from public.role_assignments ra
      left join public.profiles p on p.id = ra.user_id
      where ra.user_id is null
         or ra.role_id is null
         or p.id is null
         or not exists (
           select 1
           from public.roles r
           where r.id = ra.role_id
         )
    ';

    execute '
      insert into public.user_roles (user_id, role_id, assigned_at, assigned_by)
      select
        ra.user_id,
        ra.role_id,
        coalesce(ra.created_at, now()) as assigned_at,
        ra.assigned_by
      from public.role_assignments ra
      join public.profiles p on p.id = ra.user_id
      join public.roles r on r.id = ra.role_id
      where ra.user_id is not null
        and ra.role_id is not null
        and not exists (
          select 1
          from public.user_roles ur
          where ur.user_id = ra.user_id
            and ur.role_id = ra.role_id
        )
    ';
  end if;
end $$;

create or replace function public.get_user_role(user_uuid uuid)
returns table(role_name text)
language plpgsql
security definer
as $function$
begin
  return query
  select r.name as role_name
  from public.user_roles ur
  join public.roles r on ur.role_id = r.id
  where ur.user_id = user_uuid
  order by ur.assigned_at asc nulls last, r.name asc
  limit 1;
end;
$function$;

create or replace function public.get_user_permissions(user_uuid uuid)
returns table(permission_name text)
language plpgsql
security definer
as $function$
begin
  return query
  select distinct p.name as permission_name
  from public.user_roles ur
  join public.role_permissions rp on ur.role_id = rp.role_id
  join public.permissions p on rp.permission_id = p.id
  where ur.user_id = user_uuid;
end;
$function$;

create or replace function public.check_permission(user_uuid uuid, permission_name text)
returns boolean
language plpgsql
security definer
as $function$
begin
  return exists (
    select 1
    from public.permissions p
    join public.role_permissions rp on p.id = rp.permission_id
    join public.user_roles ur on rp.role_id = ur.role_id
    where ur.user_id = user_uuid
      and p.name = permission_name
  );
end;
$function$;

create or replace function public.has_permission(user_uuid uuid, permission_name text)
returns boolean
language plpgsql
security definer
as $function$
begin
  return public.check_permission(user_uuid, permission_name);
end;
$function$;

-- The old implementation referenced permissions.permission_key, but the
-- documented permissions table only exposes `name`. Keep the function for
-- compatibility, but align it to the active schema and RBAC table.
create or replace function public.user_has_permission(p_user_id uuid, p_permission_key text)
returns boolean
language plpgsql
security definer
as $function$
begin
  return exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on ur.role_id = rp.role_id
    join public.permissions p on rp.permission_id = p.id
    where ur.user_id = p_user_id
      and p.name = p_permission_key
  );
end;
$function$;

commit;

-- Post-migration verification:
-- select * from public.get_user_role('<user-uuid>');
-- select * from public.get_user_permissions('<user-uuid>');
-- select public.has_permission('<user-uuid>', 'manage_team');
-- select count(*) as legacy_rows from public.role_assignments;
-- select count(*) as active_rows from public.user_roles;
-- select count(*) as orphaned_legacy_rows from public.role_assignments_orphans_20260317;
