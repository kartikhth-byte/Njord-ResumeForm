begin;

alter table public.requirements
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_recruiter_id uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_recruiter_id uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists requirements_status_archived_deleted_idx
  on public.requirements (status, archived_at, deleted_at);

create index if not exists requirements_archived_by_recruiter_id_idx
  on public.requirements (archived_by_recruiter_id, archived_at desc);

create index if not exists requirements_deleted_by_recruiter_id_idx
  on public.requirements (deleted_by_recruiter_id, deleted_at desc);

alter table public.requirements
  drop constraint if exists requirements_archive_reason_check;

alter table public.requirements
  add constraint requirements_archive_reason_check check (
    archived_at is null or nullif(trim(archive_reason), '') is not null
  );

alter table public.requirements
  drop constraint if exists requirements_deleted_by_recruiter_check;

alter table public.requirements
  add constraint requirements_deleted_by_recruiter_check check (
    deleted_by_recruiter_id is null or public.is_recruiter_profile(deleted_by_recruiter_id)
  );

alter table public.requirements
  add constraint requirements_delete_reason_check check (
    deleted_at is null or nullif(trim(delete_reason), '') is not null
  );

create or replace function public.touch_requirements_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.touch_requirements_updated_at() from public;

drop trigger if exists requirements_touch_updated_at on public.requirements;
create trigger requirements_touch_updated_at
before update on public.requirements
for each row
execute function public.touch_requirements_updated_at();

commit;
