-- Close direct role/permission enumeration and requirement sequence exhaustion
-- without changing the trigger path used for normal requirement creation.
begin;

do $$
declare
  missing text[] := array[]::text[];
  signature text;
begin
  foreach signature in array array[
    'public.get_user_role(uuid)',
    'public.get_user_permissions(uuid)',
    'public.check_permission(uuid,text)',
    'public.has_permission(uuid,text)',
    'public.user_has_permission(uuid,text)',
    'public.allocate_requirement_identifier(text)',
    'auth.uid()',
    'auth.role()'
  ] loop
    if to_regprocedure(signature) is null then
      missing := array_append(missing, signature);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'guard_role_metadata_and_requirement_ids: missing functions: %', array_to_string(missing, ', ');
  end if;
end;
$$;

-- RLS calls this function with auth.uid(). Keep that path, but do not let a
-- client probe another user's permissions by supplying a different UUID.
create or replace function public.has_permission(user_uuid uuid, permission_name text)
returns boolean
language plpgsql
security definer
as $function$
begin
  if auth.role() is distinct from 'service_role'
     and user_uuid is distinct from auth.uid() then
    return false;
  end if;

  return public.check_permission(user_uuid, permission_name);
end;
$function$;

create or replace function public.allocate_requirement_identifier(p_req_year_month text)
returns table(req_sequence integer, req_id_display text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_year_month text := coalesce(nullif(btrim(p_req_year_month), ''), to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'));
begin
  -- The authenticated path is the requirements INSERT trigger, not a direct
  -- RPC. The service role retains direct access for trusted server writes.
  if auth.role() is distinct from 'service_role'
     and (pg_trigger_depth() = 0
          or not coalesce(public.has_permission(auth.uid(), 'create_requirements'), false)) then
    raise exception 'insufficient_permissions' using errcode = '42501';
  end if;

  if normalized_year_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'req_year_month must use YYYY-MM format';
  end if;

  insert into public.requirement_id_sequences (req_year_month, next_sequence)
  values (normalized_year_month, 1)
  on conflict (req_year_month) do nothing;

  update public.requirement_id_sequences
  set next_sequence = next_sequence + 1,
      updated_at = now()
  where req_year_month = normalized_year_month
  returning next_sequence - 1 into req_sequence;

  if req_sequence is null then
    raise exception 'Unable to allocate requirement identifier for %', normalized_year_month;
  end if;

  req_id_display := public.build_requirement_display_id(normalized_year_month, req_sequence);
  return next;
end;
$function$;

-- These lookups have no browser caller. Trusted SECURITY DEFINER functions
-- can still call them as their owner, and service-role callers retain access.
revoke all on function public.get_user_role(uuid) from public, anon, authenticated;
revoke all on function public.get_user_permissions(uuid) from public, anon, authenticated;
revoke all on function public.check_permission(uuid, text) from public, anon, authenticated;
revoke all on function public.user_has_permission(uuid, text) from public, anon, authenticated;
grant execute on function public.get_user_role(uuid) to service_role;
grant execute on function public.get_user_permissions(uuid) to service_role;
grant execute on function public.check_permission(uuid, text) to service_role;
grant execute on function public.user_has_permission(uuid, text) to service_role;

-- The existing requirement trigger is SECURITY INVOKER, so it still needs
-- the allocator's authenticated grant; the caller-aware guard above limits it.
revoke all on function public.allocate_requirement_identifier(text) from public, anon;
grant execute on function public.allocate_requirement_identifier(text) to authenticated, service_role;

do $$
declare
  leaked text;
begin
  select string_agg(p.oid::regprocedure::text || ' -> ' || r.rolname, ', ')
  into leaked
  from pg_proc p
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('get_user_role', 'get_user_permissions', 'check_permission', 'user_has_permission')
    and has_function_privilege(r.rolname, p.oid, 'execute');

  if leaked is not null then
    raise exception 'guard_role_metadata_and_requirement_ids: still executable: %', leaked;
  end if;
end;
$$;

commit;
