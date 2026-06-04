-- Prospect enrollment RPC layer for requirement and junction workflows.
-- Adds the transactional write helpers that sit on top of the prospect and
-- requirement schemas, including note/remark helpers and close-prompt logic.

begin;

create or replace function public.add_prospect_note(
  p_prospect_id uuid,
  p_body text,
  p_visibility text default 'internal',
  p_is_transition_note boolean default false,
  p_correlation_id uuid default null
)
returns public.prospect_notes
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  note_row public.prospect_notes%rowtype;
  normalized_body text := nullif(btrim(p_body), '');
  normalized_visibility text := coalesce(nullif(btrim(p_visibility), ''), 'internal');
  audit_id uuid;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_prospect_notes') then
    raise exception 'Insufficient permissions to add prospect notes';
  end if;

  if normalized_body is null then
    raise exception 'body is required';
  end if;

  if normalized_visibility not in ('internal', 'master_only') then
    raise exception 'Invalid note visibility';
  end if;

  if normalized_visibility = 'master_only' and not public.is_master_recruiter_profile(actor_uuid) then
    raise exception 'Only Master Recruiters can create master_only notes';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  insert into public.prospect_notes (
    prospect_id,
    body,
    author_recruiter_id,
    edited_at,
    edit_locked_at,
    is_transition_note,
    visibility
  )
  values (
    p_prospect_id,
    normalized_body,
    actor_uuid,
    null,
    now() + interval '5 minutes',
    coalesce(p_is_transition_note, false),
    normalized_visibility
  )
  returning * into note_row;

  audit_id := public.write_audit_event(
    'prospect',
    'prospect.note_added',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    p_correlation_id,
    p_prospect_id,
    null,
    null,
    null,
    jsonb_build_object(
      'prospect_note_id', note_row.id,
      'visibility', note_row.visibility,
      'is_transition_note', note_row.is_transition_note,
      'body', normalized_body
    )
  );

  return note_row;
end;
$function$;

revoke all on function public.add_prospect_note(uuid, text, text, boolean, uuid) from public;
grant execute on function public.add_prospect_note(uuid, text, text, boolean, uuid) to authenticated;

create or replace function public.edit_prospect_note(
  p_note_id uuid,
  p_body text,
  p_correlation_id uuid default null
)
returns public.prospect_notes
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  note_row public.prospect_notes%rowtype;
  updated_row public.prospect_notes%rowtype;
  normalized_body text := nullif(btrim(p_body), '');
  note_edit_window interval := interval '5 minutes';
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_prospect_notes') then
    raise exception 'Insufficient permissions to edit prospect notes';
  end if;

  if normalized_body is null then
    raise exception 'body is required';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into note_row
  from public.prospect_notes
  where id = p_note_id
  for update;

  if not found then
    raise exception 'Prospect note not found';
  end if;

  if note_row.author_recruiter_id <> actor_uuid
     and not public.is_master_recruiter_profile(actor_uuid) then
    raise exception 'Only the author or a Master Recruiter can edit this prospect note';
  end if;

  if not public.is_master_recruiter_profile(actor_uuid)
     and now() > coalesce(note_row.edit_locked_at, note_row.created_at + note_edit_window) then
    raise exception 'Prospect note can only be edited within 5 minutes of creation';
  end if;

  update public.prospect_notes
  set
    body = normalized_body,
    edited_at = now()
  where id = note_row.id
  returning * into updated_row;

  perform public.write_audit_event(
    'prospect',
    'prospect.note_edited',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    p_correlation_id,
    updated_row.prospect_id,
    null,
    null,
    null,
    jsonb_build_object(
      'prospect_note_id', updated_row.id,
      'body', normalized_body
    )
  );

  return updated_row;
end;
$function$;

revoke all on function public.edit_prospect_note(uuid, text, uuid) from public;
grant execute on function public.edit_prospect_note(uuid, text, uuid) to authenticated;

