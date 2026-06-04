-- Prospect enrollment foundation for PR 1.
-- This seeds the new prospect-enrollment permissions, maps them to the supported
-- recruiter roles, and creates the shared audit substrate used by later flows.
--
-- Typed foreign-key constraints to future prospect/requirement tables are staged
-- here as nullable audit columns so this migration can land before the entity
-- tables arrive in follow-up migrations.

begin;

insert into public.permissions (name)
select permission_name
from (
  values
    ('view_prospects'),
    ('create_prospects'),
    ('edit_prospects'),
    ('transition_prospects'),
    ('archive_prospects'),
    ('delete_prospects'),
    ('send_prospect_invites'),
    ('view_prospect_notes'),
    ('edit_prospect_notes'),
    ('view_requirements'),
    ('create_requirements'),
    ('edit_requirements'),
    ('transition_requirements'),
    ('edit_requirement_owner'),
    ('edit_junction_status'),
    ('withdraw_junctions'),
    ('view_audit_log'),
    ('export_csv'),
    ('export_pdf'),
    ('manage_runtime_settings')
) as seeded_permissions(permission_name)
where not exists (
  select 1
  from public.permissions existing
  where existing.name = seeded_permissions.permission_name
);

with role_permission_matrix(role_name, permission_name) as (
  values
    ('Master Recruiter', 'view_prospects'),
    ('Master Recruiter', 'create_prospects'),
    ('Master Recruiter', 'edit_prospects'),
    ('Master Recruiter', 'transition_prospects'),
    ('Master Recruiter', 'archive_prospects'),
    ('Master Recruiter', 'delete_prospects'),
    ('Master Recruiter', 'send_prospect_invites'),
    ('Master Recruiter', 'view_prospect_notes'),
    ('Master Recruiter', 'edit_prospect_notes'),
    ('Master Recruiter', 'view_requirements'),
    ('Master Recruiter', 'create_requirements'),
    ('Master Recruiter', 'edit_requirements'),
    ('Master Recruiter', 'transition_requirements'),
    ('Master Recruiter', 'edit_requirement_owner'),
    ('Master Recruiter', 'edit_junction_status'),
    ('Master Recruiter', 'withdraw_junctions'),
    ('Master Recruiter', 'view_audit_log'),
    ('Master Recruiter', 'export_csv'),
    ('Master Recruiter', 'export_pdf'),
    ('Master Recruiter', 'manage_runtime_settings'),
    ('Recruiter', 'view_prospects'),
    ('Recruiter', 'create_prospects'),
    ('Recruiter', 'edit_prospects'),
    ('Recruiter', 'transition_prospects'),
    ('Recruiter', 'archive_prospects'),
    ('Recruiter', 'send_prospect_invites'),
    ('Recruiter', 'view_prospect_notes'),
    ('Recruiter', 'edit_prospect_notes'),
    ('Recruiter', 'view_requirements'),
    ('Recruiter', 'create_requirements'),
    ('Recruiter', 'edit_requirements'),
    ('Recruiter', 'transition_requirements'),
    ('Recruiter', 'edit_requirement_owner'),
    ('Recruiter', 'edit_junction_status'),
    ('Recruiter', 'withdraw_junctions'),
    ('Coordinator', 'view_prospects'),
    ('Coordinator', 'view_requirements')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from role_permission_matrix rpm
join public.roles r
  on r.name = rpm.role_name
join public.permissions p
  on p.name = rpm.permission_name
where not exists (
  select 1
  from public.role_permissions existing
  where existing.role_id = r.id
    and existing.permission_id = p.id
);

create or replace function public.is_recruiter_profile(profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_uuid
      and p.user_type = 'recruiter'
  );
$function$;

revoke all on function public.is_recruiter_profile(uuid) from public;

create or replace function public.master_recruiter_role_name()
returns text
language sql
immutable
as $function$
  select 'Master Recruiter'::text;
$function$;

revoke all on function public.master_recruiter_role_name() from public;

create or replace function public.is_master_recruiter_profile(profile_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = profile_uuid
      and r.name = public.master_recruiter_role_name()
  );
$function$;

revoke all on function public.is_master_recruiter_profile(uuid) from public;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  prospect_id uuid,
  requirement_id uuid,
  prospect_requirement_id uuid,
  application_id uuid,
  event_type text not null,
  actor_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role_at_event text,
  system_actor text,
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_entity_type_check
    check (entity_type in ('prospect', 'requirement', 'prospect_requirement', 'application', 'export')),
  constraint audit_log_actor_type_check
    check (actor_type in ('recruiter', 'applicant', 'system')),
  constraint audit_log_typed_fk_check
    check (
      (
        entity_type = 'export'
        and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 0
      )
      or (
        entity_type <> 'export'
        and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 1
      )
  )
);

