-- Private, actor-bound UI defect reports. Screenshots are removed via Storage API,
-- never SQL DELETE from storage.objects (which would orphan the underlying bytes).
create table if not exists public.problem_reports (
  id uuid primary key,
  report_number bigint generated always as identity unique,
  reporter_id uuid references auth.users(id) on delete set null,
  page text not null check (length(page) between 1 and 240 and page !~ '[?#]'),
  app_version text not null check (length(app_version) between 1 and 80),
  description text not null default '' check (length(description) <= 2000),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  screenshot_path text not null unique,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  screenshot_expires_at timestamptz not null default now()+interval '7 days',
  screenshot_deleted_at timestamptz
);
create index if not exists problem_reports_retention on public.problem_reports(screenshot_expires_at) where screenshot_deleted_at is null;
create index if not exists problem_reports_owner on public.problem_reports(reporter_id,created_at desc);
create table if not exists public.problem_report_status_history (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.problem_reports(id),
  actor_id uuid references auth.users(id) on delete set null,
  old_status text not null,
  new_status text not null,
  changed_at timestamptz not null default now()
);
alter table public.problem_reports enable row level security;
alter table public.problem_report_status_history enable row level security;
revoke all on public.problem_reports, public.problem_report_status_history from public, anon, authenticated;
grant select on public.problem_reports, public.problem_report_status_history to authenticated;
grant all on public.problem_reports, public.problem_report_status_history to service_role;
grant usage, select on sequence public.problem_reports_report_number_seq, public.problem_report_status_history_id_seq to service_role;
drop policy if exists problem_reports_read on public.problem_reports;
create policy problem_reports_read on public.problem_reports for select to authenticated
  using(reporter_id=auth.uid() or public.is_platform_operator());
drop policy if exists problem_reports_history_read on public.problem_report_status_history;
create policy problem_reports_history_read on public.problem_report_status_history for select to authenticated
  using(public.is_platform_operator());

create or replace function public.begin_problem_report(p_id uuid,p_page text,p_app_version text,p_description text default '')
returns public.problem_reports language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); r public.problem_reports;
begin
  if actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=actor and (banned_until is null or banned_until<now())) then
    raise exception 'account_unavailable' using errcode='42501';
  end if;
  if p_page is null or p_app_version is null or p_page !~ '^/[a-z:/-]*$' or length(p_page)>240 or length(p_app_version)>80 or length(p_description)>2000
     or p_app_version !~ '^[a-zA-Z0-9._-]+$' then raise exception 'invalid_report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,131301));
  select * into r from public.problem_reports where id=p_id;
  if found then
    if r.reporter_id is distinct from actor then raise exception 'report_unavailable' using errcode='42501'; end if;
    if r.submitted_at is null and r.created_at<now()-interval '1 hour' then raise exception 'report_expired'; end if;
    if r.submitted_at is null then
      update public.problem_reports set description=coalesce(p_description,'') where id=p_id returning * into r;
    end if;
    return r;
  end if;
  if (select count(*) from public.problem_reports where reporter_id=actor and created_at>now()-interval '1 day')>=30 then
    raise exception 'report_limit_reached';
  end if;
  insert into public.problem_reports(id,reporter_id,page,app_version,description,screenshot_path)
    values(p_id,actor,p_page,p_app_version,coalesce(p_description,''),actor::text||'/'||p_id::text||'.png') returning * into r;
  return r;
end $$;

create or replace function public.submit_problem_report(p_id uuid)
returns public.problem_reports language plpgsql security definer set search_path=public as $$
declare r public.problem_reports;
begin
  select * into r from public.problem_reports where id=p_id and reporter_id=auth.uid() for update;
  if not found then raise exception 'report_unavailable' using errcode='42501'; end if;
  if r.submitted_at is not null then return r; end if;
  if r.created_at<now()-interval '1 hour' or r.screenshot_deleted_at is not null then raise exception 'report_expired'; end if;
  if not exists(select 1 from storage.objects where bucket_id='problem-screenshots' and name=r.screenshot_path
    and metadata->>'mimetype'='image/png' and (metadata->>'size')::bigint between 1 and 5242880) then raise exception 'screenshot_missing'; end if;
  update public.problem_reports set submitted_at=now() where id=r.id returning * into r;
  return r;