create or replace function public.add_requirement_remark(
  p_requirement_id uuid,
  p_body text,
  p_visibility text default 'internal',
  p_is_transition_note boolean default false,
  p_touch_parent boolean default true,
  p_correlation_id uuid default null
)
returns public.requirement_remarks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  remark_row public.requirement_remarks%rowtype;
  normalized_body text := nullif(btrim(p_body), '');
  normalized_visibility text := coalesce(nullif(btrim(p_visibility), ''), 'internal');
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_requirements') then
    raise exception 'Insufficient permissions to add requirement remarks';
  end if;

  if normalized_body is null then
    raise exception 'body is required';
  end if;

  if normalized_visibility not in ('internal', 'master_only') then
    raise exception 'Invalid remark visibility';
  end if;

  if normalized_visibility = 'master_only' and not public.is_master_recruiter_profile(actor_uuid) then
    raise exception 'Only Master Recruiters can create master_only remarks';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  insert into public.requirement_remarks (
    requirement_id,
    body,
    author_recruiter_id,
    edited_at,
    edit_locked_at,
    is_transition_note,
    visibility
  )
  values (
    p_requirement_id,
    normalized_body,
    actor_uuid,
    null,
    now() + interval '5 minutes',
    coalesce(p_is_transition_note, false),
    normalized_visibility
  )
  returning * into remark_row;

  if p_touch_parent then
    update public.requirements
    set
      updated_at = now(),
      version = version + 1
    where id = p_requirement_id;
  end if;

  perform public.write_audit_event(
    'requirement',
    'requirement.remark_added',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    p_correlation_id,
    null,
    p_requirement_id,
    null,
    null,
    jsonb_build_object(
      'requirement_remark_id', remark_row.id,
      'visibility', remark_row.visibility,
      'is_transition_note', remark_row.is_transition_note,
      'body', normalized_body
    )
  );

  return remark_row;
end;
$function$;

revoke all on function public.add_requirement_remark(uuid, text, text, boolean, boolean, uuid) from public;
grant execute on function public.add_requirement_remark(uuid, text, text, boolean, boolean, uuid) to authenticated;

create or replace function public.edit_requirement_remark(
  p_remark_id uuid,
  p_body text,
  p_touch_parent boolean default true,
  p_correlation_id uuid default null
)
returns public.requirement_remarks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  remark_row public.requirement_remarks%rowtype;
  updated_row public.requirement_remarks%rowtype;
  normalized_body text := nullif(btrim(p_body), '');
  note_edit_window interval := interval '5 minutes';
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_requirements') then
    raise exception 'Insufficient permissions to edit requirement remarks';
  end if;

  if normalized_body is null then
    raise exception 'body is required';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into remark_row
  from public.requirement_remarks
  where id = p_remark_id
  for update;

  if not found then
    raise exception 'Requirement remark not found';
  end if;

  if remark_row.author_recruiter_id <> actor_uuid
     and not public.is_master_recruiter_profile(actor_uuid) then
    raise exception 'Only the author or a Master Recruiter can edit this requirement remark';
  end if;

  if not public.is_master_recruiter_profile(actor_uuid)
     and now() > coalesce(remark_row.edit_locked_at, remark_row.created_at + note_edit_window) then
    raise exception 'Requirement remark can only be edited within 5 minutes of creation';
  end if;

  update public.requirement_remarks
  set
    body = normalized_body,
    edited_at = now()
  where id = remark_row.id
  returning * into updated_row;

  if p_touch_parent then
    update public.requirements
    set
      updated_at = now(),
      version = version + 1
    where id = updated_row.requirement_id;
  end if;

  perform public.write_audit_event(
    'requirement',
    'requirement.remark_edited',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    p_correlation_id,
    null,
    updated_row.requirement_id,
    null,
    null,
    jsonb_build_object(
      'requirement_remark_id', updated_row.id,
      'body', normalized_body
    )
  );

  return updated_row;
end;
$function$;

revoke all on function public.edit_requirement_remark(uuid, text, boolean, uuid) from public;
grant execute on function public.edit_requirement_remark(uuid, text, boolean, uuid) to authenticated;

