-- Different pipeline stages can be worked by different recruiters, so each
-- application tracks who is currently handling it. Set from the workspace
-- pipeline via a per-row selector.

begin;

alter table public.applications
  add column if not exists handling_recruiter_id uuid references public.profiles(id) on delete set null;

alter table public.applications
  drop constraint if exists applications_handling_recruiter_check;

alter table public.applications
  add constraint applications_handling_recruiter_check check (
    handling_recruiter_id is null or public.is_recruiter_profile(handling_recruiter_id)
  );

create index if not exists applications_handling_recruiter_id_idx
  on public.applications (handling_recruiter_id);

commit;
