-- Recruiters explicitly choose the submitted form for this exact case.
begin;
create or replace function public.recruitment_case_link_application_v2(
  p_case_id uuid,p_application_id uuid,p_expected_version integer
)
returns public.recruitment_cases language plpgsql security definer
set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); c public.recruitment_cases; app public.applications;
begin
  if actor is null or not public.has_permission(actor,'edit_junction_status') then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  select * into c from public.recruitment_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found' using errcode='P0002'; end if;
  if c.organization_id is distinct from public.needle_pilot_organization_id() then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if c.application_id=p_application_id then return c; end if;
  if c.application_id is not null then
    raise exception 'application_already_linked' using errcode='22023';
  end if;
  if p_expected_version is null or c.version<>p_expected_version then
    raise exception 'version_conflict' using errcode='40001';
  end if;
  if not public.recruitment_case_post_interview(c.status)
    or c.status in ('hired','withdrawn','rejected','closed') then
    raise exception 'form_link_requires_active_post_interview_case' using errcode='22023';
  end if;
  select * into app from public.applications where id=p_application_id;
  if not found or app.prospect_id is distinct from c.prospect_id then
    raise exception 'application_prospect_mismatch' using errcode='22023';
  end if;
  if app.submitted_at is null then
    raise exception 'submitted_form_required' using errcode='22023';
  end if;
  update public.recruitment_cases set application_id=p_application_id,
    updated_at=now(),version=version+1 where id=c.id returning * into c;
  insert into public.recruitment_case_events
    (case_id,organization_id,event_type,from_status,to_status,payload,actor_id)
  values(c.id,c.organization_id,'source_added',c.status,c.status,
    jsonb_build_object('action','application_linked','application_id',p_application_id),actor);
  return c;
end $$;
revoke all on function public.recruitment_case_link_application_v2(uuid,uuid,integer) from public,anon;
grant execute on function public.recruitment_case_link_application_v2(uuid,uuid,integer) to authenticated;
revoke execute on function public.recruitment_case_link_application(uuid,uuid) from public,anon,authenticated;
commit;
