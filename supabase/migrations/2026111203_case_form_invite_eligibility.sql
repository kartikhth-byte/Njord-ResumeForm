-- One eligibility contract for reviewed candidates and legacy approved profiles.
-- No prospect status rewrite, identity backfill or intake activation.
begin;

create or replace function public.form_invite_candidate_ready(p public.prospects)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(p.status in ('open','contacted','approved')
  and p.archived_at is null and p.deleted_at is null and not p.bounce_flag
  and public.prospect_contact_complete(p)
  and (p.status='approved' or exists (
    select 1 from public.existing_resume_identity_reviews ir
    join public.needle_resume_evidence e on e.id=ir.evidence_id
    join public.prospect_resumes pr on pr.prospect_id=ir.candidate_id
      and pr.resume_id=e.resume_id and pr.organization_id=e.organization_id
    join public.needle_resume_registry r on r.organization_id=e.organization_id and r.resume_id=e.resume_id
    where ir.candidate_id=p.id and e.organization_id=p.organization_id
      and r.original_available and r.status='ready'
  ) or exists (
    select 1 from public.resume_identity_reviews ir
    join public.resume_versions v on v.id=ir.version_id and v.candidate_id=ir.candidate_id
    join public.resume_files f on f.id=v.file_id and f.organization_id=v.organization_id
    join public.prospect_resumes pr on pr.prospect_id=ir.candidate_id
      and pr.organization_id=v.organization_id and pr.resume_id=f.content_hash
    join public.needle_resume_registry r on r.organization_id=pr.organization_id and r.resume_id=pr.resume_id
    where ir.candidate_id=p.id and ir.decision in ('new','link')
      and v.organization_id=p.organization_id and v.identity_status='linked'
      and f.storage_status='stored' and r.original_available and r.status='ready'
  )),false);
$$;
revoke all on function public.form_invite_candidate_ready(public.prospects) from public,anon,authenticated;

create or replace function public.case_form_invite_eligible(p_case uuid,p_prospect uuid,p_require_invited boolean default true)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.recruitment_cases c
  join public.prospects p on p.id=c.prospect_id and p.organization_id=c.organization_id
  join public.requirements r on r.id=c.requirement_id
  where c.id=p_case and p.id=p_prospect and public.form_invite_candidate_ready(p)
    and public.recruitment_case_post_interview(c.status)
    and (not p_require_invited or c.form_invited_at is not null)
    and r.status='open' and r.archived_at is null and r.deleted_at is null);
