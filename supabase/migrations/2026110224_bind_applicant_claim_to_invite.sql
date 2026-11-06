-- Bind applicant redemption and new drafts to the prospect named by the
-- issued magic link. This is identity binding, not multi-organization RLS.
-- Do not expose a second organization to recruiters until tenant isolation ships.
begin;

alter table public.prospects
  add column if not exists organization_id uuid references public.organizations(id);
update public.prospects
set organization_id = public.default_organization_id()
where organization_id is null;
alter table public.prospects
  alter column organization_id set default public.default_organization_id(),
  alter column organization_id set not null;

-- The same candidate email may be invited by two organizations. Each
-- organization's live prospect and claimed applicant must still be unique.
drop index if exists public.prospects_email_live_uidx;
create unique index if not exists prospects_org_email_live_uidx
  on public.prospects (organization_id, email_normalized)
  where archived_at is null and deleted_at is null;
drop index if exists public.prospects_applicant_user_uidx;
create unique index if not exists prospects_org_applicant_user_uidx
  on public.prospects (organization_id, applicant_user_id)
  where applicant_user_id is not null and deleted_at is null;

alter table public.applicant_magic_link_requests
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists claim_token_hash text,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by uuid;
create unique index if not exists applicant_magic_link_requests_claim_token_uidx
  on public.applicant_magic_link_requests (claim_token_hash)
  where claim_token_hash is not null;
alter table public.applicant_magic_link_requests enable row level security;
revoke all on public.applicant_magic_link_requests from anon, authenticated;

create or replace function public.claim_applicant_magic_link(p_claim_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  request_row public.applicant_magic_link_requests%rowtype;
  prospect_row public.prospects%rowtype;
  existing_type text;
begin
  if actor is null or actor_email = '' then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_claim_token_hash is null or p_claim_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_claim' using errcode = '28000';
  end if;

  select * into request_row
  from public.applicant_magic_link_requests
  where claim_token_hash = p_claim_token_hash
  for update;
  if not found or request_row.request_status <> 'sent'
     or request_row.claimed_at is not null
     or request_row.invalidated_at is not null
     or request_row.sent_at is null
     or request_row.sent_at < now() - interval '1 hour'
     or request_row.email_normalized <> actor_email
     or request_row.prospect_id is null
     or request_row.organization_id is null then
    raise exception 'invalid_claim' using errcode = '28000';
  end if;

  select * into prospect_row
  from public.prospects
  where id = request_row.prospect_id
  for update;
  if not found or prospect_row.organization_id <> request_row.organization_id
     or prospect_row.email_normalized <> actor_email
     or prospect_row.status <> 'approved'
     or prospect_row.archived_at is not null
     or prospect_row.deleted_at is not null
     or prospect_row.bounce_flag
     or (prospect_row.applicant_user_id is not null and prospect_row.applicant_user_id <> actor) then
    raise exception 'invalid_claim' using errcode = '28000';
  end if;

  select user_type into existing_type from public.profiles where id = actor;
  if existing_type is not null and existing_type <> 'applicant' then
    raise exception 'invalid_claim' using errcode = '28000';
  end if;
  insert into public.profiles (id, full_name, email, user_type)
  values (actor, prospect_row.name, actor_email, 'applicant')
  on conflict (id) do nothing;

  update public.prospects
  set applicant_user_id = actor, claimed_at = coalesce(claimed_at, now())
  where id = prospect_row.id;

  -- Existing unlinked drafts are associated only when there is no conflict.
  update public.applications
  set prospect_id = prospect_row.id
  where user_id = actor and status = 'new' and submitted_at is null
    and prospect_id is null;

  update public.applicant_magic_link_requests
  set claimed_at = now(), claimed_by = actor
  where id = request_row.id;

  return jsonb_build_object(
    'prospect_id', prospect_row.id,
    'organization_id', prospect_row.organization_id
  );
end;
$$;

create or replace function public.get_applicant_claims()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'prospect_id', p.id,
    'organization_id', p.organization_id,
    'organization_name', o.name
  ) order by o.name, p.id), '[]'::jsonb)
  from public.prospects p
  join public.organizations o on o.id = p.organization_id
  where p.applicant_user_id = auth.uid()
    and p.status = 'approved'
    and p.archived_at is null and p.deleted_at is null
    and not p.bounce_flag;
$$;

create or replace function public.start_claimed_application(
  p_prospect_id uuid,
  p_initial_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  new_id uuid;
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.prospects p
    join public.profiles u on u.id = actor and u.user_type = 'applicant'
    where p.id = p_prospect_id and p.applicant_user_id = actor
      and p.status = 'approved' and p.archived_at is null
      and p.deleted_at is null and not p.bounce_flag
  ) then
    raise exception 'claim_required' using errcode = '42501';
  end if;

  insert into public.applications (user_id, status, prospect_id, created_at, updated_at)
  values (actor, 'new', p_prospect_id, now(), now())
  returning id into new_id;
  insert into public.application_data (application_id, data, created_at, updated_at)
  values (new_id, coalesce(p_initial_data, '{}'::jsonb), now(), now());
  return new_id;
end;
$$;

-- Direct applicant inserts would bypass the prospect binding. Keep the
-- existing recruiter policy and funnel applicant draft creation through RPC.
drop policy if exists applications_insert_own_draft on public.applications;

revoke all on function public.claim_applicant_magic_link(text) from public, anon, authenticated;
revoke all on function public.get_applicant_claims() from public, anon, authenticated;
revoke all on function public.start_claimed_application(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_applicant_magic_link(text) to authenticated, service_role;
grant execute on function public.get_applicant_claims() to authenticated, service_role;
grant execute on function public.start_claimed_application(uuid,jsonb) to authenticated, service_role;

commit;
