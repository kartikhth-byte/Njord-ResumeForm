-- Bind new forms to the exact invited recruitment case, at draft creation.
-- Existing forms are neither inferred nor backfilled. Submitted history remains readable.
begin;

create or replace function public.get_applicant_claims()
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'prospect_id', p.id, 'organization_id', p.organization_id,
    'organization_name', o.name, 'case_id', c.id,
    'requirement_reference', r.req_id_display, 'application_id', c.application_id
  ) order by o.name, r.req_id_display, c.id), '[]'::jsonb)
  from public.prospects p
  join public.profiles u on u.id = auth.uid() and u.user_type = 'applicant'
  join public.organizations o on o.id = p.organization_id
  join public.recruitment_cases c on c.prospect_id = p.id and c.organization_id = p.organization_id
  join public.requirements r on r.id = c.requirement_id
  where p.applicant_user_id = auth.uid() and p.status = 'approved'
    and p.archived_at is null and p.deleted_at is null and not p.bounce_flag
    and c.form_invited_at is not null and public.recruitment_case_post_interview(c.status)
    and r.status = 'open' and r.archived_at is null and r.deleted_at is null;
$$;

create or replace function public.start_claimed_application_for_case(
  p_case_id uuid, p_initial_data jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  c public.recruitment_cases%rowtype;
  p public.prospects%rowtype;
  a public.applications%rowtype;
  new_id uuid;
begin
  if actor is null then raise exception 'auth_required' using errcode = '28000'; end if;
  -- Serialize starts by this applicant, including starts for different cases.
  perform 1 from public.profiles where id = actor and user_type = 'applicant' for update;
  if not found then raise exception 'form_invite_required' using errcode = '42501'; end if;
  select * into c from public.recruitment_cases where id = p_case_id for update;
  if not found then raise exception 'form_invite_required' using errcode = '42501'; end if;
  select * into p from public.prospects where id = c.prospect_id for share;
  if not found or p.applicant_user_id is distinct from actor
     or p.organization_id is distinct from c.organization_id or p.status <> 'approved'
     or p.archived_at is not null or p.deleted_at is not null or p.bounce_flag
     or c.form_invited_at is null or not public.recruitment_case_post_interview(c.status) then
    raise exception 'form_invite_required' using errcode = '42501';
  end if;
  perform 1 from public.requirements where id = c.requirement_id
    and status = 'open' and archived_at is null and deleted_at is null for share;
  if not found then raise exception 'requirement_not_open' using errcode = '42501'; end if;
  if c.application_id is not null then
    select * into a from public.applications where id = c.application_id;
    if found and a.user_id = actor and a.prospect_id = p.id
       and a.status = 'new' and a.submitted_at is null then
      return a.id; -- Retried starts preserve the existing draft and its data.
    end if;
    raise exception 'application_already_linked' using errcode = '23505';
  end if;
  if exists (select 1 from public.applications where user_id = actor and status = 'new' and submitted_at is null) then
    raise exception 'existing_draft_requires_review' using errcode = '23505';
  end if;
  insert into public.applications(user_id, status, prospect_id, created_at, updated_at)
  values(actor, 'new', p.id, now(), now()) returning id into new_id;
  insert into public.application_data(application_id, data, created_at, updated_at)
  values(new_id, coalesce(p_initial_data, '{}'::jsonb), now(), now());
  update public.recruitment_cases set application_id = new_id, version = version + 1, updated_at = now()
    where id = c.id;
  insert into public.recruitment_case_events(case_id, organization_id, event_type, from_status, to_status, actor_id, payload)
  values(c.id, c.organization_id, 'source_added', c.status, c.status, actor,
    jsonb_build_object('action', 'invited_application_started', 'application_id', new_id));
  return new_id;
end;
$$;

-- Older clients may start only when the requested prospect has one eligible
-- invitation. Ambiguous cases require selection; never choose the first row.
create or replace function public.start_claimed_application(p_prospect_id uuid, p_initial_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare choices uuid[];
begin
  select array_agg((claim->>'case_id')::uuid) into choices
  from jsonb_array_elements(public.get_applicant_claims()) claim
  where (claim->>'prospect_id')::uuid = p_prospect_id;
  if coalesce(cardinality(choices), 0) = 0 then raise exception 'form_invite_required' using errcode = '42501'; end if;
  if cardinality(choices) <> 1 then raise exception 'select_invited_requirement' using errcode = '22023'; end if;
  return public.start_claimed_application_for_case(choices[1], p_initial_data);
end;
$$;

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

  -- A case-specific invite must still describe this exact person and hiring
  -- process. Legacy/reissued links without a case lead to explicit selection.
  if not exists (
    select 1 from public.recruitment_cases c
    join public.requirements r on r.id = c.requirement_id
    where c.prospect_id = prospect_row.id
      and c.organization_id = prospect_row.organization_id
      and (request_row.case_id is null or c.id = request_row.case_id)
      and c.form_invited_at is not null
      and public.recruitment_case_post_interview(c.status)
      and r.status = 'open' and r.archived_at is null and r.deleted_at is null
  ) then
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
    'organization_id', prospect_row.organization_id,
    'case_id', request_row.case_id
  );
end;
$$;


-- Draft linkage is not task completion. Preserve takeover/permission/version
-- checks while testing submission evidence rather than mere link existence.
create or replace function public.recruitment_assign_work(p_case uuid,p_task text,p_assignee uuid,p_due timestamptz,p_start boolean,p_version integer,p_note text default null)
returns public.recruitment_work_assignments language plpgsql security definer set search_path=public,pg_temp as $$
declare last_status text; c recruitment_cases; old_row recruitment_work_assignments; result recruitment_work_assignments; actor uuid:=auth.uid();
begin
 if public.recruitment_workspace_can_read(p_case) is not true or public.has_permission(actor,'edit_junction_status') is not true then raise exception 'permission_denied'; end if;
 select * into c from recruitment_cases where id=p_case for update;
 if public.recruitment_case_is_terminal(c.status) then raise exception 'case_closed'; end if;
 if p_task not in ('case','contact','test','interview','offer','application','documents','principal','joining') or p_task is null then raise exception 'invalid_task'; end if;
 if p_assignee is not null and public.recruitment_work_eligible_assignee(p_assignee) is not true then raise exception 'invalid_assignee'; end if;
 -- Recruiters can take over for themselves; assigning others is a Master action.
 if p_assignee is distinct from actor and public.is_master_recruiter_profile(actor) is not true then raise exception 'assignment_requires_master'; end if;
 if p_start and not exists(select 1 from requirements where id=c.requirement_id and status='open' and archived_at is null and deleted_at is null) then raise exception 'requirement_not_open'; end if;
 if p_start and (p_assignee is distinct from actor or p_task='case') then raise exception 'invalid_task_start'; end if;
 select to_status into last_status from recruitment_case_events where case_id=p_case
 and event_type in ('transition','principal_send_attested') and from_status is distinct from 'legacy'
 and (case p_task when 'contact' then to_status in ('contacted','confirmed')
 when 'test' then to_status like 'test_%' when 'interview' then to_status like 'interview_%'
 when 'offer' then to_status in ('selected','offered','offer_accepted','offer_declined')
 when 'documents' then to_status like 'documents_%' when 'principal' then to_status='sent_to_principal'
 when 'joining' then to_status='hired' else false end) order by created_at desc,id desc limit 1;
 if p_start and (last_status in ('confirmed','test_passed','test_waived','test_failed','test_no_show','interview_passed','interview_failed','interview_no_show','offer_accepted','offer_declined','documents_verified','sent_to_principal','hired') or (p_task='application' and exists(select 1 from applications a where a.id=c.application_id and a.prospect_id=c.prospect_id and a.submitted_at is not null))) then raise exception 'task_already_completed'; end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'note_too_long'; end if;
 select * into old_row from recruitment_work_assignments where case_id=p_case and task_key=p_task;
 if p_version is null or p_version<>coalesce(old_row.version,0) then raise exception 'version_conflict'; end if;
 insert into recruitment_work_assignments(case_id,task_key,assignee_id,due_at,started_at)
 values(p_case,p_task,p_assignee,p_due,case when p_start then now() end)
 on conflict(case_id,task_key) do update set assignee_id=excluded.assignee_id,due_at=excluded.due_at,
 started_at=case when p_start then now() when recruitment_work_assignments.assignee_id is not distinct from p_assignee then recruitment_work_assignments.started_at else null end,
 version=recruitment_work_assignments.version+1,updated_at=now() returning * into result;
 insert into recruitment_work_history(case_id,task_key,actor_id,previous_assignee_id,assignee_id,due_at,action,note)
 values(p_case,p_task,actor,old_row.assignee_id,p_assignee,p_due,case when p_start then 'started' else 'assigned' end,nullif(trim(p_note),''));
 return result;
end $$;
revoke all on function public.recruitment_assign_work(uuid,text,uuid,timestamptz,boolean,integer,text) from public,anon;
grant execute on function public.recruitment_assign_work(uuid,text,uuid,timestamptz,boolean,integer,text) to authenticated;

-- Reject invites on closed requirements before the edge function sends mail.
create or replace function public.guard_application_invitation_requirement()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.form_invited_at is not null then
    perform 1 from public.requirements where id = new.requirement_id
      and status = 'open' and archived_at is null and deleted_at is null for share;
    if not found then raise exception 'requirement_not_open' using errcode = '42501'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_application_invitation_requirement() from public, anon, authenticated;
drop trigger if exists application_invitation_requirement on public.recruitment_cases;
create trigger application_invitation_requirement before update of form_invited_at on public.recruitment_cases
  for each row execute function public.guard_application_invitation_requirement();

-- Enforce at the database boundary, including direct application updates.
-- Historical submissions and later edits keep their original recorded linkage.
create or replace function public.require_application_recruitment_on_submit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.submitted_at is not null and new.user_id is not distinct from old.user_id
       and new.prospect_id is not distinct from old.prospect_id then return new; end if;
  end if;
  perform c.id from public.recruitment_cases c
    join public.prospects p on p.id = c.prospect_id and p.organization_id = c.organization_id
    join public.requirements r on r.id = c.requirement_id
    where c.application_id = new.id and c.prospect_id = new.prospect_id
      and p.applicant_user_id = new.user_id and p.status = 'approved'
      and p.archived_at is null and p.deleted_at is null and not p.bounce_flag
      and c.form_invited_at is not null and public.recruitment_case_post_interview(c.status)
      and r.status = 'open' and r.archived_at is null and r.deleted_at is null
    for share of c, p, r;
  if not found then raise exception 'application_recruitment_link_required' using errcode = '23514'; end if;
  return new;
end;
$$;
drop trigger if exists application_recruitment_on_submit on public.applications;
create trigger application_recruitment_on_submit before insert or update on public.applications
  for each row execute function public.require_application_recruitment_on_submit();

revoke all on function public.require_application_recruitment_on_submit() from public, anon, authenticated;
revoke all on function public.start_claimed_application_for_case(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.start_claimed_application(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.get_applicant_claims() from public, anon, authenticated;
revoke all on function public.claim_applicant_magic_link(text) from public, anon, authenticated;
grant execute on function public.start_claimed_application_for_case(uuid,jsonb) to authenticated, service_role;
grant execute on function public.start_claimed_application(uuid,jsonb) to authenticated, service_role;
grant execute on function public.get_applicant_claims() to authenticated, service_role;
grant execute on function public.claim_applicant_magic_link(text) to authenticated, service_role;
commit;
