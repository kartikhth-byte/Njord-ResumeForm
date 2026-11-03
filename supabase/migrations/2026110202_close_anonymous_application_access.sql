-- Close anonymous access to applicant data (production audit 2026-11-02).
--
-- Findings fixed here:
--   1. applications / application_data readable by anon whenever public_token is set
--   2. dashboard_applications view selectable by anon, bypassing caller RLS
--   3. applications INSERT policy WITH CHECK (true)
--   4. anon EXECUTE on security-definer functions
--   5. application-photos / offer-letters buckets public
--
-- Approach: replace (not patch) every policy on applications and application_data
-- with an explicit set, because the live policies predate the migrations in this repo.
-- Emailed review links (?access=) move to get_application_for_review(), which
-- checks the token server-side.
--
-- Deploy together with the app/Edge Function changes in the same commit
-- (signed photo URLs, review RPC, offer-letter download). NOT APPLIED.

begin;

-- ---------------------------------------------------------------------------
-- Helper: is the caller a recruiter (same rule the app uses for routing)
-- ---------------------------------------------------------------------------
create or replace function public.is_recruiter(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and user_type = 'recruiter'
  )
$$;

revoke all on function public.is_recruiter(uuid) from public, anon;
grant execute on function public.is_recruiter(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1 + 3. Replace all policies on applications and application_data
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('applications', 'application_data')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end;
$$;

alter table public.applications enable row level security;
alter table public.application_data enable row level security;

revoke all on public.applications from anon;
revoke all on public.application_data from anon;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.application_data to authenticated;

-- applications: applicants see and edit only their own drafts; recruiters see all.
create policy applications_select_own on public.applications
for select to authenticated
using (user_id = auth.uid());

create policy applications_select_recruiter on public.applications
for select to authenticated
using (public.is_recruiter(auth.uid()));

create policy applications_insert_own_draft on public.applications
for insert to authenticated
with check (user_id = auth.uid() and submitted_at is null);

create policy applications_update_own_draft on public.applications
for update to authenticated
using (user_id = auth.uid() and submitted_at is null)
with check (user_id = auth.uid());

create policy applications_update_recruiter on public.applications
for update to authenticated
using (public.is_recruiter(auth.uid()))
with check (public.is_recruiter(auth.uid()));

create policy applications_delete_own_draft on public.applications
for delete to authenticated
using (user_id = auth.uid() and submitted_at is null);

create policy applications_delete_recruiter_draft on public.applications
for delete to authenticated
using (public.is_recruiter(auth.uid()) and submitted_at is null);

-- application_data: follows its application.
create policy application_data_select on public.application_data
for select to authenticated
using (exists (
  select 1 from public.applications a
  where a.id = application_data.application_id
    and (a.user_id = auth.uid() or public.is_recruiter(auth.uid()))
));

create policy application_data_insert_own_draft on public.application_data
for insert to authenticated
with check (exists (
  select 1 from public.applications a
  where a.id = application_data.application_id
    and a.user_id = auth.uid() and a.submitted_at is null
));

create policy application_data_update_own_draft on public.application_data
for update to authenticated
using (exists (
  select 1 from public.applications a
  where a.id = application_data.application_id
    and a.user_id = auth.uid() and a.submitted_at is null
))
with check (exists (
  select 1 from public.applications a
  where a.id = application_data.application_id
    and a.user_id = auth.uid() and a.submitted_at is null
));

create policy application_data_delete_draft on public.application_data
for delete to authenticated
using (exists (
  select 1 from public.applications a
  where a.id = application_data.application_id
    and a.submitted_at is null
    and (a.user_id = auth.uid() or public.is_recruiter(auth.uid()))
));

-- ---------------------------------------------------------------------------
-- Emailed review links: token checked server-side, one application returned
-- ---------------------------------------------------------------------------
create or replace function public.get_application_for_review(
  p_public_token text,
  p_access_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  app public.applications;
  form_data jsonb;
begin
  if nullif(trim(coalesce(p_public_token, '')), '') is null
     or nullif(trim(coalesce(p_access_token, '')), '') is null then
    return null;
  end if;

  select * into app
  from public.applications
  where public_token::text = p_public_token
    and submitted_at is not null
    and review_access_token_hash = encode(sha256(convert_to(p_access_token, 'UTF8')), 'hex')
    and review_access_token_expires_at > now();

  if not found then
    return null;
  end if;

  select d.data into form_data
  from public.application_data d
  where d.application_id = app.id;

  return jsonb_build_object(
    'application', to_jsonb(app) - 'review_access_token_hash' - 'review_access_token_expires_at',
    'data', coalesce(form_data, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_application_for_review(text, text) from public;
grant execute on function public.get_application_for_review(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. dashboard_applications view: caller RLS, no anon access
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.dashboard_applications') is not null then
    execute 'alter view public.dashboard_applications set (security_invoker = true)';
    execute 'revoke all on public.dashboard_applications from anon';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. No anonymous EXECUTE on security-definer functions.
-- Removes PUBLIC/anon grants and re-grants only roles that already had access,
-- so no function becomes callable by a role that could not call it before.
-- Kept for anon: functions used inside RLS policies and the review-link RPC.
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
  had_authenticated boolean;
  had_service boolean;
begin
  for fn in
    select p.oid, p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname not in ('has_permission', 'user_has_permission', 'get_application_for_review')
  loop
    had_authenticated := has_function_privilege('authenticated', fn.oid, 'EXECUTE');
    had_service := has_function_privilege('service_role', fn.oid, 'EXECUTE');
    execute format('revoke execute on function %s from public, anon', fn.sig);
    if had_authenticated then
      execute format('grant execute on function %s to authenticated', fn.sig);
    end if;
    if had_service then
      execute format('grant execute on function %s to service_role', fn.sig);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Private buckets with explicit policies (skipped where storage is absent)
-- Photo paths are "<applicant user id>/<file>"; offer letters "<application id>/<file>".
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  update storage.buckets set public = false where id in ('application-photos', 'offer-letters');

  -- Drop any existing policy that mentions these buckets, then recreate explicitly.
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(application-photos|offer-letters)'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;

  execute $p$
    create policy application_photos_owner on storage.objects
    for all to authenticated
    using (bucket_id = 'application-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'application-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;

  execute $p$
    create policy application_photos_recruiter_read on storage.objects
    for select to authenticated
    using (bucket_id = 'application-photos' and public.is_recruiter(auth.uid()))
  $p$;

  execute $p$
    create policy offer_letters_recruiter on storage.objects
    for all to authenticated
    using (bucket_id = 'offer-letters' and public.is_recruiter(auth.uid()))
    with check (bucket_id = 'offer-letters' and public.is_recruiter(auth.uid()))
  $p$;
end;
$$;

commit;
