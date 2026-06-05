-- Deep-read RPCs for prospect-enrollment v2.
-- These functions provide audited, SECURITY DEFINER access to detail and
-- activity views for prospects, requirements, and export/report surfaces.

begin;

create or replace function public.current_recruiter_role_name(profile_uuid uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select r.name
  from public.user_roles ur
  join public.roles r
    on r.id = ur.role_id
  where ur.user_id = profile_uuid
  order by case when r.name = public.master_recruiter_role_name() then 0 else 1 end, r.name
  limit 1;
$function$;

revoke all on function public.current_recruiter_role_name(uuid) from public;

create or replace function public.get_prospect_detail(p_prospect_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  correlation_id uuid := gen_random_uuid();
  prospect_row public.prospects%rowtype;
  nationality_json jsonb;
  rank_json jsonb;
  vessel_type_json jsonb;
  notes_json jsonb := '[]'::jsonb;
  applications_json jsonb := '[]'::jsonb;
  junctions_json jsonb := '[]'::jsonb;
  response jsonb;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.has_permission(actor_uuid, 'view_prospects') then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  select p.*
  into prospect_row
  from public.prospects p
  where p.id = p_prospect_id;

  if not found then
    raise exception 'prospect not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object('id', c.id, 'code', c.code, 'name', c.name)
  into nationality_json
  from public.countries c
  where c.id = prospect_row.nationality_id;

  select jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name)
  into rank_json
  from public.ranks r
  where r.id = prospect_row.rank_applied_for_id;

  select jsonb_build_object('id', v.id, 'code', v.code, 'name', v.name)
  into vessel_type_json
  from public.vessel_types v
  where v.id = prospect_row.vessel_type_id;

  if public.has_permission(actor_uuid, 'view_prospect_notes') then
    select coalesce(
      jsonb_agg(note_obj order by note_created_at desc),
      '[]'::jsonb
    )
    into notes_json
    from (
      select
        n.created_at as note_created_at,
        jsonb_build_object(
          'id', n.id,
          'prospect_id', n.prospect_id,
          'body', n.body,
          'author_recruiter_id', n.author_recruiter_id,
          'author_name', coalesce(author.full_name, author.email),
          'created_at', n.created_at,
          'edited_at', n.edited_at,
          'edit_locked_at', n.edit_locked_at,
          'is_transition_note', n.is_transition_note,
          'visibility', n.visibility
        ) as note_obj
      from public.prospect_notes n
      left join public.profiles author
        on author.id = n.author_recruiter_id
      where n.prospect_id = p_prospect_id
        and (
          n.visibility <> 'master_only'
          or public.is_master_recruiter_profile(actor_uuid)
        )
    ) notes_source;
  end if;

  select coalesce(
    jsonb_agg(app_obj order by app_created_at desc),
    '[]'::jsonb
  )
  into applications_json
  from (
    select
      a.created_at as app_created_at,
      jsonb_build_object(
        'id', a.id,
        'user_id', a.user_id,
        'status', a.status,
        'prospect_id', a.prospect_id,
        'submitted_at', a.submitted_at,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) as app_obj
    from public.applications a
    where a.prospect_id = p_prospect_id
  ) applications_source;

  select coalesce(
    jsonb_agg(junction_obj order by junction_created_at desc),
    '[]'::jsonb
  )
  into junctions_json
  from (
    select
      pr.created_at as junction_created_at,
      jsonb_build_object(
        'id', pr.id,
        'prospect_id', pr.prospect_id,
        'requirement_id', pr.requirement_id,
        'status', pr.status,
        'submitted_at', pr.submitted_at,
        'customer_decided_at', pr.customer_decided_at,
        'joined_at', pr.joined_at,
        'withdrawn_at', pr.withdrawn_at,
        'withdrawal_reason', pr.withdrawal_reason,
        'version', pr.version,
        'created_at', pr.created_at,
        'updated_at', pr.updated_at,
        'requirement', jsonb_build_object(
          'id', r.id,
          'req_id_display', r.req_id_display,
          'customer_name', r.customer_name,
          'status', r.status,
          'rank', jsonb_build_object('id', rank_lookup.id, 'code', rank_lookup.code, 'name', rank_lookup.name),
          'vessel_type', jsonb_build_object('id', vessel_lookup.id, 'code', vessel_lookup.code, 'name', vessel_lookup.name)
        )
      ) as junction_obj
    from public.prospect_requirements pr
    join public.requirements r
      on r.id = pr.requirement_id
    join public.ranks rank_lookup
      on rank_lookup.id = r.rank_id
    join public.vessel_types vessel_lookup
      on vessel_lookup.id = r.vessel_type_id
    where pr.prospect_id = p_prospect_id
  ) junctions_source;

  perform public.write_audit_event(
    'prospect',
    'read.detail_viewed',
    'recruiter',
    actor_uuid,
    public.current_recruiter_role_name(actor_uuid),
    null,
    correlation_id,
    p_prospect_id,
    null,
    null,
    null,
    jsonb_build_object(
      'surface', 'prospect_detail',
      'notes_included', public.has_permission(actor_uuid, 'view_prospect_notes')
    )
  );

  response := jsonb_build_object(
    'prospect', to_jsonb(prospect_row) || jsonb_build_object(
      'nationality', nationality_json,
      'rank', rank_json,
      'vessel_type', vessel_type_json
    ),
    'notes', notes_json,
    'applications', applications_json,
    'junctions', junctions_json
  );

  return response;
end;
$function$;

revoke all on function public.get_prospect_detail(uuid) from public;
grant execute on function public.get_prospect_detail(uuid) to authenticated;

create or replace function public.get_prospect_activity(
  p_prospect_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  correlation_id uuid := gen_random_uuid();
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 200));
  activity_json jsonb := '[]'::jsonb;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.has_permission(actor_uuid, 'view_prospects') then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.prospects p
    where p.id = p_prospect_id
  ) then
    raise exception 'prospect not found' using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(activity_obj order by activity_created_at desc),
    '[]'::jsonb
  )
  into activity_json
  from (
    select
      a.created_at as activity_created_at,
      jsonb_build_object(
        'id', a.id,
        'entity_type', a.entity_type,
        'event_type', a.event_type,
        'actor_type', a.actor_type,
        'actor_user_id', a.actor_user_id,
        'actor_name', coalesce(actor.full_name, actor.email),
        'actor_role_at_event', a.actor_role_at_event,
        'system_actor', a.system_actor,
        'correlation_id', a.correlation_id,
        'prospect_id', a.prospect_id,
        'requirement_id', a.requirement_id,
        'prospect_requirement_id', a.prospect_requirement_id,
        'application_id', a.application_id,
        'payload', a.payload,
        'created_at', a.created_at
      ) as activity_obj
    from public.audit_log a
    left join public.profiles actor
      on actor.id = a.actor_user_id
    where a.prospect_id = p_prospect_id
       or a.application_id in (
        select app.id
        from public.applications app
        where app.prospect_id = p_prospect_id
      )
    order by a.created_at desc
    limit limit_value
  ) activity_source;

  perform public.write_audit_event(
    'prospect',
    'read.activity_viewed',
    'recruiter',
    actor_uuid,
    public.current_recruiter_role_name(actor_uuid),
    null,
    correlation_id,
    p_prospect_id,
    null,
    null,
    null,
    jsonb_build_object(
      'surface', 'prospect_activity',
      'limit', limit_value
    )
  );

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
  correlation_id uuid := gen_random_uuid();
  requirement_row public.requirements%rowtype;
  rank_json jsonb;
  vessel_type_json jsonb;
  nationalities_json jsonb := '[]'::jsonb;
  remarks_json jsonb := '[]'::jsonb;
  junctions_json jsonb := '[]'::jsonb;
  response jsonb;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.has_permission(actor_uuid, 'view_requirements') then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  select r.*
  into requirement_row
  from public.requirements r
  where r.id = p_requirement_id;

  if not found then
    raise exception 'requirement not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object('id', rank_lookup.id, 'code', rank_lookup.code, 'name', rank_lookup.name)
  into rank_json
  from public.ranks rank_lookup
  where rank_lookup.id = requirement_row.rank_id;

  select jsonb_build_object('id', vessel_lookup.id, 'code', vessel_lookup.code, 'name', vessel_lookup.name)
  into vessel_type_json
  from public.vessel_types vessel_lookup
  where vessel_lookup.id = requirement_row.vessel_type_id;

  select coalesce(
    jsonb_agg(country_obj order by country_name asc),
    '[]'::jsonb
  )
  into nationalities_json
  from (
    select
      c.name as country_name,
      jsonb_build_object(
        'country_id', rn.country_id,
        'code', c.code,
        'name', c.name
      ) as country_obj
    from public.requirement_nationalities rn
    join public.countries c
      on c.id = rn.country_id
    where rn.requirement_id = p_requirement_id
  ) nationalities_source;

  if public.has_permission(actor_uuid, 'view_requirements') then
    select coalesce(
      jsonb_agg(remark_obj order by remark_created_at desc),
      '[]'::jsonb
    )
    into remarks_json
    from (
      select
        rr.created_at as remark_created_at,
        jsonb_build_object(
          'id', rr.id,
          'requirement_id', rr.requirement_id,
          'body', rr.body,
          'author_recruiter_id', rr.author_recruiter_id,
          'author_name', coalesce(author.full_name, author.email),
          'created_at', rr.created_at,
          'edited_at', rr.edited_at,
          'edit_locked_at', rr.edit_locked_at,
          'is_transition_note', rr.is_transition_note,
          'visibility', rr.visibility
        ) as remark_obj
      from public.requirement_remarks rr
      left join public.profiles author
        on author.id = rr.author_recruiter_id
      where rr.requirement_id = p_requirement_id
        and (
          rr.visibility <> 'master_only'
          or public.is_master_recruiter_profile(actor_uuid)
        )
    ) remarks_source;
  end if;

  select coalesce(
    jsonb_agg(junction_obj order by junction_created_at desc),
    '[]'::jsonb
  )
  into junctions_json
  from (
    select
      pr.created_at as junction_created_at,
      jsonb_build_object(
        'id', pr.id,
        'prospect_id', pr.prospect_id,
        'requirement_id', pr.requirement_id,
        'status', pr.status,
        'submitted_at', pr.submitted_at,
        'customer_decided_at', pr.customer_decided_at,
        'joined_at', pr.joined_at,
        'withdrawn_at', pr.withdrawn_at,
        'withdrawal_reason', pr.withdrawal_reason,
        'version', pr.version,
        'created_at', pr.created_at,
        'updated_at', pr.updated_at,
        'prospect', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email,
          'telephone', p.telephone,
          'status', p.status,
          'archived_at', p.archived_at,
          'deleted_at', p.deleted_at
        )
      ) as junction_obj
    from public.prospect_requirements pr
    join public.prospects p
      on p.id = pr.prospect_id
    where pr.requirement_id = p_requirement_id
  ) junctions_source;

  perform public.write_audit_event(
    'requirement',
    'read.detail_viewed',
    'recruiter',
    actor_uuid,
    public.current_recruiter_role_name(actor_uuid),
    null,
    correlation_id,
    null,
    p_requirement_id,
    null,
    null,
    jsonb_build_object(
      'surface', 'requirement_detail',
      'remarks_included', public.has_permission(actor_uuid, 'view_requirements')
    )
  );

  response := jsonb_build_object(
    'requirement', to_jsonb(requirement_row) || jsonb_build_object(
      'rank', rank_json,
      'vessel_type', vessel_type_json
    ),
    'nationalities', nationalities_json,
    'remarks', remarks_json,
    'junctions', junctions_json
  );

  return response;