end $$;

create or replace function public.set_problem_report_status(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare old public.problem_reports;
begin
  if not public.is_platform_operator() then raise exception 'operator_required' using errcode='42501'; end if;
  if p_status not in ('new','in_progress','resolved') or p_status is null then raise exception 'invalid_status'; end if;
  select * into old from public.problem_reports where id=p_id and submitted_at is not null for update;
  if not found then raise exception 'report_unavailable'; end if;
  if old.status=p_status then return; end if;
  update public.problem_reports set status=p_status where id=p_id;
  insert into public.problem_report_status_history(report_id,actor_id,old_status,new_status) values(p_id,auth.uid(),old.status,p_status);
end $$;
revoke all on function public.begin_problem_report(uuid,text,text,text),public.submit_problem_report(uuid),public.set_problem_report_status(uuid,text) from public,anon;
grant execute on function public.begin_problem_report(uuid,text,text,text),public.submit_problem_report(uuid),public.set_problem_report_status(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('problem-screenshots','problem-screenshots',false,5242880,array['image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/png'];
drop policy if exists problem_screenshots_insert on storage.objects;
create policy problem_screenshots_insert on storage.objects for insert to authenticated with check(
  bucket_id='problem-screenshots' and exists(select 1 from public.problem_reports r where r.screenshot_path=name
  and r.reporter_id=auth.uid() and r.submitted_at is null and r.screenshot_deleted_at is null and r.created_at>now()-interval '1 hour')
);
drop policy if exists problem_screenshots_read on storage.objects;
create policy problem_screenshots_read on storage.objects for select to authenticated using(
  bucket_id='problem-screenshots' and exists(select 1 from public.problem_reports r where r.screenshot_path=name
  and (r.reporter_id=auth.uid() or public.is_platform_operator()) and r.screenshot_expires_at>now() and r.screenshot_deleted_at is null
  and (r.submitted_at is not null or r.created_at>now()-interval '1 hour'))
);
-- No client update/delete policy: immutable objects, retention worker owns deletion.

drop policy if exists problem_screenshots_read_gate on storage.objects;
create policy problem_screenshots_read_gate on storage.objects as restrictive for select to authenticated using(
  bucket_id<>'problem-screenshots' or (auth.uid() is not null and exists(select 1 from public.problem_reports r where r.screenshot_path=name
    and (r.reporter_id=auth.uid() or public.is_platform_operator()) and r.screenshot_expires_at>now() and r.screenshot_deleted_at is null
    and (r.submitted_at is not null or r.created_at>now()-interval '1 hour')))
);
drop policy if exists problem_screenshots_insert_gate on storage.objects;
create policy problem_screenshots_insert_gate on storage.objects as restrictive for insert to authenticated with check(
  bucket_id<>'problem-screenshots' or (auth.uid() is not null and exists(select 1 from public.problem_reports r where r.screenshot_path=name
    and r.reporter_id=auth.uid() and r.submitted_at is null and r.screenshot_deleted_at is null and r.created_at>now()-interval '1 hour'))
);
drop policy if exists problem_screenshots_update_gate on storage.objects;
create policy problem_screenshots_update_gate on storage.objects as restrictive for update to anon, authenticated
  using(bucket_id<>'problem-screenshots') with check(bucket_id<>'problem-screenshots');
drop policy if exists problem_screenshots_delete_gate on storage.objects;
create policy problem_screenshots_delete_gate on storage.objects as restrictive for delete to anon, authenticated
  using(bucket_id<>'problem-screenshots');

drop policy if exists problem_screenshots_anon_gate on storage.objects;
create policy problem_screenshots_anon_gate on storage.objects as restrictive for all to anon
  using(bucket_id<>'problem-screenshots') with check(bucket_id<>'problem-screenshots');
