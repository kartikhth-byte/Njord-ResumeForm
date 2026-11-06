-- Explicit manual send evidence; no email is sent by this operation.
begin;
create or replace function public.recruitment_case_attest_principal_send_v2(
  p_case_id uuid,
  p_recipient text,
  p_channel text,
  p_worksheet_version text,
  p_idempotency_key text,
  p_expected_version integer,
  p_sent_at timestamptz
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

  if case_row.organization_id is distinct from public.needle_pilot_organization_id() then
    raise exception 'permission_denied' using errcode='42501';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.recruitment_case_events
    where case_id = p_case_id and idempotency_key = p_idempotency_key
  ) then
    return case_row;
  end if;

  if p_expected_version is null or case_row.version<>p_expected_version then
    raise exception 'version_conflict' using errcode='40001';
  end if;
  if p_sent_at is null or p_sent_at>now()+interval '5 minutes' then
    raise exception 'valid_send_time_required' using errcode='22023';
  end if;
  if length(p_recipient)>320 or length(p_channel)>100 or length(p_worksheet_version)>200 then
    raise exception 'attestation_details_too_long' using errcode='22023';
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
                        'worksheet_version', trim(p_worksheet_version), 'attested_by', actor, 'sent_at', p_sent_at),
     actor, p_idempotency_key);

  return case_row;
end;
$$;

revoke all on function public.recruitment_case_attest_principal_send_v2(uuid,text,text,text,text,integer,timestamptz) from public,anon;
grant execute on function public.recruitment_case_attest_principal_send_v2(uuid,text,text,text,text,integer,timestamptz) to authenticated;
revoke execute on function public.recruitment_case_attest_principal_send(uuid,text,text,text,text) from authenticated,anon,public;
commit;