$$;
revoke all on function public.case_form_invite_eligible(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.case_form_invite_eligible(uuid,uuid,boolean) to service_role;

-- Only the public-entry Function may look up a normalized email. Never expose
-- this RPC to anonymous/authenticated clients or leak eligibility in HTTP output.
create or replace function public.eligible_form_invite_prospects(p_email text)
returns table(id uuid,name text,email text,organization_id uuid)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.id,p.name,p.email,p.organization_id from public.prospects p
 where p.email_normalized=lower(btrim(p_email))
 and exists(select 1 from public.recruitment_cases c where c.prospect_id=p.id
   and public.case_form_invite_eligible(c.id,p.id,true))
 order by p.id limit 2;
$$;
revoke all on function public.eligible_form_invite_prospects(text) from public,anon,authenticated;
grant execute on function public.eligible_form_invite_prospects(text) to service_role;

create or replace function public.reserve_case_form_invite(
  p_case_id uuid,
  p_prospect_id uuid,
  p_actor_user_id uuid,
  p_actor_role_at_event text,
  p_personal_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  prospect_row public.prospects%rowtype;
  inviter_name text;
  normalized_message text := nullif(btrim(p_personal_message), '');
  invite_state text;
  was_invited_at timestamptz;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if public.has_permission(p_actor_user_id, 'send_prospect_invites') is not true then
    raise exception 'Insufficient permissions to send prospect invites';
  end if;

  -- Lock in the same case → prospect → requirement order as draft creation.
  perform 1 from public.recruitment_cases where id=p_case_id and prospect_id=p_prospect_id
    and organization_id=public.needle_pilot_organization_id() for update;
  if not found then raise exception 'eligible_recruitment_case_required'; end if;

  select *
  into prospect_row
  from public.prospects
  where id = p_prospect_id
  for update;

  if not found then
    raise exception 'Prospect not found';
  end if;

  was_invited_at := prospect_row.invited_at;

  perform 1 from public.requirements r join public.recruitment_cases c on c.requirement_id=r.id
    where c.id=p_case_id for share of r;
  if not public.case_form_invite_eligible(p_case_id,p_prospect_id,false) then
    raise exception 'Candidate needs reviewed identity, complete contact details and a passed interview on an open requirement';
  end if;

  if prospect_row.archived_at is not null or prospect_row.deleted_at is not null then
    raise exception 'Archived or deleted prospects cannot be invited';
  end if;

  if prospect_row.bounce_flag then
    raise exception 'Prospect email is currently marked as bounced';
  end if;

  if prospect_row.invited_at is not null
     and prospect_row.invited_at > now() - interval '5 minutes' then
    select coalesce(full_name, email, 'Recruiter')
    into inviter_name
    from public.profiles
    where id = prospect_row.invited_by_recruiter_id;

    return jsonb_build_object(
      'invite_state', 'already_sent',
      'prospect_id', prospect_row.id,
      'prospect_name', prospect_row.name,
      'email', prospect_row.email,
      'invited_at', prospect_row.invited_at,
      'invited_by_recruiter_id', prospect_row.invited_by_recruiter_id,
      'invited_by_recruiter_name', coalesce(inviter_name, 'Recruiter'),
      'actor_user_id', p_actor_user_id,
      'actor_role_at_event', p_actor_role_at_event,
      'message', normalized_message
    );
  end if;

  update public.prospects
  set
    invited_at = now(),
    invited_by_recruiter_id = p_actor_user_id,
    last_activity_at = now(),
    updated_at = now()
  where id = p_prospect_id
  returning *
  into prospect_row;

  select coalesce(full_name, email, 'Recruiter')
  into inviter_name
  from public.profiles
  where id = p_actor_user_id;

  invite_state := case
    when was_invited_at is null then 'sent'
    else 'resent'
  end;

  return jsonb_build_object(
    'invite_state', invite_state,
    'prospect_id', prospect_row.id,
    'prospect_name', prospect_row.name,
    'email', prospect_row.email,
    'invited_at', prospect_row.invited_at,
    'invited_by_recruiter_id', prospect_row.invited_by_recruiter_id,
    'invited_by_recruiter_name', coalesce(inviter_name, 'Recruiter'),
    'actor_user_id', p_actor_user_id,
    'actor_role_at_event', p_actor_role_at_event,
    'message', normalized_message
  );
end;
$function$;

revoke all on function public.reserve_case_form_invite(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_case_form_invite(uuid, uuid, uuid, text, text) to service_role;

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
  where p.applicant_user_id = auth.uid() and public.case_form_invite_eligible(c.id,p.id,true)
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
     or p.organization_id is distinct from c.organization_id or not public.form_invite_candidate_ready(p)
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
     or not public.form_invite_candidate_ready(prospect_row)
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
      and public.case_form_invite_eligible(c.id,prospect_row.id,true)
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
      and p.applicant_user_id = new.user_id and public.case_form_invite_eligible(c.id,p.id,true)
      and p.archived_at is null and p.deleted_at is null and not p.bounce_flag
      and c.form_invited_at is not null and public.recruitment_case_post_interview(c.status)
      and r.status = 'open' and r.archived_at is null and r.deleted_at is null
    for share of c, p, r;
  if not found then raise exception 'application_recruitment_link_required' using errcode = '23514'; end if;
  return new;
end;
$$;

revoke all on function public.get_applicant_claims() from public,anon;
revoke all on function public.start_claimed_application_for_case(uuid,jsonb) from public,anon;
revoke all on function public.claim_applicant_magic_link(text) from public,anon;
revoke all on function public.require_application_recruitment_on_submit() from public,anon,authenticated;
grant execute on function public.get_applicant_claims() to authenticated,service_role;
grant execute on function public.start_claimed_application_for_case(uuid,jsonb) to authenticated,service_role;
grant execute on function public.claim_applicant_magic_link(text) to authenticated,service_role;
commit;
