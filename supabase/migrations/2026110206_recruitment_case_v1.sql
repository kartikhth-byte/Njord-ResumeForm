-- Recruitment case v1 (single organization).
-- Spec: docs/recruitment-flow.md, docs/platform-review-findings.md §3–4.
-- Additive only: no existing table or status is changed. Writes go through the
-- RPCs below (security definer); tables are read-only to clients.
-- NOT APPLIED. Run the production baseline audit before applying anywhere.

-- ---------------------------------------------------------------------------
-- Organizations (one seeded organization; multi-organization RLS comes later)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-0000000000a1', 'Default organization', 'default')
on conflict (id) do nothing;

create or replace function public.default_organization_id()
returns uuid
language sql
immutable
as $$ select '00000000-0000-4000-8000-0000000000a1'::uuid $$;

alter table public.organizations enable row level security;
drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations
for select to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));
grant select on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- Cases and append-only events
-- ---------------------------------------------------------------------------
create table if not exists public.recruitment_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.default_organization_id()
    references public.organizations(id) on delete restrict,
  prospect_id uuid not null references public.prospects(id) on delete restrict,
  requirement_id uuid not null references public.requirements(id) on delete restrict,
  application_id uuid references public.applications(id) on delete set null,
  cycle integer not null default 1 check (cycle >= 1),
  status text not null,
  source text not null,
  legacy_status text,
  form_invited_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint recruitment_cases_status_check check (status in (
    'legacy', 'sourced', 'interested', 'contacted', 'confirmed',
    'test_scheduled', 'test_passed', 'test_waived', 'test_failed', 'test_no_show',
    'interview_scheduled', 'interview_passed', 'interview_failed', 'interview_no_show',
    'selected', 'offered', 'offer_accepted', 'offer_declined',
    'documents_pending', 'documents_verified', 'sent_to_principal', 'hired',
    'withdrawn', 'rejected', 'closed'
  )),
  constraint recruitment_cases_source_check check (source in (
    'legacy', 'recruiter', 'interest', 'available', 'needle'
  ))
);

-- One active case per person and requirement; past cycles are kept.
create unique index if not exists recruitment_cases_one_active_uidx
  on public.recruitment_cases (organization_id, prospect_id, requirement_id)
  where status not in ('hired', 'withdrawn', 'rejected', 'closed');
create unique index if not exists recruitment_cases_cycle_uidx
  on public.recruitment_cases (organization_id, prospect_id, requirement_id, cycle);
create index if not exists recruitment_cases_requirement_idx on public.recruitment_cases (requirement_id);
create index if not exists recruitment_cases_application_idx on public.recruitment_cases (application_id);

create table if not exists public.recruitment_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.recruitment_cases(id) on delete restrict,
  organization_id uuid not null,
  event_type text not null check (event_type in (
    'opened', 'source_added', 'transition', 'form_invited', 'principal_send_attested'
  )),
  from_status text,
  to_status text,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists recruitment_case_events_idem_uidx
  on public.recruitment_case_events (case_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists recruitment_case_events_case_idx
  on public.recruitment_case_events (case_id, created_at);

create or replace function public.recruitment_case_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'recruitment_case_events is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists recruitment_case_events_no_update on public.recruitment_case_events;
create trigger recruitment_case_events_no_update
  before update or delete on public.recruitment_case_events
  for each row execute function public.recruitment_case_events_append_only();

alter table public.recruitment_cases enable row level security;
alter table public.recruitment_case_events enable row level security;

drop policy if exists recruitment_cases_read on public.recruitment_cases;
create policy recruitment_cases_read on public.recruitment_cases
for select to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));

drop policy if exists recruitment_case_events_read on public.recruitment_case_events;
create policy recruitment_case_events_read on public.recruitment_case_events
for select to authenticated
using (public.has_permission(auth.uid(), 'view_requirements'));

-- Clients read only; all writes go through the functions below.
revoke all on public.recruitment_cases from anon, authenticated;
revoke all on public.recruitment_case_events from anon, authenticated;
grant select on public.recruitment_cases to authenticated;
grant select on public.recruitment_case_events to authenticated;