end;
$function$;

revoke all on function public.get_requirement_detail(uuid) from public;
grant execute on function public.get_requirement_detail(uuid) to authenticated;

create or replace function public.get_requirement_activity(
  p_requirement_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  correlation_id uuid := gen_random_uuid();
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 200));
  activity_json jsonb := '[]'::jsonb;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.has_permission(actor_uuid, 'view_requirements') then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.requirements r
    where r.id = p_requirement_id
  ) then
    raise exception 'requirement not found' using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(activity_obj order by activity_created_at desc),
    '[]'::jsonb
  )
  into activity_json
  from (
    select
      a.created_at as activity_created_at,
      jsonb_build_object(
        'id', a.id,
        'entity_type', a.entity_type,
        'event_type', a.event_type,
        'actor_type', a.actor_type,
        'actor_user_id', a.actor_user_id,
        'actor_name', coalesce(actor.full_name, actor.email),
        'actor_role_at_event', a.actor_role_at_event,
        'system_actor', a.system_actor,
        'correlation_id', a.correlation_id,
        'prospect_id', a.prospect_id,
        'requirement_id', a.requirement_id,
        'prospect_requirement_id', a.prospect_requirement_id,
        'application_id', a.application_id,
        'payload', a.payload,
        'created_at', a.created_at
      ) as activity_obj
    from public.audit_log a
    left join public.profiles actor
      on actor.id = a.actor_user_id
    where a.requirement_id = p_requirement_id
       or a.prospect_requirement_id in (
        select pr.id
        from public.prospect_requirements pr
        where pr.requirement_id = p_requirement_id
      )
    order by a.created_at desc
    limit limit_value
  ) activity_source;

  perform public.write_audit_event(
    'requirement',
    'read.activity_viewed',
    'recruiter',
    actor_uuid,
    public.current_recruiter_role_name(actor_uuid),
    null,
    correlation_id,
    null,
    p_requirement_id,
    null,
    null,
    jsonb_build_object(
      'surface', 'requirement_activity',
      'limit', limit_value
    )
  );

  return activity_json;
