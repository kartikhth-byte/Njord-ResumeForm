-- Harden the bootstrap trigger that auto-assigns the Master Recruiter role.
-- Current problem:
-- - it can self-assign Master Recruiter to later manually inserted recruiter profiles
--   if the insert order temporarily makes that user appear to be the only recruiter.
-- Safer rule:
-- - auto-assign only when the inserted profile is the first recruiter profile
-- - and only when that user does not already have a role row

begin;

create or replace function public.assign_master_recruiter()
returns trigger
language plpgsql
as $function$
declare
  master_role_id uuid;
begin
  if new.user_type <> 'recruiter' then
    return new;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = new.id
  ) then
    return new;
  end if;

  if (
    select count(*)
    from public.profiles p
    where p.user_type = 'recruiter'
  ) = 1 then
    select r.id
    into master_role_id
    from public.roles r
    where r.name = 'Master Recruiter'
    limit 1;

    if master_role_id is not null then
      insert into public.user_roles (user_id, role_id, assigned_by)
      values (new.id, master_role_id, new.id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$function$;

commit;

-- Optional follow-up verification:
-- select tgname, tgrelid::regclass
-- from pg_trigger
-- where tgname = 'auto_assign_master_recruiter';