-- ---------------------------------------------------------------------------
-- Transition rules
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_case_is_terminal(p_status text)
returns boolean
language sql
immutable
as $$ select p_status in ('hired', 'withdrawn', 'rejected', 'closed') $$;

-- Allowed forward moves (exits to withdrawn/rejected/closed are handled separately).
create or replace function public.recruitment_case_allowed_next(p_status text)
returns text[]
language sql
immutable
as $$
  select case p_status
    when 'sourced'             then array['contacted']
    when 'interested'          then array['contacted']
    when 'contacted'           then array['confirmed']
    when 'confirmed'           then array['test_scheduled', 'test_waived']
    when 'test_scheduled'      then array['test_passed', 'test_failed', 'test_no_show']
    when 'test_failed'         then array['test_scheduled']
    when 'test_no_show'        then array['test_scheduled']
    when 'test_passed'         then array['interview_scheduled']
    when 'test_waived'         then array['interview_scheduled']
    when 'interview_scheduled' then array['interview_passed', 'interview_failed', 'interview_no_show']
    when 'interview_no_show'   then array['interview_scheduled']
    when 'interview_passed'    then array['selected']
    when 'selected'            then array['offered']
    when 'offered'             then array['offer_accepted', 'offer_declined']
    when 'offer_accepted'      then array['documents_pending']
    when 'documents_pending'   then array['documents_verified']
    when 'sent_to_principal'   then array['hired']
    else array[]::text[]
  end
$$;

-- Statuses at or after a passed interview (long-form invite allowed).
create or replace function public.recruitment_case_post_interview(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in (
    'interview_passed', 'selected', 'offered', 'offer_accepted',
    'documents_pending', 'documents_verified', 'sent_to_principal'
  )
$$;

-- ---------------------------------------------------------------------------
-- RPC: open (or reuse) the active case for a prospect and requirement
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_case_open(
  p_prospect_id uuid,
  p_requirement_id uuid,
  p_source text default 'recruiter',
  p_idempotency_key text default null
)
returns public.recruitment_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  org uuid := public.default_organization_id();
  case_row public.recruitment_cases;
  next_cycle integer;
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not (public.has_permission(actor, 'create_prospects')
          or public.has_permission(actor, 'edit_junction_status')) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_source not in ('recruiter', 'interest', 'available', 'needle') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;

  -- Serialize per person+requirement so concurrent adds converge.
  perform pg_advisory_xact_lock(hashtext(p_prospect_id::text || ':' || p_requirement_id::text));

  select * into case_row
  from public.recruitment_cases
  where organization_id = org
    and prospect_id = p_prospect_id
    and requirement_id = p_requirement_id
    and not public.recruitment_case_is_terminal(status)
  for update;

  if found then
    insert into public.recruitment_case_events
      (case_id, organization_id, event_type, payload, actor_id, idempotency_key)
    values
      (case_row.id, org, 'source_added', jsonb_build_object('source', p_source), actor, p_idempotency_key)
    on conflict (case_id, idempotency_key) where idempotency_key is not null do nothing;
    return case_row;
  end if;

  select coalesce(max(cycle), 0) + 1 into next_cycle
  from public.recruitment_cases
  where organization_id = org and prospect_id = p_prospect_id and requirement_id = p_requirement_id;

  insert into public.recruitment_cases
    (organization_id, prospect_id, requirement_id, cycle, status, source, created_by)
  values
    (org, p_prospect_id, p_requirement_id, next_cycle,
     case when p_source = 'interest' then 'interested' else 'sourced' end,
     p_source, actor)
  returning * into case_row;

  insert into public.recruitment_case_events
    (case_id, organization_id, event_type, to_status, payload, actor_id, idempotency_key)
  values
    (case_row.id, org, 'opened', case_row.status, jsonb_build_object('source', p_source), actor, p_idempotency_key);

  return case_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: move a case to its next status
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_case_transition(
  p_case_id uuid,
  p_to_status text,
  p_reason text default null,
  p_idempotency_key text default null,
  p_expected_version integer default null
)
returns public.recruitment_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  case_row public.recruitment_cases;
  from_status text;
  reason_text text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.recruitment_case_events
    where case_id = p_case_id and idempotency_key = p_idempotency_key
  ) then
    select * into case_row from public.recruitment_cases where id = p_case_id;
    return case_row;
  end if;

  select * into case_row from public.recruitment_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and case_row.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  from_status := case_row.status;

  if public.recruitment_case_is_terminal(from_status) then
    raise exception 'case_closed' using errcode = '22023';
  end if;

  if p_to_status in ('withdrawn', 'rejected', 'closed') then
    if not (public.has_permission(actor, 'edit_junction_status')
            or public.has_permission(actor, 'withdraw_junctions')) then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
    if reason_text is null then
      raise exception 'reason_required' using errcode = '22023';
    end if;
  else
    if not public.has_permission(actor, 'edit_junction_status') then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
    if p_to_status = 'sent_to_principal' then
      raise exception 'use_recruitment_case_attest_principal_send' using errcode = '22023';
    end if;
    if from_status = 'legacy' then
      -- Backfilled cases: a recruiter places them on the new flow once, with a reason.
      if reason_text is null or p_to_status in ('legacy', 'hired') then
        raise exception 'legacy_triage_requires_reason' using errcode = '22023';
      end if;
    elsif not (p_to_status = any (public.recruitment_case_allowed_next(from_status))) then
      raise exception 'invalid_transition % -> %', from_status, p_to_status using errcode = '22023';
    end if;
    if p_to_status = 'test_waived' and reason_text is null then
      raise exception 'waiver_reason_required' using errcode = '22023';
    end if;
  end if;

  update public.recruitment_cases
  set status = p_to_status,
      updated_at = now(),
      version = version + 1
  where id = p_case_id
  returning * into case_row;

  insert into public.recruitment_case_events
    (case_id, organization_id, event_type, from_status, to_status, reason, actor_id, idempotency_key)
  values
    (case_row.id, case_row.organization_id, 'transition', from_status, p_to_status, reason_text, actor, p_idempotency_key);

  return case_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record the explicit long-form invitation (after a passed interview)
