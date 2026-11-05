-- A prospect claim alone does not authorize the long form. A recruiter must
-- explicitly record a form invite on an eligible post-interview case.
begin;

alter table public.applicant_magic_link_requests
  add column if not exists case_id uuid references public.recruitment_cases(id);

create or replace function public.get_applicant_claims()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'prospect_id', p.id,
    'organization_id', p.organization_id,
    'organization_name', o.name
  ) order by o.name, p.id), '[]'::jsonb)
  from public.prospects p
  join public.organizations o on o.id = p.organization_id
  where p.applicant_user_id = auth.uid()
    and p.status = 'approved'
    and p.archived_at is null and p.deleted_at is null
    and not p.bounce_flag
    and exists (
      select 1 from public.recruitment_cases c
      where c.prospect_id = p.id and c.organization_id = p.organization_id
        and c.form_invited_at is not null
        and public.recruitment_case_post_interview(c.status)
    );
$$;

create or replace function public.start_claimed_application(
  p_prospect_id uuid,
  p_initial_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  new_id uuid;
begin
  if actor is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.prospects p
    join public.profiles u on u.id = actor and u.user_type = 'applicant'
    where p.id = p_prospect_id and p.applicant_user_id = actor
      and p.status = 'approved' and p.archived_at is null
      and p.deleted_at is null and not p.bounce_flag
      and exists (
        select 1 from public.recruitment_cases c
        where c.prospect_id = p.id and c.organization_id = p.organization_id
          and c.form_invited_at is not null
          and public.recruitment_case_post_interview(c.status)
      )
  ) then
    raise exception 'form_invite_required' using errcode = '42501';
  end if;

  insert into public.applications (user_id, status, prospect_id, created_at, updated_at)
  values (actor, 'new', p_prospect_id, now(), now())
  returning id into new_id;
  insert into public.application_data (application_id, data, created_at, updated_at)
  values (new_id, coalesce(p_initial_data, '{}'::jsonb), now(), now());
  return new_id;
end;
$$;

revoke all on function public.get_applicant_claims() from public, anon, authenticated;
revoke all on function public.start_claimed_application(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.get_applicant_claims() to authenticated, service_role;
grant execute on function public.start_claimed_application(uuid,jsonb) to authenticated, service_role;

commit;
