-- Contain legacy tables that were exposed through the public Data API.
-- Keep active tables in public: the browser and Edge Functions address them there.
-- This migration must be applied independently of 2026110201_recruitment_case_v1.

begin;

-- Internal records and historical backups have no direct browser callers.
alter table public.applicant_magic_link_requests enable row level security;
alter table public.application_data_backup enable row level security;
alter table public.applications_backup enable row level security;
alter table public.deleted_junk_recruiters_20260316 enable row level security;
alter table public.profiles_backup enable row level security;
alter table public.recruiter_settings enable row level security;
alter table public.role_assignments_backup_20260317 enable row level security;
alter table public.role_assignments_orphans_20260317 enable row level security;
alter table public.user_roles_backup_20260317 enable row level security;

revoke all on table
  public.applicant_magic_link_requests,
  public.application_data_backup,
  public.applications_backup,
  public.deleted_junk_recruiters_20260316,
  public.profiles_backup,
  public.recruiter_settings,
  public.role_assignments_backup_20260317,
  public.role_assignments_orphans_20260317,
  public.user_roles_backup_20260317
from public, anon, authenticated;

-- Recruiters need profile names for their workspace; each applicant needs only
-- their own profile. Applicant upsert is the sole browser-side profile write.
alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy profiles_read_self_or_recruiter
  on public.profiles for select to authenticated
  using (id = (select auth.uid())
    or public.has_permission((select auth.uid()), 'view_requirements'));

create policy profiles_insert_self_applicant
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and user_type = 'applicant');

create policy profiles_update_self_applicant
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and user_type = 'applicant')
  with check (id = (select auth.uid()) and user_type = 'applicant');

-- These catalogs are intentionally readable without login, but not writable
-- through the Data API. Existing recruiter screens read them directly.
alter table public.countries enable row level security;
alter table public.ranks enable row level security;
alter table public.vessel_types enable row level security;

revoke all on table public.countries, public.ranks, public.vessel_types
  from public, anon, authenticated;
grant select on table public.countries, public.ranks, public.vessel_types
  to anon, authenticated;

create policy countries_read on public.countries
  for select to anon, authenticated using (true);
create policy ranks_read on public.ranks
  for select to anon, authenticated using (true);
create policy vessel_types_read on public.vessel_types
  for select to anon, authenticated using (true);

commit;
