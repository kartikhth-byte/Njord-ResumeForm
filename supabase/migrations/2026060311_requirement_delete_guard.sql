begin;

create or replace function public.prepare_requirement_row()
returns trigger
language plpgsql
as $function$
declare
  generated_sequence integer;
  generated_display text;
  expected_display text;
  normalized_year_month text;
  actor_uuid uuid;
  actor_role_name text;
  current_tenant_date date := timezone('Asia/Kolkata', now())::date;
  requirement_created_tenant_date date;
begin
  if tg_op = 'INSERT' then
    new.req_year_month := coalesce(nullif(btrim(new.req_year_month), ''), to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'));
    new.date_opened := coalesce(new.date_opened, timezone('Asia/Kolkata', now())::date);
    new.status := coalesce(nullif(btrim(new.status), ''), 'open');

    if new.status <> 'open' then
      raise exception 'Requirements must be created with status open';
    end if;

    if new.req_sequence is null and (new.req_id_display is null or btrim(new.req_id_display) = '') then
      select req_sequence, req_id_display
      into generated_sequence, generated_display
      from public.allocate_requirement_identifier(new.req_year_month);

      new.req_sequence := generated_sequence;
      new.req_id_display := generated_display;
    elsif new.req_sequence is not null then
      expected_display := public.build_requirement_display_id(new.req_year_month, new.req_sequence);
      if new.req_id_display is null or btrim(new.req_id_display) = '' then
        new.req_id_display := expected_display;
      elsif new.req_id_display <> expected_display then
        raise exception 'req_id_display must match req_year_month and req_sequence when seq is provided';
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if new.req_year_month is distinct from old.req_year_month then
    raise exception 'req_year_month cannot be changed after insert';
  end if;

  normalized_year_month := old.req_year_month;

  if new.req_sequence is distinct from old.req_sequence then
    raise exception 'req_sequence cannot be changed after insert';
  end if;

  if new.req_id_display is distinct from old.req_id_display then
    if new.req_sequence is not null then
      expected_display := public.build_requirement_display_id(normalized_year_month, new.req_sequence);
      if new.req_id_display <> expected_display then
        raise exception 'req_id_display must remain aligned with req_year_month and req_sequence';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'open' and new.status = 'closed' then
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    elsif old.status = 'open' and new.status = 'cancelled' then
      if nullif(trim(new.closure_reason), '') is null then
        raise exception 'closure_reason is required when cancelling a requirement';
      end if;
      new.date_closed := timezone('Asia/Kolkata', now())::date;
    elsif old.status in ('closed', 'cancelled') and new.status = 'open' then
      new.date_closed := null;
      new.closure_reason := null;
    else
      raise exception 'Invalid requirement status transition from % to %', old.status, new.status;
    end if;
  end if;

  if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    actor_uuid := coalesce(auth.uid(), new.deleted_by_recruiter_id, old.deleted_by_recruiter_id);
    if actor_uuid is null then
      raise exception 'auth_required' using errcode = '28000';
    end if;

    if not public.is_recruiter_profile(actor_uuid) then
      raise exception 'deleted_by_recruiter_id must reference a recruiter profile';
    end if;

    actor_role_name := public.current_recruiter_role_name(actor_uuid);
    if actor_role_name is null then
      raise exception 'insufficient_permissions' using errcode = '42501';
    end if;

    new.deleted_by_recruiter_id := actor_uuid;

    if nullif(trim(new.delete_reason), '') is null then
      raise exception 'delete_reason is required when deleting a requirement';
    end if;

    requirement_created_tenant_date := timezone('Asia/Kolkata', old.created_at)::date;
    if actor_role_name <> public.master_recruiter_role_name() and requirement_created_tenant_date <> current_tenant_date then
      raise exception 'Only the Master Recruiter can delete older requirement rows.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'cancelled' and nullif(trim(new.closure_reason), '') is null then
    raise exception 'closure_reason is required when cancelling a requirement';
  end if;

  if new.deleted_at is not null and nullif(trim(new.delete_reason), '') is null then
    raise exception 'delete_reason is required when deleting a requirement';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.prepare_requirement_row() from public;

commit;
