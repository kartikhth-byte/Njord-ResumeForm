-- Historical submitted forms can be visible in the single-organization
-- Applications directory without a prospect or recruitment link. Keep their
-- notes as accessible as the rows, while preserving the organization check for
-- applications that do have a prospect.
create or replace function public.directory_note_subject_in_scope(p_application uuid, p_draft uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (p_application is not null and exists (
    select 1 from public.applications a
    left join public.prospects p on p.id = a.prospect_id
    where a.id = p_application and (
      p.organization_id = public.needle_pilot_organization_id()
      or (a.prospect_id is null and a.submitted_at is not null)
    )))
  or (p_draft is not null and exists (
    select 1 from public.resume_lead_drafts d
    where d.id = p_draft and d.organization_id = public.needle_pilot_organization_id()))
$$;
