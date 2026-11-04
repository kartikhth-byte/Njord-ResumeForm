-- Preserve prospect note permissions and master-only visibility through
-- SECURITY DEFINER detail/activity RPCs, including historical audit payloads.
begin;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.get_prospect_detail(uuid)',
    'public.get_prospect_activity(uuid,integer)',
    'public.get_requirement_activity(uuid,integer)',
    'public.has_permission(uuid,text)',
    'public.is_master_recruiter_profile(uuid)',
    'public.resolve_audit_actor_display_name(uuid,text,text)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'guard_note_visibility_in_read_rpcs: missing %', signature;
    end if;
  end loop;
end;
$$;

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

  select * into prospect_row
  from public.prospects
  where id = p_prospect_id;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(note) order by note.created_at desc), '[]'::jsonb)
  into notes_json
  from public.prospect_notes note
  where note.prospect_id = p_prospect_id
    and public.has_permission(actor_uuid, 'view_prospect_notes')
    and (
      note.visibility <> 'master_only'
      or public.is_master_recruiter_profile(actor_uuid)
    );

  select coalesce(jsonb_agg(to_jsonb(junction) order by junction.updated_at desc), '[]'::jsonb)
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
      end order by app.created_at desc
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

create or replace function public.get_prospect_activity(p_prospect_id uuid, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  can_view_notes boolean := public.has_permission(actor_uuid, 'view_prospect_notes');
  is_master boolean := public.is_master_recruiter_profile(actor_uuid);
  activity_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log')
     and not public.has_permission(actor_uuid, 'view_prospects') then
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
        'payload', case
          when not is_master and audit.event_type in ('prospect.note_added', 'prospect.note_edited')
            then audit.payload - 'body'
          else audit.payload
        end
      ) order by audit.created_at desc
    ),
    '[]'::jsonb
  )
  into activity_json
  from (
    select audit.*
    from public.audit_log audit
    where audit.prospect_id = p_prospect_id
      and (is_master or audit.actor_user_id = actor_uuid or audit.event_type not like 'export.%')
      and (
        audit.event_type not in ('prospect.note_added', 'prospect.note_edited')
        or (
          can_view_notes
          and (
            is_master
            or (
              audit.payload->>'visibility' is distinct from 'master_only'
              and exists (
                select 1 from public.prospect_notes note
                where note.id::text = audit.payload->>'prospect_note_id'
                  and note.visibility <> 'master_only'
              )
            )
          )
        )
      )
    order by audit.created_at desc
    limit normalized_limit
  ) audit;

  return activity_json;
end;
$function$;

create or replace function public.get_requirement_activity(p_requirement_id uuid, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  is_master boolean := public.is_master_recruiter_profile(actor_uuid);
  activity_json jsonb;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log')
     and not public.has_permission(actor_uuid, 'view_requirements') then
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
        'payload', case
          when not is_master and audit.event_type in ('requirement.remark_added', 'requirement.remark_edited')
            then audit.payload - 'body'
          else audit.payload
        end
      ) order by audit.created_at desc
    ),
    '[]'::jsonb
  )
  into activity_json
  from (
    select audit.*
    from public.audit_log audit
    where audit.requirement_id = p_requirement_id
      and (is_master or audit.actor_user_id = actor_uuid or audit.event_type not like 'export.%')
      and (
        audit.event_type not in ('requirement.remark_added', 'requirement.remark_edited')
        or is_master
        or (
          audit.payload->>'visibility' is distinct from 'master_only'
          and exists (
            select 1 from public.requirement_remarks remark
            where remark.id::text = audit.payload->>'requirement_remark_id'
              and remark.visibility <> 'master_only'
          )
        )
      )
    order by audit.created_at desc
    limit normalized_limit
  ) audit;

  return activity_json;
end;
$function$;

commit;
