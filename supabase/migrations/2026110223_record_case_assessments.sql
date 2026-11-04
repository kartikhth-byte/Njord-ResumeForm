-- Record test/interview scheduling and outcomes on the recruitment case.
-- The case event is the source of the assessment details; applications are not changed.
drop function if exists public.recruitment_case_transition(uuid, text, text, text, integer);

create or replace function public.recruitment_case_transition(
  p_case_id uuid,
  p_to_status text,
  p_reason text default null,
  p_idempotency_key text default null,
  p_expected_version integer default null,
  p_assessment jsonb default '{}'::jsonb
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
  assessment jsonb := coalesce(p_assessment, '{}'::jsonb);
  assessment_time timestamptz;
  event_payload jsonb := '{}'::jsonb;
  is_schedule boolean := p_to_status in ('test_scheduled', 'interview_scheduled');
  is_result boolean := p_to_status in (
    'test_passed', 'test_failed', 'test_no_show',
    'interview_passed', 'interview_failed', 'interview_no_show'
  );
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

  if jsonb_typeof(assessment) <> 'object' then
    raise exception 'invalid_assessment_details' using errcode = '22023';
  end if;
  if from_status <> 'legacy' and (is_schedule or is_result) then
    if assessment->>(case when is_schedule then 'scheduled_at' else 'occurred_at' end) is null then
      raise exception 'assessment_time_required' using errcode = '22023';
    end if;
    begin
      assessment_time := (assessment->>(case when is_schedule then 'scheduled_at' else 'occurred_at' end))::timestamptz;
    exception when others then
      raise exception 'invalid_assessment_time' using errcode = '22023';
    end;
    if assessment_time is null then
      raise exception 'assessment_time_required' using errcode = '22023';
    end if;
    if p_to_status in ('test_failed', 'test_no_show', 'interview_failed', 'interview_no_show')
       and reason_text is null then
      raise exception 'assessment_reason_required' using errcode = '22023';
    end if;
    event_payload := jsonb_strip_nulls(jsonb_build_object(
      'assessment', case when p_to_status like 'test_%' then 'test' else 'interview' end,
      'scheduled_at', case when is_schedule then assessment_time end,
      'occurred_at', case when is_result then assessment_time end,
      'location', nullif(trim(assessment->>'location'), ''),
      'note', nullif(trim(assessment->>'note'), '')
    ));
  elsif assessment <> '{}'::jsonb then
    raise exception 'assessment_not_allowed' using errcode = '22023';
  end if;

  update public.recruitment_cases
  set status = p_to_status, updated_at = now(), version = version + 1
  where id = p_case_id
  returning * into case_row;

  insert into public.recruitment_case_events
    (case_id, organization_id, event_type, from_status, to_status, reason, payload, actor_id, idempotency_key)
  values
    (case_row.id, case_row.organization_id, 'transition', from_status, p_to_status,
     reason_text, event_payload, actor, p_idempotency_key);

  return case_row;
end;
$$;

revoke all on function public.recruitment_case_transition(uuid, text, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.recruitment_case_transition(uuid, text, text, text, integer, jsonb)
  to authenticated, service_role;
