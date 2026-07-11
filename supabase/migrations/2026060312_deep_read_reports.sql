-- Deep-read RPCs for prospect-enrollment dashboards and export reporting.

begin;

create or replace function public.resolve_audit_actor_display_name(
  p_actor_user_id uuid,
  p_system_actor text,
  p_actor_role_at_event text
)
returns text
language sql
stable
as $function$
  select coalesce(
    nullif(btrim((select full_name from public.profiles where id = p_actor_user_id)), ''),
    nullif(btrim(p_system_actor), ''),
    nullif(btrim(p_actor_role_at_event), ''),
    'System'
  );
$function$;

revoke all on function public.resolve_audit_actor_display_name(uuid, text, text) from public;

create or replace function public.get_prospect_detail(p_prospect_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  can_view_applications boolean := public.has_permission(actor_uuid, 'view_applications');
  prospect_row public.prospects%rowtype;
  notes_json jsonb;
  junctions_json jsonb;
  applications_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_prospects') then
    raise exception 'Insufficient permissions to view prospect details';
  end if;

  select *
  into prospect_row
  from public.prospects
  where id = p_prospect_id;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(note) order by note.created_at desc),
    '[]'::jsonb
  )
  into notes_json
  from public.prospect_notes note
  where note.prospect_id = p_prospect_id
    and (
      note.visibility <> 'master_only'
      or public.is_master_recruiter_profile(actor_uuid)
    );

  select coalesce(
    jsonb_agg(to_jsonb(junction) order by junction.updated_at desc),
    '[]'::jsonb
  )
  into junctions_json
  from public.prospect_requirements junction
  where junction.prospect_id = p_prospect_id;

  select coalesce(
    jsonb_agg(
      case
        when can_view_applications then
          jsonb_build_object(
            'id', app.id,
            'public_token', app.public_token,
            'reference_number', app.reference_number,
            'status', app.status,
            'submitted_at', app.submitted_at,
            'created_at', app.created_at,
            'updated_at', app.updated_at,
            'prospect_id', app.prospect_id
          )
        else
          jsonb_build_object(
            'id', app.id,
            'reference_number', app.reference_number,
            'status', app.status,
            'submitted_at', app.submitted_at,
            'created_at', app.created_at,
            'updated_at', app.updated_at,
            'prospect_id', app.prospect_id
          )
      end
      order by app.created_at desc
    ),
    '[]'::jsonb
  )
  into applications_json
  from public.applications app
  where app.prospect_id = p_prospect_id;

  return jsonb_build_object(
    'prospect', jsonb_build_object(
      'id', prospect_row.id,
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
      'status', prospect_row.status,
      'first_contacted_at', prospect_row.first_contacted_at,
      'last_terminal_status', prospect_row.last_terminal_status,
      'last_terminal_status_at', prospect_row.last_terminal_status_at,
      'archived_at', prospect_row.archived_at,
      'archive_reason', prospect_row.archive_reason,
      'deleted_at', prospect_row.deleted_at,
      'invited_at', prospect_row.invited_at,
      'claimed_at', prospect_row.claimed_at,
      'applicant_user_id', prospect_row.applicant_user_id,
      'bounce_flag', prospect_row.bounce_flag,
      'created_by_recruiter_id', prospect_row.created_by_recruiter_id,
      'last_activity_at', prospect_row.last_activity_at,
      'created_at', prospect_row.created_at,
      'updated_at', prospect_row.updated_at,
      'version', prospect_row.version
    ),
    'notes', notes_json,
    'junctions', junctions_json,
    'applications', applications_json
  );
end;
$function$;

revoke all on function public.get_prospect_detail(uuid) from public;
grant execute on function public.get_prospect_detail(uuid) to authenticated;

create or replace function public.get_prospect_activity(p_prospect_id uuid, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  activity_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log') and not public.has_permission(actor_uuid, 'view_prospects') then
    raise exception 'Insufficient permissions to view prospect activity';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', audit.id,
        'event_type', audit.event_type,
        'created_at', audit.created_at,
        'actor_type', audit.actor_type,
        'actor_user_id', audit.actor_user_id,
        'actor_role_at_event', audit.actor_role_at_event,
        'system_actor', audit.system_actor,
        'actor_name', public.resolve_audit_actor_display_name(audit.actor_user_id, audit.system_actor, audit.actor_role_at_event),
        'payload', audit.payload
      )
      order by audit.created_at desc
    ),
    '[]'::jsonb
  )
  into activity_json
  from (
    select audit.*
    from public.audit_log audit
    where audit.prospect_id = p_prospect_id
      and (
        public.is_master_recruiter_profile(actor_uuid)
        or audit.actor_user_id = actor_uuid
        or audit.event_type not like 'export.%'
      )
    order by audit.created_at desc
    limit normalized_limit
  ) audit;

  return activity_json;
end;
$function$;

revoke all on function public.get_prospect_activity(uuid, integer) from public;
grant execute on function public.get_prospect_activity(uuid, integer) to authenticated;

