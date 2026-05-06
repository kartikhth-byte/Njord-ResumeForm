create or replace function public.prevent_multiple_active_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if coalesce(new.status, 'new') in ('hired', 'rejected', 'withdrawn') then
    return new;
  end if;

  if exists (
    select 1
    from public.applications existing
    where existing.user_id = new.user_id
      and existing.id <> new.id
      and coalesce(existing.status, 'new') not in ('hired', 'rejected', 'withdrawn')
  ) then
    raise exception using
      errcode = '23505',
      constraint = 'unique_active_application_per_user',
      message = 'duplicate key value violates unique constraint "unique_active_application_per_user"',
      detail = 'Only one active application is allowed per applicant until the current pipeline is completed.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_multiple_active_applications_before_write on public.applications;

create trigger prevent_multiple_active_applications_before_write
before insert or update of user_id, status
on public.applications
for each row
execute function public.prevent_multiple_active_applications();