alter table public.audit_log
  add column if not exists entity_type text,
  add column if not exists prospect_id uuid,
  add column if not exists requirement_id uuid,
  add column if not exists prospect_requirement_id uuid,
  add column if not exists application_id uuid,
  add column if not exists event_type text,
  add column if not exists actor_type text,
  add column if not exists actor_user_id uuid,
  add column if not exists actor_role_at_event text,
  add column if not exists system_actor text,
  add column if not exists correlation_id uuid,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

update public.audit_log
set payload = '{}'::jsonb
where payload is null;

alter table public.audit_log
  alter column payload set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_entity_type_check'
      and conrelid = 'public.audit_log'::regclass
  ) then
    alter table public.audit_log
      add constraint audit_log_entity_type_check
      check (entity_type is not null and entity_type in ('prospect', 'requirement', 'prospect_requirement', 'application', 'export'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_actor_type_check'
      and conrelid = 'public.audit_log'::regclass
  ) then
    alter table public.audit_log
      add constraint audit_log_actor_type_check
      check (actor_type is not null and actor_type in ('recruiter', 'applicant', 'system'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_typed_fk_check'
      and conrelid = 'public.audit_log'::regclass
  ) then
    alter table public.audit_log
      add constraint audit_log_typed_fk_check
      check (
        (
          entity_type = 'export'
          and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 0
        )
        or (
          entity_type <> 'export'
          and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 1
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_entity_type_not_null'
      and conrelid = 'public.audit_log'::regclass
  ) and not exists (
    select 1
    from public.audit_log
    where entity_type is null
  ) then
    alter table public.audit_log
      alter column entity_type set not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_event_type_not_null'
      and conrelid = 'public.audit_log'::regclass
  ) and not exists (
    select 1
    from public.audit_log
    where event_type is null
  ) then
    alter table public.audit_log
      alter column event_type set not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_log_actor_type_not_null'
      and conrelid = 'public.audit_log'::regclass
  ) and not exists (
    select 1
    from public.audit_log
    where actor_type is null
  ) then
    alter table public.audit_log
      alter column actor_type set not null;
  end if;
end $$;

create index if not exists audit_log_prospect_id_event_type_created_at_idx
  on public.audit_log (prospect_id, event_type, created_at desc);

create index if not exists audit_log_requirement_id_event_type_created_at_idx
  on public.audit_log (requirement_id, event_type, created_at desc);

create index if not exists audit_log_prospect_requirement_id_event_type_created_at_idx
  on public.audit_log (prospect_requirement_id, event_type, created_at desc);

create index if not exists audit_log_application_id_event_type_created_at_idx
  on public.audit_log (application_id, event_type, created_at desc);

create index if not exists audit_log_actor_user_id_created_at_event_type_idx
  on public.audit_log (actor_user_id, created_at desc, event_type);

create index if not exists audit_log_entity_type_created_at_idx
  on public.audit_log (entity_type, created_at desc);

create index if not exists audit_log_correlation_id_idx
  on public.audit_log (correlation_id);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_read_view_audit_log" on public.audit_log;
create policy "audit_log_read_view_audit_log"
on public.audit_log
for select
to authenticated
using (public.has_permission(auth.uid(), 'view_audit_log'));

create or replace function public.mask_email_address(p_email text)
returns text
language plpgsql
stable
as $function$
declare
  normalized_email text;
  email_local_part text;
  email_domain_part text;
begin
  if p_email is null then
    return null;
  end if;

  normalized_email := lower(btrim(p_email));

  if position('@' in normalized_email) = 0 then
    return left(normalized_email, 1) || '***';
  end if;

  email_local_part := split_part(normalized_email, '@', 1);
  email_domain_part := split_part(normalized_email, '@', 2);

  if coalesce(length(email_local_part), 0) = 0 then
    return '***@' || email_domain_part;
  end if;

  return left(email_local_part, 1) || '***@' || email_domain_part;
end;
$function$;

revoke all on function public.mask_email_address(text) from public;

create or replace function public.mask_phone_number(p_phone text)
returns text
language plpgsql
stable
as $function$
declare
  digits_only text;
begin
  if p_phone is null then
    return null;
  end if;

  digits_only := regexp_replace(p_phone, '\D', '', 'g');

  if digits_only = '' then
    return null;
  end if;

  if length(digits_only) <= 4 then
    return '***-' || digits_only;
  end if;

  return '***-***-' || right(digits_only, 4);
end;
$function$;

revoke all on function public.mask_phone_number(text) from public;

create or replace function public.hash_audit_value(p_value text)
returns text
language sql
stable
as $function$
  select case
    when p_value is null then null
    else md5(lower(btrim(p_value)))
  end;
$function$;

revoke all on function public.hash_audit_value(text) from public;

create or replace function public.redact_audit_payload(p_event_type text, p_payload jsonb)
returns jsonb
language plpgsql
stable
as $function$
declare
  redacted_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  original_email text;
  original_phone text;
begin
  if redacted_payload ? 'email' then
    original_email := nullif(btrim(redacted_payload ->> 'email'), '');
    redacted_payload := redacted_payload - 'email';
    redacted_payload := jsonb_strip_nulls(
      redacted_payload
      || jsonb_build_object(
        'email_hash', public.hash_audit_value(original_email),
        'email_mask', public.mask_email_address(original_email)
      )
    );
  end if;

  if redacted_payload ? 'email_old' or redacted_payload ? 'email_new' then
    redacted_payload := redacted_payload - 'email_old' - 'email_new';
    redacted_payload := jsonb_strip_nulls(
      redacted_payload
      || jsonb_build_object(
        'email_old_hash', public.hash_audit_value(nullif(btrim(coalesce(p_payload ->> 'email_old', '')), '')),
        'email_new_hash', public.hash_audit_value(nullif(btrim(coalesce(p_payload ->> 'email_new', '')), '')),
        'email_old_mask', public.mask_email_address(nullif(btrim(coalesce(p_payload ->> 'email_old', '')), '')),
        'email_new_mask', public.mask_email_address(nullif(btrim(coalesce(p_payload ->> 'email_new', '')), ''))
      )
    );
  end if;

  if redacted_payload ? 'telephone' then
    original_phone := nullif(btrim(redacted_payload ->> 'telephone'), '');
    redacted_payload := redacted_payload - 'telephone';
    redacted_payload := jsonb_strip_nulls(
      redacted_payload
      || jsonb_build_object(
        'telephone_mask', public.mask_phone_number(original_phone)
      )
    );
  end if;

  if redacted_payload ? 'telephone_old' or redacted_payload ? 'telephone_new' then
    redacted_payload := redacted_payload - 'telephone_old' - 'telephone_new';
    redacted_payload := jsonb_strip_nulls(
      redacted_payload
      || jsonb_build_object(
        'telephone_old_mask', public.mask_phone_number(nullif(btrim(coalesce(p_payload ->> 'telephone_old', '')), '')),
        'telephone_new_mask', public.mask_phone_number(nullif(btrim(coalesce(p_payload ->> 'telephone_new', '')), ''))
      )
    );
  end if;

  if redacted_payload ? 'dob' then
    redacted_payload := redacted_payload - 'dob';
    redacted_payload := jsonb_strip_nulls(
      redacted_payload
      || jsonb_build_object(
        case
          when p_event_type = 'prospect.created' then 'dob_set'
          else 'dob_changed'
        end,
        true
      )
    );
  end if;

  if redacted_payload ? 'dob_old' or redacted_payload ? 'dob_new' then
    redacted_payload := redacted_payload - 'dob_old' - 'dob_new';
    redacted_payload := jsonb_strip_nulls(
      redacted_payload
      || jsonb_build_object(
        'dob_changed', coalesce((p_payload ->> 'dob_changed')::boolean, true)
      )
    );
  end if;

  if redacted_payload ? 'note_body' then
    redacted_payload := redacted_payload - 'note_body';
  end if;

  -- Keep recruiter-facing names and source fields in audit payloads for
  -- operational readability; redact only the direct contact and health fields.
  if redacted_payload ? 'body' and (p_event_type like '%.note_%' or p_event_type like '%.remark_%') then
    redacted_payload := redacted_payload - 'body';
  end if;

  return redacted_payload;
end;
$function$;

revoke all on function public.redact_audit_payload(text, jsonb) from public;

create or replace function public.write_audit_event(
  p_entity_type text,
  p_event_type text,
  p_actor_type text,
  p_actor_user_id uuid default null,
  p_actor_role_at_event text default null,
  p_system_actor text default null,
  p_correlation_id uuid default null,
  p_prospect_id uuid default null,
  p_requirement_id uuid default null,
  p_prospect_requirement_id uuid default null,
  p_application_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  audit_id uuid;
begin
  insert into public.audit_log (
    entity_type,
    prospect_id,
    requirement_id,
    prospect_requirement_id,
    application_id,
    event_type,
    actor_type,
    actor_user_id,
    actor_role_at_event,
    system_actor,
    correlation_id,
    payload
  )
  values (
    p_entity_type,
    p_prospect_id,
    p_requirement_id,
    p_prospect_requirement_id,
    p_application_id,
    p_event_type,
    p_actor_type,
    p_actor_user_id,
    p_actor_role_at_event,
    p_system_actor,
    p_correlation_id,
    public.redact_audit_payload(p_event_type, p_payload)
  )
  returning id into audit_id;

  return audit_id;
end;
$function$;

revoke all on function public.write_audit_event(text, text, text, uuid, text, text, uuid, uuid, uuid, uuid, uuid, jsonb) from public;

commit;