-- The email itself is sent by the existing invite function; this records and gates it.
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_case_record_form_invite(
  p_case_id uuid,
  p_idempotency_key text
)
returns public.recruitment_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  case_row public.recruitment_cases;
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not public.has_permission(actor, 'send_prospect_invites') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;

  select * into case_row from public.recruitment_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.recruitment_case_events
    where case_id = p_case_id and idempotency_key = p_idempotency_key
  ) then
    return case_row;
  end if;

  if not public.recruitment_case_post_interview(case_row.status) then
    raise exception 'form_invite_requires_passed_interview' using errcode = '22023';
  end if;

  update public.recruitment_cases
  set form_invited_at = coalesce(form_invited_at, now()),
      updated_at = now(),
      version = version + 1
  where id = p_case_id
  returning * into case_row;

  insert into public.recruitment_case_events
    (case_id, organization_id, event_type, actor_id, idempotency_key)
  values
    (case_row.id, case_row.organization_id, 'form_invited', actor, p_idempotency_key);

  return case_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: recruiter attests they sent the worksheet to the principal (manual send)
-- Holmes does not deliver it; this records the recruiter's statement.
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_case_attest_principal_send(
  p_case_id uuid,
  p_recipient text,
  p_channel text,
  p_worksheet_version text,
  p_idempotency_key text default null
)
returns public.recruitment_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  case_row public.recruitment_cases;
  submitted timestamptz;
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not public.has_permission(actor, 'edit_junction_status') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_recipient, '')), '') is null
     or nullif(trim(coalesce(p_channel, '')), '') is null
     or nullif(trim(coalesce(p_worksheet_version, '')), '') is null then
    raise exception 'recipient_channel_version_required' using errcode = '22023';
  end if;

  select * into case_row from public.recruitment_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found' using errcode = 'P0002';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.recruitment_case_events
    where case_id = p_case_id and idempotency_key = p_idempotency_key
  ) then
    return case_row;
  end if;

  if case_row.status <> 'documents_verified' then
    raise exception 'attestation_requires_documents_verified' using errcode = '22023';
  end if;

  select a.submitted_at into submitted
  from public.applications a
  where a.id = case_row.application_id;

  if submitted is null then
    raise exception 'attestation_requires_submitted_form' using errcode = '22023';
  end if;

  update public.recruitment_cases
  set status = 'sent_to_principal',
      updated_at = now(),
      version = version + 1
  where id = p_case_id
  returning * into case_row;

  insert into public.recruitment_case_events
    (case_id, organization_id, event_type, from_status, to_status, payload, actor_id, idempotency_key)
  values
    (case_row.id, case_row.organization_id, 'principal_send_attested', 'documents_verified', 'sent_to_principal',
     jsonb_build_object('recipient', trim(p_recipient), 'channel', trim(p_channel),
                        'worksheet_version', trim(p_worksheet_version), 'attested_by', actor),
     actor, p_idempotency_key);

  return case_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: link the submitted long form (application) to its case
