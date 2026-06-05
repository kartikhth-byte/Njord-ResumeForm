-- Prospect invite, bounce, and email-correction helpers.

begin;

alter table public.prospects
  add column if not exists invited_by_recruiter_id uuid references public.profiles(id) on delete set null;

create index if not exists prospects_invited_by_recruiter_id_idx
  on public.prospects (invited_by_recruiter_id);

create table if not exists public.prospect_email_webhook_events (
  svix_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null default now(),
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

revoke all on table public.prospect_email_webhook_events from public;

create or replace function public.reserve_prospect_invite(
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

  if not public.has_permission(p_actor_user_id, 'send_prospect_invites') then
    raise exception 'Insufficient permissions to send prospect invites';
  end if;

  select *
  into prospect_row
  from public.prospects
  where id = p_prospect_id
  for update;

  if not found then
    raise exception 'Prospect not found';
  end if;

  was_invited_at := prospect_row.invited_at;

  if prospect_row.status <> 'approved' then
    raise exception 'Only approved prospects can be invited';
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

revoke all on function public.reserve_prospect_invite(uuid, uuid, text, text) from public;
grant execute on function public.reserve_prospect_invite(uuid, uuid, text, text) to service_role;

create or replace function public.release_prospect_invite_reservation(
  p_prospect_id uuid,
  p_actor_user_id uuid,
  p_actor_role_at_event text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  prospect_row public.prospects%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(p_actor_user_id, 'send_prospect_invites') then
    raise exception 'Insufficient permissions to send prospect invites';
  end if;

  update public.prospects
  set
    invited_at = null,
    invited_by_recruiter_id = null,
    last_activity_at = now(),
    updated_at = now()
  where id = p_prospect_id
  returning * into prospect_row;

  if not found then
    raise exception 'Prospect not found';
  end if;

  return jsonb_build_object(
    'success', true,
    'prospect_id', prospect_row.id,
    'invite_state', 'released',
    'reason', nullif(btrim(p_reason), ''),
    'actor_role_at_event', p_actor_role_at_event
  );
end;
$function$;

revoke all on function public.release_prospect_invite_reservation(uuid, uuid, text, text) from public;
grant execute on function public.release_prospect_invite_reservation(uuid, uuid, text, text) to service_role;

create or replace function public.update_prospect_email_and_clear_bounce(
  p_prospect_id uuid,
  p_email text,
  p_actor_role_at_event text default null
)
returns public.prospects
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  updated_row public.prospects%rowtype;
  actor_role text;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required';
  end if;

  if not public.has_permission(actor_uuid, 'edit_prospects') then
    raise exception 'Insufficient permissions to edit prospects';
  end if;

  if normalized_email = '' then
    raise exception 'Email is required';
  end if;

  select role_name into actor_role
  from public.get_user_role(actor_uuid);

  update public.prospects
  set
    email = normalized_email,
    bounce_flag = false,
    invited_at = null,
    invited_by_recruiter_id = null,
    last_activity_at = now(),
    updated_at = now()
  where id = p_prospect_id
  returning * into updated_row;

  if not found then
    raise exception 'Prospect not found';
  end if;

  perform public.write_audit_event(
    'prospect',
    'prospect.email_updated',
    'recruiter',
    actor_uuid,
    coalesce(p_actor_role_at_event, actor_role),
    null,
    null,
    p_prospect_id,
    null,
    null,
    null,
    jsonb_build_object(
      'prospect_id', updated_row.id,
      'email', normalized_email,
      'bounce_flag_cleared', true
    )
  );

  return updated_row;
end;
$function$;

revoke all on function public.update_prospect_email_and_clear_bounce(uuid, text, text) from public;
grant execute on function public.update_prospect_email_and_clear_bounce(uuid, text, text) to authenticated;
grant execute on function public.update_prospect_email_and_clear_bounce(uuid, text, text) to service_role;

create or replace function public.record_prospect_email_bounce(
  p_recipient_email text default null,
  p_prospect_id uuid default null,
  p_event_payload jsonb default '{}'::jsonb,
  p_event_created_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_email text := lower(btrim(coalesce(p_recipient_email, '')));
  prospect_row public.prospects%rowtype;
begin
  if p_prospect_id is null and normalized_email = '' then
    return jsonb_build_object(
      'matched', false,
      'recipient_email', null,
      'event_created_at', p_event_created_at
    );
  end if;

  if p_prospect_id is not null then
    select *
    into prospect_row
    from public.prospects
    where id = p_prospect_id
    for update;
  elsif normalized_email <> '' then
    select *
    into prospect_row
    from public.prospects
    where email_normalized = normalized_email
      and deleted_at is null
    order by updated_at desc
    limit 1
    for update;
  end if;

  if not found then
    return jsonb_build_object(
      'matched', false,
      'recipient_email', nullif(normalized_email, ''),
      'event_created_at', p_event_created_at
    );
  end if;

  update public.prospects
  set
    bounce_flag = true,
    last_activity_at = now(),
    updated_at = now()
  where id = prospect_row.id;

  perform public.write_audit_event(
    'prospect',
    'bounce_received',
    'system',
    null,
    null,
    'resend',
    null,
    prospect_row.id,
    null,
    null,
    null,
    jsonb_build_object(
      'recipient_email', prospect_row.email,
      'prospect_name', prospect_row.name,
      'event_created_at', p_event_created_at,
      'email_id', p_event_payload->>'email_id',
      'from', p_event_payload->>'from',
      'subject', p_event_payload->>'subject',
      'bounce', coalesce(p_event_payload->'bounce', '{}'::jsonb),
      'tags', coalesce(p_event_payload->'tags', '{}'::jsonb)
    )
  );

  return jsonb_build_object(
    'matched', true,
    'prospect_id', prospect_row.id,
    'recipient_email', prospect_row.email,
    'bounce_flag', true,
    'event_created_at', p_event_created_at
  );
end;
$function$;

revoke all on function public.record_prospect_email_bounce(text, uuid, jsonb, timestamptz) from public;
grant execute on function public.record_prospect_email_bounce(text, uuid, jsonb, timestamptz) to service_role;

commit;