end;
$function$;

revoke all on function public.get_requirement_activity(uuid, integer) from public;
grant execute on function public.get_requirement_activity(uuid, integer) to authenticated;

create or replace function public.get_cross_entity_audit(
  p_limit integer default 100,
  p_entity_type text default null,
  p_event_type text default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  correlation_id uuid := gen_random_uuid();
  limit_value integer := greatest(1, least(coalesce(p_limit, 100), 200));
  activity_json jsonb := '[]'::jsonb;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log') then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(activity_obj order by activity_created_at desc),
    '[]'::jsonb
  )
  into activity_json
  from (
    select
      a.created_at as activity_created_at,
      jsonb_build_object(
        'id', a.id,
        'entity_type', a.entity_type,
        'event_type', a.event_type,
        'actor_type', a.actor_type,
        'actor_user_id', a.actor_user_id,
        'actor_name', coalesce(actor.full_name, actor.email),
        'actor_role_at_event', a.actor_role_at_event,
        'system_actor', a.system_actor,
        'correlation_id', a.correlation_id,
        'prospect_id', a.prospect_id,
        'requirement_id', a.requirement_id,
        'prospect_requirement_id', a.prospect_requirement_id,
        'application_id', a.application_id,
        'payload', a.payload,
        'created_at', a.created_at,
        'entity_summary',
          case
            when a.entity_type = 'prospect' then jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email,
              'status', p.status,
              'archived_at', p.archived_at,
              'deleted_at', p.deleted_at
            )
            when a.entity_type = 'requirement' then jsonb_build_object(
              'id', r.id,
              'req_id_display', r.req_id_display,
              'customer_name', r.customer_name,
              'status', r.status
            )
            when a.entity_type = 'prospect_requirement' then jsonb_build_object(
              'id', pr.id,
              'status', pr.status,
              'prospect_id', pr.prospect_id,
              'requirement_id', pr.requirement_id
            )
            when a.entity_type = 'application' then jsonb_build_object(
              'id', app.id,
              'status', app.status,
              'user_id', app.user_id,
              'prospect_id', app.prospect_id,
              'submitted_at', app.submitted_at
            )
            else jsonb_build_object('entity_type', a.entity_type)
          end
      ) as activity_obj
    from public.audit_log a
    left join public.profiles actor
      on actor.id = a.actor_user_id
    left join public.prospects p
      on p.id = a.prospect_id
    left join public.requirements r
      on r.id = a.requirement_id
    left join public.prospect_requirements pr
      on pr.id = a.prospect_requirement_id
    left join public.applications app
      on app.id = a.application_id
    where (p_entity_type is null or a.entity_type = p_entity_type)
      and (p_event_type is null or a.event_type = p_event_type)
      and (p_correlation_id is null or a.correlation_id = p_correlation_id)
    order by a.created_at desc
    limit limit_value
  ) activity_source;

  perform public.write_audit_event(
    'export',
    'read.activity_viewed',
    'recruiter',
    actor_uuid,
    public.current_recruiter_role_name(actor_uuid),
    null,
    correlation_id,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'surface', 'cross_entity_audit',
      'limit', limit_value,
      'entity_type', p_entity_type,
      'event_type', p_event_type,
      'correlation_id', p_correlation_id
    )
  );

  return activity_json;