create or replace function public.get_requirement_detail(p_requirement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  requirement_row public.requirements%rowtype;
  remarks_json jsonb;
  nationalities_json jsonb;
  junctions_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_requirements') then
    raise exception 'Insufficient permissions to view requirement details';
  end if;

  select *
  into requirement_row
  from public.requirements
  where id = p_requirement_id;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(remark) order by remark.created_at desc),
    '[]'::jsonb
  )
  into remarks_json
  from public.requirement_remarks remark
  where remark.requirement_id = p_requirement_id
    and (
      remark.visibility <> 'master_only'
      or public.is_master_recruiter_profile(actor_uuid)
    );

  select coalesce(
    jsonb_agg(to_jsonb(nationality) order by nationality.country_id),
    '[]'::jsonb
  )
  into nationalities_json
  from public.requirement_nationalities nationality
  where nationality.requirement_id = p_requirement_id;

  select coalesce(
    jsonb_agg(to_jsonb(junction) order by junction.updated_at desc),
    '[]'::jsonb
  )
  into junctions_json
  from public.prospect_requirements junction
  where junction.requirement_id = p_requirement_id;

  return jsonb_build_object(
    'requirement', jsonb_build_object(
      'id', requirement_row.id,
      'req_id_display', requirement_row.req_id_display,
      'req_year_month', requirement_row.req_year_month,
      'req_sequence', requirement_row.req_sequence,
      'date_opened', requirement_row.date_opened,
      'date_closed', requirement_row.date_closed,
      'vessel_name', requirement_row.vessel_name,
      'status', requirement_row.status,
      'positions_required', requirement_row.positions_required,
      'target_days', requirement_row.target_days,
      'owner_recruiter_id', requirement_row.owner_recruiter_id,
      'customer_name', requirement_row.customer_name,
      'closure_reason', requirement_row.closure_reason,
      'created_by_recruiter_id', requirement_row.created_by_recruiter_id,
      'created_at', requirement_row.created_at,
      'updated_at', requirement_row.updated_at,
      'version', requirement_row.version,
      'rank_id', requirement_row.rank_id,
      'vessel_type_id', requirement_row.vessel_type_id
    ),
    'remarks', remarks_json,
    'nationalities', nationalities_json,
    'junctions', junctions_json
  );
end;
$function$;

revoke all on function public.get_requirement_detail(uuid) from public;
grant execute on function public.get_requirement_detail(uuid) to authenticated;

create or replace function public.get_requirement_activity(p_requirement_id uuid, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  activity_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log') and not public.has_permission(actor_uuid, 'view_requirements') then
    raise exception 'Insufficient permissions to view requirement activity';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', audit.id,
        'event_type', audit.event_type,
        'created_at', audit.created_at,
        'actor_type', audit.actor_type,
        'actor_user_id', audit.actor_user_id,
        'actor_role_at_event', audit.actor_role_at_event,
        'system_actor', audit.system_actor,
        'actor_name', public.resolve_audit_actor_display_name(audit.actor_user_id, audit.system_actor, audit.actor_role_at_event),
        'payload', audit.payload
      )
      order by audit.created_at desc
    ),
    '[]'::jsonb
  )
  into activity_json
  from (
    select audit.*
    from public.audit_log audit
    where audit.requirement_id = p_requirement_id
      and (
        public.is_master_recruiter_profile(actor_uuid)
        or audit.actor_user_id = actor_uuid
        or audit.event_type not like 'export.%'
      )
    order by audit.created_at desc
    limit normalized_limit
  ) audit;

  return activity_json;
end;
$function$;

revoke all on function public.get_requirement_activity(uuid, integer) from public;
grant execute on function public.get_requirement_activity(uuid, integer) to authenticated;

create or replace function public.get_cross_entity_audit(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  activity_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log') then
    raise exception 'Insufficient permissions to view audit log';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', audit.id,
        'entity_type', audit.entity_type,
        'event_type', audit.event_type,
        'created_at', audit.created_at,
        'actor_type', audit.actor_type,
        'actor_user_id', audit.actor_user_id,
        'actor_role_at_event', audit.actor_role_at_event,
        'system_actor', audit.system_actor,
        'actor_name', public.resolve_audit_actor_display_name(audit.actor_user_id, audit.system_actor, audit.actor_role_at_event),
        'prospect_id', audit.prospect_id,
        'requirement_id', audit.requirement_id,
        'prospect_requirement_id', audit.prospect_requirement_id,
        'application_id', audit.application_id,
        'payload', audit.payload
      )
      order by audit.created_at desc
    ),
    '[]'::jsonb
  )
  into activity_json
  from (
    select audit.*
    from public.audit_log audit
    where audit.entity_type in ('prospect', 'requirement', 'prospect_requirement', 'application')
    order by audit.created_at desc
    limit normalized_limit
  ) audit;

  return activity_json;
end;
$function$;

revoke all on function public.get_cross_entity_audit(integer) from public;
grant execute on function public.get_cross_entity_audit(integer) to authenticated;

create or replace function public.get_recent_exports(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  allow_team_scope boolean := false;
  export_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  allow_team_scope := public.is_master_recruiter_profile(actor_uuid)
    or public.has_permission(actor_uuid, 'view_audit_log');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', audit.id,
        'event_type', audit.event_type,
        'created_at', audit.created_at,
        'actor_type', audit.actor_type,
        'actor_user_id', audit.actor_user_id,
        'actor_role_at_event', audit.actor_role_at_event,
        'system_actor', audit.system_actor,
        'actor_name', public.resolve_audit_actor_display_name(audit.actor_user_id, audit.system_actor, audit.actor_role_at_event),
        'payload', audit.payload
      )
      order by audit.created_at desc
    ),
    '[]'::jsonb
  )
  into export_json
  from (
    select audit.*
    from public.audit_log audit
    where audit.event_type in ('export.pdf_exported', 'export.csv_exported')
      and (
        allow_team_scope
        or audit.actor_user_id = actor_uuid
      )
    order by audit.created_at desc
    limit normalized_limit
  ) audit;

  return export_json;
end;
$function$;

revoke all on function public.get_recent_exports(integer) from public;
grant execute on function public.get_recent_exports(integer) to authenticated;

commit;
