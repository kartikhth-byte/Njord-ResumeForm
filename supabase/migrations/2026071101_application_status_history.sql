-- Records every application status transition so the KPI layer can compute
-- true time-in-stage, stage conversion, and per-recruiter throughput.
-- Populated automatically by trigger; the frontend only reads it.
--
-- The remote database was found to already contain an orphaned
-- application_status_history table with a different shape (no API grants, no
-- code references — an artifact of an older clone). If that shape is present
-- it is renamed to *_legacy so its data is preserved, then the correct table
-- is created.

begin;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'application_status_history'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'application_status_history'
      and column_name = 'changed_at'
  ) then
    alter table public.application_status_history
      rename to application_status_history_legacy;
  end if;
end $$;

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  handling_recruiter_id uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists application_status_history_app_changed_idx
  on public.application_status_history (application_id, changed_at);

create index if not exists application_status_history_changed_at_desc_idx
  on public.application_status_history (changed_at desc);

alter table public.application_status_history enable row level security;

drop policy if exists "application_status_history_recruiter_read" on public.application_status_history;
create policy "application_status_history_recruiter_read"
  on public.application_status_history
  for select
  to authenticated
  using (public.is_recruiter_profile(auth.uid()));

create or replace function public.record_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, handling_recruiter_id)
    values (new.id, null, new.status, auth.uid(), new.handling_recruiter_id);
  elsif new.status is distinct from old.status then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, handling_recruiter_id)
    values (new.id, old.status, new.status, auth.uid(), new.handling_recruiter_id);
  end if;
  return new;
end;
$function$;

revoke all on function public.record_application_status_change() from public;

drop trigger if exists applications_record_status_change on public.applications;
create trigger applications_record_status_change
after insert or update on public.applications
for each row
execute function public.record_application_status_change();

commit;