-- ---------------------------------------------------------------------------
create or replace function public.recruitment_case_link_application(
  p_case_id uuid,
  p_application_id uuid
)
returns public.recruitment_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  case_row public.recruitment_cases;
  app_prospect uuid;
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not public.has_permission(actor, 'edit_junction_status') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into case_row from public.recruitment_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found' using errcode = 'P0002';
  end if;

  select prospect_id into app_prospect from public.applications where id = p_application_id;
  if app_prospect is null or app_prospect <> case_row.prospect_id then
    raise exception 'application_prospect_mismatch' using errcode = '22023';
  end if;

  update public.recruitment_cases
  set application_id = p_application_id, updated_at = now(), version = version + 1
  where id = p_case_id
  returning * into case_row;

  return case_row;
end;
$$;

revoke all on function public.recruitment_case_open(uuid, uuid, text, text) from public;
revoke all on function public.recruitment_case_transition(uuid, text, text, text, integer) from public;
revoke all on function public.recruitment_case_record_form_invite(uuid, text) from public;
revoke all on function public.recruitment_case_attest_principal_send(uuid, text, text, text, text) from public;
revoke all on function public.recruitment_case_link_application(uuid, uuid) from public;
grant execute on function public.recruitment_case_open(uuid, uuid, text, text) to authenticated;
grant execute on function public.recruitment_case_transition(uuid, text, text, text, integer) to authenticated;
grant execute on function public.recruitment_case_record_form_invite(uuid, text) to authenticated;
grant execute on function public.recruitment_case_attest_principal_send(uuid, text, text, text, text) to authenticated;
grant execute on function public.recruitment_case_link_application(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: one case per existing prospect–requirement link (idempotent)
-- Legacy statuses are not guessed: open links become `legacy` (a recruiter
-- triages them onto the new flow); finished links map to terminal states.
-- ---------------------------------------------------------------------------
insert into public.recruitment_cases
  (organization_id, prospect_id, requirement_id, application_id, cycle, status, source, legacy_status, created_at)
select
  public.default_organization_id(),
  pr.prospect_id,
  pr.requirement_id,
  (select a.id from public.applications a
    where a.prospect_id = pr.prospect_id
    order by a.submitted_at desc nulls last, a.created_at desc
    limit 1),
  1,
  case pr.status
    when 'joined' then 'hired'
    when 'withdrawn' then 'withdrawn'
    when 'customer_rejected' then 'rejected'
    else 'legacy'
  end,
  'legacy',
  pr.status,
  pr.created_at
from public.prospect_requirements pr
where not exists (
  select 1 from public.recruitment_cases c
  where c.prospect_id = pr.prospect_id and c.requirement_id = pr.requirement_id
);

insert into public.recruitment_case_events
  (case_id, organization_id, event_type, to_status, payload, idempotency_key, created_at)
select c.id, c.organization_id, 'opened', c.status,
       jsonb_build_object('source', 'legacy', 'legacy_status', c.legacy_status),
       'backfill:2026110206', c.created_at
from public.recruitment_cases c
where c.source = 'legacy'
  and not exists (
    select 1 from public.recruitment_case_events e
    where e.case_id = c.id and e.idempotency_key = 'backfill:2026110206'
  );
