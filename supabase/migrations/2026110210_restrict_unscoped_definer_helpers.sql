-- Restrict legacy SECURITY DEFINER helpers that have no caller check. The
-- browser does not call these directly: warning reads and audit writes are
-- performed by service-role Edge Functions or by trusted database functions.
-- Keep this separate from the data-changing expiry migration 2026110208.

begin;

do $$
declare
  target_name text;
  fn regprocedure;
  leaked text;
begin
  foreach target_name in array array[
    'get_documents_needing_warnings',
    'write_audit_event',
    'cleanup_old_expiry_records',
    'extract_expiries_for_application_sql',
    'extract_expiries_for_application'
  ] loop
    if not exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = target_name
    ) then
      raise exception 'restrict_unscoped_definer_helpers: missing function %', target_name;
    end if;

    if exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = target_name
        and not p.prosecdef
    ) then
      raise exception 'restrict_unscoped_definer_helpers: unexpected invoker function %', target_name;
    end if;

    for fn in
      select p.oid::regprocedure from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = target_name
    loop
      execute format('revoke all on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end loop;
  end loop;

  select string_agg(p.oid::regprocedure::text || ' -> ' || r.rolname, ', ')
  into leaked
  from pg_proc p
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where p.pronamespace = 'public'::regnamespace
    and p.proname = any (array[
      'get_documents_needing_warnings', 'write_audit_event',
      'cleanup_old_expiry_records', 'extract_expiries_for_application_sql',
      'extract_expiries_for_application'
    ])
    and has_function_privilege(r.rolname, p.oid, 'execute');

  if leaked is not null then
    raise exception 'restrict_unscoped_definer_helpers: still executable: %', leaked;
  end if;
end;
$$;

commit;
