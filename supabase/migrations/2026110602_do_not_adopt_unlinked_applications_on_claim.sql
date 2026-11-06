-- Preserve the invite-bound identity checks from 0224 without adopting old
-- unlinked drafts. No application data or associations are changed by this migration.
begin;

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

  -- Claim only the explicitly invited prospect. Existing applications keep
  -- their recorded association; legacy reconciliation is a separate action.

  update public.applicant_magic_link_requests
  set claimed_at = now(), claimed_by = actor
  where id = request_row.id;

  return jsonb_build_object(
    'prospect_id', prospect_row.id,
    'organization_id', prospect_row.organization_id
  );
end;
$$;

revoke all on function public.claim_applicant_magic_link(text) from public, anon, authenticated;
grant execute on function public.claim_applicant_magic_link(text) to authenticated, service_role;

commit;
