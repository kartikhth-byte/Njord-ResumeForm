-- Applicant invitations use the same stable requirement ID as recruiter lists.
-- Keep the older reference separately for historical correspondence.
begin;

create or replace function public.get_applicant_claims()
returns jsonb language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'prospect_id', p.id, 'organization_id', p.organization_id,
    'organization_name', o.name, 'case_id', c.id,
    'requirement_reference', r.display_id,
    'requirement_legacy_reference', r.req_id_display,
    'application_id', c.application_id
  ) order by o.name, r.display_id, c.id), '[]'::jsonb)
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

revoke all on function public.get_applicant_claims() from public, anon;
grant execute on function public.get_applicant_claims() to authenticated, service_role;

commit;
