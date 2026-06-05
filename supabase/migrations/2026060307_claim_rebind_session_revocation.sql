begin;

create or replace function public.current_request_email()
returns text
language sql
stable
as $function$
  select nullif(lower(btrim(coalesce(current_setting('request.jwt.claim.email', true), ''))), '')
$function$;

create or replace function public.claim_applicant_session()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  actor_email text := public.current_request_email();
  claim_correlation_id uuid := gen_random_uuid();
  prospect_row public.prospects%rowtype;
  application_row public.applications%rowtype;
  draft_created boolean := false;
  profile_name text;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if actor_email is null then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'missing_email'
    );
  end if;

  select *
  into prospect_row
  from public.prospects
  where email_normalized = actor_email
    and status = 'approved'
    and archived_at is null
    and deleted_at is null
    and bounce_flag = false
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'no_eligible_prospect'
    );
  end if;

  if prospect_row.applicant_user_id is not null and prospect_row.applicant_user_id <> actor_uuid then
    raise exception 'prospect already claimed by another applicant' using errcode = '23505';
  end if;

  insert into public.profiles (id, full_name, email, user_type)
  values (
    actor_uuid,
    coalesce(
      nullif(
        trim(
          coalesce(
            (select p.full_name from public.profiles p where p.id = actor_uuid),
            prospect_row.name,
            actor_email
          )
        ),
        ''
      ),
      actor_email
    ),
    actor_email,
    'applicant'
  )
  on conflict (id) do update
    set email = excluded.email,
        user_type = 'applicant',
        full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name)
  returning full_name into profile_name;

  update public.prospects
  set applicant_user_id = coalesce(applicant_user_id, actor_uuid),
      claimed_at = coalesce(claimed_at, now())
  where id = prospect_row.id
  returning * into prospect_row;

  select *
  into application_row
  from public.applications
  where user_id = actor_uuid
    and status = 'new'
    and submitted_at is null
  order by created_at desc
  limit 1
  for update;

  if found then
    if application_row.prospect_id is not null and application_row.prospect_id <> prospect_row.id then
      raise exception 'existing draft is already linked to a different prospect' using errcode = '23505';
    end if;

    if application_row.prospect_id is null then
      update public.applications
      set prospect_id = prospect_row.id,
          updated_at = now()
      where id = application_row.id
      returning * into application_row;
    end if;
  else
    insert into public.applications (
      user_id,
      status,
      prospect_id,
      created_at,
      updated_at
    ) values (
      actor_uuid,
      'new',
      prospect_row.id,
      now(),
      now()
    )
    returning * into application_row;

    draft_created := true;
  end if;

  insert into public.application_data (
    application_id,
    data,
    created_at,
    updated_at
  )
  select
    application_row.id,
    '{}'::jsonb,
    now(),
    now()
  where not exists (
    select 1
    from public.application_data ad
    where ad.application_id = application_row.id
  );

  perform public.write_audit_event(
    'prospect',
    'prospect.claimed',
    'applicant',
    actor_uuid,
    null,
    null,
    claim_correlation_id,
    prospect_row.id,
    null,
    null,
    application_row.id,
    jsonb_build_object(
      'email_normalized', actor_email,
      'draft_created', draft_created
    )
  );

  if draft_created then
    perform public.write_audit_event(
      'application',
      'application.draft_started',
      'applicant',
      actor_uuid,
      null,
      null,
      claim_correlation_id,
      prospect_row.id,
      null,
      null,
      application_row.id,
      jsonb_build_object(
        'prospect_id', prospect_row.id,
        'application_status', application_row.status
      )
    );
  end if;

  return jsonb_build_object(
    'claimed', true,
    'prospect_id', prospect_row.id,
    'application_id', application_row.id,
    'application_created', draft_created,
    'email_normalized', actor_email,
    'full_name', profile_name
  );
end;
$function$;

create or replace function public.edit_prospect_email_preclaim(
  p_prospect_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  old_email text;
  new_email text := btrim(coalesce(p_email, ''));
  new_email_normalized text := lower(btrim(coalesce(p_email, '')));
  claim_correlation_id uuid := gen_random_uuid();
  prospect_row public.prospects%rowtype;
begin
  if actor_uuid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if not (public.has_permission(actor_uuid, 'edit_prospects') or public.is_master_recruiter_profile(actor_uuid)) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  if new_email_normalized = '' then
    raise exception 'email_required' using errcode = '22023';
  end if;

  select *
  into prospect_row
  from public.prospects
  where id = p_prospect_id
  for update;

  if not found then
    raise exception 'prospect not found' using errcode = 'P0002';
  end if;

  if prospect_row.claimed_at is not null then
    raise exception 'claimed prospect email must be rebound with the post-claim flow' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.prospects p
    where p.id <> prospect_row.id
      and p.email_normalized = new_email_normalized
      and p.archived_at is null
      and p.deleted_at is null
  ) then
    raise exception 'email already exists' using errcode = '23505';
  end if;

  old_email := prospect_row.email;

  update public.prospects
  set email = new_email,
      bounce_flag = false
  where id = prospect_row.id
  returning * into prospect_row;

  update public.applicant_magic_link_requests
  set request_status = 'invalidated',
      invalidated_at = now(),
      invalidation_reason = 'email_changed'
  where email_normalized = lower(btrim(old_email))
    and invalidated_at is null;

  perform public.write_audit_event(
    'prospect',
    'prospect.email_changed',
    'recruiter',
    actor_uuid,
    null,
    null,
    claim_correlation_id,
    prospect_row.id,
    null,
    null,
    null,
    jsonb_build_object(
      'old_email', old_email,
      'old_email_normalized', lower(btrim(old_email)),
      'new_email', prospect_row.email,
      'new_email_normalized', prospect_row.email_normalized
    )
  );

  return jsonb_build_object(
    'prospect_id', prospect_row.id,
    'email', prospect_row.email,
    'email_normalized', prospect_row.email_normalized,
    'bounce_flag_cleared', true
  );
end;
$function$;

revoke all on function public.current_request_email() from public;
revoke all on function public.claim_applicant_session() from public;
revoke all on function public.edit_prospect_email_preclaim(uuid, text) from public;

commit;