create or replace function public.compute_should_prompt_close(
  p_requirement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.requirements r
    where r.id = p_requirement_id
      and r.status = 'open'
      and (
        select count(*)
        from public.prospect_requirements pr
        where pr.requirement_id = r.id
          and pr.status = 'joined'
      ) >= r.positions_required
  );
$function$;

revoke all on function public.compute_should_prompt_close(uuid) from public;
grant execute on function public.compute_should_prompt_close(uuid) to authenticated;

create or replace function public.create_prospect_with_requirement(
  p_requirement_id uuid,
  p_name text,
  p_dob date,
  p_exp_in_rank_months integer,
  p_previous_employer text default null,
  p_is_first_time_at_sea boolean default false,
  p_telephone text default null,
  p_email text default null,
  p_nationality_id uuid default null,
  p_lead_source text default null,
  p_correlation_id uuid default null
)
returns table (
  prospect_id uuid,
  prospect_requirement_id uuid,
  requirement_id uuid,
  req_id_display text,
  prospect_status text,
  junction_status text,
  should_prompt_close_requirement boolean,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  requirement_row public.requirements%rowtype;
  prospect_row public.prospects%rowtype;
  prospect_requirement_row public.prospect_requirements%rowtype;
  normalized_email text := lower(btrim(p_email));
  live_email_conflict boolean;
  requirement_nationality_count integer;
  requirement_nationality_id uuid;
  final_nationality_id uuid;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'name is required';
  end if;

  if p_dob is null then
    raise exception 'dob is required';
  end if;

  if p_exp_in_rank_months is null then
    raise exception 'exp_in_rank_months is required';
  end if;

  if nullif(btrim(p_telephone), '') is null then
    raise exception 'telephone is required';
  end if;

  if nullif(btrim(p_email), '') is null then
    raise exception 'email is required';
  end if;

  if not public.has_permission(actor_uuid, 'create_prospects') then
    raise exception 'Insufficient permissions to create prospects';
  end if;

  if not public.has_permission(actor_uuid, 'edit_junction_status') then
    raise exception 'Insufficient permissions to attach prospects to requirements';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into requirement_row
  from public.requirements
  where id = p_requirement_id
  for update;

  if not found then
    raise exception 'Requirement not found';
  end if;

  if requirement_row.status <> 'open' then
    raise exception 'Prospects can only be added to open requirements';
  end if;

  select count(*)::integer
  into requirement_nationality_count
  from public.requirement_nationalities
  where requirement_id = requirement_row.id;

  if requirement_nationality_count = 1 then
    select country_id
    into requirement_nationality_id
    from public.requirement_nationalities
    where requirement_id = requirement_row.id
    limit 1;

    if p_nationality_id is null then
      final_nationality_id := requirement_nationality_id;
    elsif p_nationality_id <> requirement_nationality_id then
      raise exception 'Prospect nationality must match the single requirement nationality';
    else
      final_nationality_id := p_nationality_id;
    end if;
  elsif requirement_nationality_count > 1 then
    if p_nationality_id is null then
      raise exception 'Prospect nationality is required because the requirement has multiple nationality preferences';
    end if;

    if not exists (
      select 1
      from public.requirement_nationalities
      where requirement_id = requirement_row.id
        and country_id = p_nationality_id
    ) then
      raise exception 'Prospect nationality must match one of the requirement preferences';
    end if;

    final_nationality_id := p_nationality_id;
  else
    if p_nationality_id is null then
      raise exception 'Prospect nationality is required';
    end if;

    final_nationality_id := p_nationality_id;
  end if;

  if exists (
    select 1
    from public.prospects p
    where p.email_normalized = normalized_email
      and p.archived_at is null
      and p.deleted_at is null
  ) then
    raise exception 'A live prospect with this email already exists';
  end if;

  begin
    insert into public.prospects (
      name,
      dob,
      nationality_id,
      rank_applied_for_id,
      vessel_type_id,
      exp_in_rank_months,
      previous_employer,
      is_first_time_at_sea,
      telephone,
      email,
      lead_source,
      status,
      created_by_recruiter_id
    )
    values (
      p_name,
      p_dob,
      final_nationality_id,
      requirement_row.rank_id,
      requirement_row.vessel_type_id,
      p_exp_in_rank_months,
      p_previous_employer,
      coalesce(p_is_first_time_at_sea, false),
      p_telephone,
      p_email,
      p_lead_source,
      'open',
      actor_uuid
    )
    returning * into prospect_row;
  exception
    when unique_violation then
      raise exception 'A live prospect with this email already exists';
  end;

  insert into public.prospect_requirements (
    prospect_id,
    requirement_id,
    status,
    assigned_by_recruiter_id,
    last_transition_by_recruiter_id
  )
  values (
    prospect_row.id,
    requirement_row.id,
    'shortlisted',
    actor_uuid,
    null
  )
  returning * into prospect_requirement_row;

  perform public.write_audit_event(
    'prospect',
    'prospect.created',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    v_correlation_id,
    prospect_row.id,
    null,
    null,
    null,
    jsonb_build_object(
      'name', prospect_row.name,
      'dob', prospect_row.dob,
      'nationality_id', prospect_row.nationality_id,
      'rank_applied_for_id', prospect_row.rank_applied_for_id,
      'vessel_type_id', prospect_row.vessel_type_id,
      'exp_in_rank_months', prospect_row.exp_in_rank_months,
      'previous_employer', prospect_row.previous_employer,
      'is_first_time_at_sea', prospect_row.is_first_time_at_sea,
      'telephone', prospect_row.telephone,
      'email', prospect_row.email,
      'lead_source', prospect_row.lead_source,
      'requirement_id', requirement_row.id,
      'req_id_display', requirement_row.req_id_display
    )
  );

  perform public.write_audit_event(
    'prospect_requirement',
    'prospect_requirement.created',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    v_correlation_id,
    prospect_row.id,
    requirement_row.id,
    prospect_requirement_row.id,
    null,
    jsonb_build_object(
      'status', prospect_requirement_row.status,
      'assigned_by_recruiter_id', prospect_requirement_row.assigned_by_recruiter_id
    )
  );

  prospect_id := prospect_row.id;
  prospect_requirement_id := prospect_requirement_row.id;
  requirement_id := requirement_row.id;
  req_id_display := requirement_row.req_id_display;
  prospect_status := prospect_row.status;
  junction_status := prospect_requirement_row.status;
  should_prompt_close_requirement := public.compute_should_prompt_close(requirement_row.id);
  correlation_id := v_correlation_id;

  return next;
end;
$function$;

revoke all on function public.create_prospect_with_requirement(uuid, text, date, integer, text, boolean, text, text, uuid, text, uuid) from public;
grant execute on function public.create_prospect_with_requirement(uuid, text, date, integer, text, boolean, text, text, uuid, text, uuid) to authenticated;

create or replace function public.attach_existing_prospect_to_requirement(
  p_prospect_id uuid,
  p_requirement_id uuid,
  p_correlation_id uuid default null
)
returns table (
  prospect_id uuid,
  prospect_requirement_id uuid,
  requirement_id uuid,
  req_id_display text,
  prospect_status text,
  junction_status text,
  should_prompt_close_requirement boolean,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  prospect_row public.prospects%rowtype;
  requirement_row public.requirements%rowtype;
  prospect_requirement_row public.prospect_requirements%rowtype;
  requirement_nationality_count integer;
  requirement_nationality_id uuid;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_junction_status') then
    raise exception 'Insufficient permissions to attach prospects to requirements';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into prospect_row
  from public.prospects
  where id = p_prospect_id
  for update;

  if not found then
    raise exception 'Prospect not found';
  end if;

  if prospect_row.deleted_at is not null or prospect_row.archived_at is not null then
    raise exception 'Archived or deleted prospects cannot be attached to requirements';
  end if;

  if prospect_row.status not in ('open', 'contacted', 'approved') then
    raise exception 'Only live prospects can be attached to requirements';
  end if;

  select *
  into requirement_row
  from public.requirements
  where id = p_requirement_id
  for update;

  if not found then
    raise exception 'Requirement not found';
  end if;

  if requirement_row.status <> 'open' then
    raise exception 'Prospects can only be attached to open requirements';
  end if;

  if prospect_row.rank_applied_for_id <> requirement_row.rank_id then
    raise exception 'Prospect rank must match the requirement rank';
  end if;

  select count(*)::integer
  into requirement_nationality_count
  from public.requirement_nationalities
  where requirement_id = requirement_row.id;

  if requirement_nationality_count = 1 then
    select country_id
    into requirement_nationality_id
    from public.requirement_nationalities
    where requirement_id = requirement_row.id
    limit 1;

    if prospect_row.nationality_id is null then
      raise exception 'Prospect nationality is required';
    end if;

    if prospect_row.nationality_id <> requirement_nationality_id then
      raise exception 'Prospect nationality must match the single requirement nationality';
    end if;
  elsif requirement_nationality_count > 1 then
    if prospect_row.nationality_id is null then
      raise exception 'Prospect nationality is required because the requirement has multiple nationality preferences';
    end if;

    if not exists (
      select 1
      from public.requirement_nationalities
      where requirement_id = requirement_row.id
        and country_id = prospect_row.nationality_id
    ) then
      raise exception 'Prospect nationality must match one of the requirement preferences';
    end if;
  end if;

  insert into public.prospect_requirements (
    prospect_id,
    requirement_id,
    status,
    assigned_by_recruiter_id,
    last_transition_by_recruiter_id
  )
  values (
    prospect_row.id,
    requirement_row.id,
    'shortlisted',
    actor_uuid,
    null
  )
  returning * into prospect_requirement_row;

  perform public.write_audit_event(
    'prospect_requirement',
    'prospect_requirement.created',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    v_correlation_id,
    prospect_row.id,
    requirement_row.id,
    prospect_requirement_row.id,
    null,
    jsonb_build_object(
      'status', prospect_requirement_row.status,
      'assigned_by_recruiter_id', prospect_requirement_row.assigned_by_recruiter_id
    )
  );

  prospect_id := prospect_row.id;
  prospect_requirement_id := prospect_requirement_row.id;
  requirement_id := requirement_row.id;
  req_id_display := requirement_row.req_id_display;
  prospect_status := prospect_row.status;
  junction_status := prospect_requirement_row.status;
  should_prompt_close_requirement := public.compute_should_prompt_close(requirement_row.id);
  correlation_id := v_correlation_id;

  return next;
end;
$function$;

revoke all on function public.attach_existing_prospect_to_requirement(uuid, uuid, uuid) from public;
grant execute on function public.attach_existing_prospect_to_requirement(uuid, uuid, uuid) to authenticated;

create or replace function public.transition_requirement_status(
  p_requirement_id uuid,
  p_new_status text,
  p_expected_version integer,
  p_closure_reason text default null,
  p_note_body text default null,
  p_note_visibility text default 'internal',
  p_correlation_id uuid default null
)
returns table (
  requirement_id uuid,
  req_id_display text,
  status text,
  version integer,
  date_closed date,
  should_prompt_close_requirement boolean,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  requirement_row public.requirements%rowtype;
  updated_row public.requirements%rowtype;
  normalized_status text := lower(btrim(p_new_status));
  normalized_closure_reason text := nullif(btrim(p_closure_reason), '');
  normalized_note_body text := nullif(btrim(p_note_body), '');
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'transition_requirements') then
    raise exception 'Insufficient permissions to transition requirements';
  end if;

  if normalized_status not in ('open', 'closed', 'cancelled') then
    raise exception 'Invalid requirement status';
  end if;

  if p_expected_version is null then
    raise exception 'expected_version is required';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into requirement_row
  from public.requirements
  where id = p_requirement_id
  for update;

  if not found then
    raise exception 'Requirement not found';
  end if;

  if requirement_row.version <> p_expected_version then
    raise exception 'Stale requirement version: expected %, found %', p_expected_version, requirement_row.version;
  end if;

  if requirement_row.status = normalized_status then
    raise exception 'Requirement is already in status %', normalized_status;
  end if;

  if requirement_row.status = 'open' and normalized_status = 'cancelled' and normalized_closure_reason is null then
    raise exception 'closure_reason is required when cancelling a requirement';
  end if;

  if requirement_row.status in ('closed', 'cancelled') and normalized_status = 'open' and normalized_note_body is null then
    raise exception 'A note is required when reopening a requirement';
  end if;

  if normalized_note_body is not null then
    perform public.add_requirement_remark(
      requirement_row.id,
      normalized_note_body,
      coalesce(nullif(btrim(p_note_visibility), ''), 'internal'),
      true,
      false,
      v_correlation_id
    );
  end if;

  update public.requirements
  set
    status = normalized_status,
    closure_reason = case
      when normalized_status = 'cancelled' then normalized_closure_reason
      when normalized_status = 'open' then null
      else null
    end,
    version = version + 1
  where id = requirement_row.id
  returning * into updated_row;

  perform public.write_audit_event(
    'requirement',
    case
      when normalized_status = 'cancelled' then 'requirement.cancelled'
      else 'requirement.status_changed'
    end,
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    v_correlation_id,
    null,
    updated_row.id,
    null,
    null,
    jsonb_build_object(
      'req_id_display', updated_row.req_id_display,
      'from_status', requirement_row.status,
      'to_status', updated_row.status,
      'closure_reason', updated_row.closure_reason,
      'date_closed', updated_row.date_closed
    )
  );

  requirement_id := updated_row.id;
  req_id_display := updated_row.req_id_display;
  status := updated_row.status;
  version := updated_row.version;
  date_closed := updated_row.date_closed;
  should_prompt_close_requirement := public.compute_should_prompt_close(updated_row.id);
  correlation_id := v_correlation_id;

  return next;
end;
$function$;

revoke all on function public.transition_requirement_status(uuid, text, integer, text, text, text, uuid) from public;
grant execute on function public.transition_requirement_status(uuid, text, integer, text, text, text, uuid) to authenticated;

create or replace function public.transfer_requirement_owner(
  p_requirement_id uuid,
  p_new_owner_recruiter_id uuid,
  p_expected_version integer,
  p_correlation_id uuid default null
)
returns table (
  requirement_id uuid,
  req_id_display text,
  owner_recruiter_id uuid,
  version integer,
  should_prompt_close_requirement boolean,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  requirement_row public.requirements%rowtype;
  updated_row public.requirements%rowtype;
  new_owner_role text;
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_requirement_owner') then
    raise exception 'Insufficient permissions to transfer requirement owner';
  end if;

  if p_new_owner_recruiter_id is null then
    raise exception 'new_owner_recruiter_id is required';
  end if;

  if p_expected_version is null then
    raise exception 'expected_version is required';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into requirement_row
  from public.requirements
  where id = p_requirement_id
  for update;

  if not found then
    raise exception 'Requirement not found';
  end if;

  if requirement_row.version <> p_expected_version then
    raise exception 'Stale requirement version: expected %, found %', p_expected_version, requirement_row.version;
  end if;

  if requirement_row.owner_recruiter_id = p_new_owner_recruiter_id then
    raise exception 'The requirement is already assigned to this owner';
  end if;

  if not public.is_recruiter_profile(p_new_owner_recruiter_id) then
    raise exception 'owner_recruiter_id must reference a recruiter profile';
  end if;

  select role_name into new_owner_role
  from public.get_user_role(p_new_owner_recruiter_id);

  if new_owner_role is null or new_owner_role not in ('Master Recruiter', 'Recruiter') then
    raise exception 'Requirement owners must be Master Recruiters or Recruiters';
  end if;

  update public.requirements
  set
    owner_recruiter_id = p_new_owner_recruiter_id,
    version = version + 1
  where id = requirement_row.id
  returning * into updated_row;

  perform public.write_audit_event(
    'requirement',
    'requirement.owner_changed',
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    v_correlation_id,
    null,
    updated_row.id,
    null,
    null,
    jsonb_build_object(
      'req_id_display', updated_row.req_id_display,
      'from_owner_recruiter_id', requirement_row.owner_recruiter_id,
      'to_owner_recruiter_id', updated_row.owner_recruiter_id
    )
  );

  requirement_id := updated_row.id;
  req_id_display := updated_row.req_id_display;
  owner_recruiter_id := updated_row.owner_recruiter_id;
  version := updated_row.version;
  should_prompt_close_requirement := public.compute_should_prompt_close(updated_row.id);
  correlation_id := v_correlation_id;

  return next;
end;
$function$;

revoke all on function public.transfer_requirement_owner(uuid, uuid, integer, uuid) from public;
grant execute on function public.transfer_requirement_owner(uuid, uuid, integer, uuid) to authenticated;

create or replace function public.transition_junction_status(
  p_prospect_requirement_id uuid,
  p_new_status text,
  p_expected_version integer,
  p_withdrawal_reason text default null,
  p_note_body text default null,
  p_note_visibility text default 'internal',
  p_correlation_id uuid default null
)
returns table (
  prospect_requirement_id uuid,
  prospect_id uuid,
  requirement_id uuid,
  status text,
  version integer,
  should_prompt_close_requirement boolean,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  junction_row public.prospect_requirements%rowtype;
  updated_row public.prospect_requirements%rowtype;
  normalized_status text := lower(btrim(p_new_status));
  normalized_withdrawal_reason text := nullif(btrim(p_withdrawal_reason), '');
  normalized_note_body text := nullif(btrim(p_note_body), '');
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  note_is_required boolean := false;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if normalized_status not in (
    'shortlisted',
    'submitted_to_customer',
    'customer_reviewing',
    'customer_accepted',
    'customer_rejected',
    'joined',
    'withdrawn'
  ) then
    raise exception 'Invalid prospect requirement status';
  end if;

  if normalized_status = 'withdrawn' then
    if not public.has_permission(actor_uuid, 'withdraw_junctions') then
      raise exception 'Insufficient permissions to withdraw junctions';
    end if;
  elsif not public.has_permission(actor_uuid, 'edit_junction_status') then
    raise exception 'Insufficient permissions to edit junction status';
  end if;

  if p_expected_version is null then
    raise exception 'expected_version is required';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  select *
  into junction_row
  from public.prospect_requirements
  where id = p_prospect_requirement_id
  for update;

  if not found then
    raise exception 'Prospect requirement not found';
  end if;

  if junction_row.version <> p_expected_version then
    raise exception 'Stale prospect requirement version: expected %, found %', p_expected_version, junction_row.version;
  end if;

  if junction_row.status = normalized_status then
    raise exception 'Prospect requirement is already in status %', normalized_status;
  end if;

  note_is_required := (
    (junction_row.status = 'submitted_to_customer' and normalized_status = 'shortlisted')
    or (junction_row.status = 'customer_accepted' and normalized_status = 'customer_rejected')
  );

  if note_is_required and normalized_note_body is null then
    raise exception 'A note is required for this junction transition';
  end if;

  if normalized_status = 'withdrawn' and normalized_withdrawal_reason is null then
    raise exception 'withdrawal_reason is required when withdrawing a prospect requirement';
  end if;

  if normalized_note_body is not null then
    -- Requirement-side note history is intentionally used for junction transition notes
    -- so the workflow history remains attached to the requirement record.
    perform public.add_requirement_remark(
      junction_row.requirement_id,
      normalized_note_body,
      coalesce(nullif(btrim(p_note_visibility), ''), 'internal'),
      true,
      false,
      v_correlation_id
    );
  end if;

  update public.prospect_requirements
  set
    status = normalized_status,
    withdrawal_reason = case
      when normalized_status = 'withdrawn' then normalized_withdrawal_reason
      when normalized_status = 'shortlisted' then null
      else withdrawal_reason
    end,
    last_transition_by_recruiter_id = actor_uuid,
    version = version + 1
  where id = junction_row.id
  returning * into updated_row;

  perform public.write_audit_event(
    'prospect_requirement',
    case
      when normalized_status = 'withdrawn' then 'prospect_requirement.withdrawn'
      else 'prospect_requirement.status_changed'
    end,
    'recruiter',
    actor_uuid,
    actor_role,
    null,
    v_correlation_id,
    updated_row.prospect_id,
    updated_row.requirement_id,
    updated_row.id,
    null,
    jsonb_build_object(
      'from_status', junction_row.status,
      'to_status', updated_row.status,
      'withdrawal_reason', updated_row.withdrawal_reason
    )
  );

  prospect_requirement_id := updated_row.id;
  prospect_id := updated_row.prospect_id;
  requirement_id := updated_row.requirement_id;
  status := updated_row.status;
  version := updated_row.version;
  should_prompt_close_requirement := public.compute_should_prompt_close(updated_row.requirement_id);
  correlation_id := v_correlation_id;

  return next;
end;
$function$;

revoke all on function public.transition_junction_status(uuid, text, integer, text, text, text, uuid) from public;
grant execute on function public.transition_junction_status(uuid, text, integer, text, text, text, uuid) to authenticated;

create or replace function public.bulk_withdraw_junctions(
  p_prospect_requirement_ids uuid[],
  p_withdrawal_reason text,
  p_expected_versions integer[] default null,
  p_correlation_id uuid default null
)
returns table (
  correlation_id uuid,
  processed_count integer,
  skipped_count integer,
  not_found_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_role text;
  withdrawal_reason_text text := nullif(btrim(p_withdrawal_reason), '');
  v_correlation_id uuid := coalesce(p_correlation_id, gen_random_uuid());
  junction_row record;
  processed integer := 0;
  found_count integer := 0;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'withdraw_junctions') then
    raise exception 'Insufficient permissions to withdraw junctions';
  end if;

  if withdrawal_reason_text is null then
    raise exception 'withdrawal_reason is required';
  end if;

  if coalesce(array_length(p_prospect_requirement_ids, 1), 0) = 0 then
    raise exception 'At least one prospect requirement id is required';
  end if;

  if p_expected_versions is not null
     and array_length(p_expected_versions, 1) is distinct from array_length(p_prospect_requirement_ids, 1) then
    raise exception 'expected_versions must match prospect_requirement_ids length';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  for junction_row in
    select
      pr.*,
      ids.ordinality as request_ordinality,
      case
        when p_expected_versions is null then null
        else p_expected_versions[ids.ordinality]
      end as expected_version
    from unnest(p_prospect_requirement_ids) with ordinality as ids(id, ordinality)
    join public.prospect_requirements pr
      on pr.id = ids.id
    order by ids.ordinality
    for update
  loop
    found_count := found_count + 1;

    if junction_row.expected_version is not null
       and junction_row.version <> junction_row.expected_version then
      raise exception 'Stale prospect requirement version: expected %, found %', junction_row.expected_version, junction_row.version;
    end if;

    if junction_row.status = 'withdrawn' then
      continue;
    end if;

    if junction_row.status not in (
      'shortlisted',
      'submitted_to_customer',
      'customer_reviewing',
      'customer_accepted',
      'customer_rejected'
    ) then
      continue;
    end if;

    update public.prospect_requirements
    set
      status = 'withdrawn',
      withdrawal_reason = withdrawal_reason_text,
      last_transition_by_recruiter_id = actor_uuid,
      version = version + 1
    where id = junction_row.id;

    processed := processed + 1;

    perform public.write_audit_event(
      'prospect_requirement',
      'prospect_requirement.withdrawn',
      'recruiter',
      actor_uuid,
      actor_role,
      null,
      v_correlation_id,
      junction_row.prospect_id,
      junction_row.requirement_id,
      junction_row.id,
      null,
      jsonb_build_object(
        'from_status', junction_row.status,
        'to_status', 'withdrawn',
        'withdrawal_reason', withdrawal_reason_text
      )
    );
  end loop;

  correlation_id := v_correlation_id;
  processed_count := processed;
  skipped_count := greatest(found_count - processed, 0);
  not_found_count := greatest(coalesce(array_length(p_prospect_requirement_ids, 1), 0) - found_count, 0);

  return next;
end;
$function$;

revoke all on function public.bulk_withdraw_junctions(uuid[], text, integer[], uuid) from public;
grant execute on function public.bulk_withdraw_junctions(uuid[], text, integer[], uuid) to authenticated;

commit;
