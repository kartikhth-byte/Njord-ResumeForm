-- 2026110203 revoked only get_upcoming_events(uuid, integer) and
-- get_expiring_certificates(integer). Production also has a one-argument
-- SECURITY DEFINER overload of get_upcoming_events that any signed-in user
-- could call to read applicant names and emails. Neither name is called by the
-- app or Edge Functions, so every overload of both is restricted to
-- service_role, whatever its signature. NOT APPLIED.

begin;

do $$
declare
  fn regprocedure;
  leaked text;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('get_upcoming_events', 'get_expiring_certificates')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;

  select string_agg(p.oid::regprocedure::text || ' -> ' || r.rolname, ', ')
  into leaked
  from pg_proc p
  cross join (values ('anon'), ('authenticated')) as r(rolname)
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('get_upcoming_events', 'get_expiring_certificates')
    and has_function_privilege(r.rolname, p.oid, 'execute');

  if leaked is not null then
    raise exception 'revoke_all_unscoped_definer_overloads: still executable: %', leaked;
  end if;
end;
$$;

commit;