end;
$function$;

revoke all on function public.get_cross_entity_audit(integer, text, text, uuid) from public;
grant execute on function public.get_cross_entity_audit(integer, text, text, uuid) to authenticated;

create or replace function public.get_recent_exports(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  correlation_id uuid := gen_random_uuid();
  limit_value integer := greatest(1, least(coalesce(p_limit, 50), 100));
  export_json jsonb := '[]'::jsonb;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not public.has_permission(actor_uuid, 'view_audit_log') then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(export_obj order by export_created_at desc),
    '[]'::jsonb
  )
  into export_json
  from (
    select
      a.created_at as export_created_at,
      jsonb_build_object(
        'id', a.id,
        'entity_type', a.entity_type,
        'event_type', a.event_type,
        'actor_type', a.actor_type,
        'actor_user_id', a.actor_user_id,
        'actor_name', coalesce(actor.full_name, actor.email),
        'actor_role_at_event', a.actor_role_at_event,
        'system_actor', a.system_actor,
        'correlation_id', a.correlation_id,
        'payload', a.payload,
        'created_at', a.created_at
      ) as export_obj
    from public.audit_log a
    left join public.profiles actor
      on actor.id = a.actor_user_id
    where a.event_type in ('export.pdf_exported', 'export.csv_exported')
    order by a.created_at desc
    limit limit_value
  ) export_source;

  perform public.write_audit_event(
    'export',
    'read.activity_viewed',
    'recruiter',
    actor_uuid,
    public.current_recruiter_role_name(actor_uuid),
    null,
    correlation_id,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'surface', 'recent_exports',
      'limit', limit_value
    )
  );

  return export_json;
end;
$function$;

revoke all on function public.get_recent_exports(integer) from public;
grant execute on function public.get_recent_exports(integer) to authenticated;

commit;
