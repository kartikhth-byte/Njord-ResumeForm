-- get_upcoming_events and get_expiring_certificates are SECURITY DEFINER and
-- return other people's data (names, emails, certificate expiry, event details)
-- with no check on the caller. 2026110202 removed anon access; any signed-in
-- user (including applicants) could still call them. The app does not call
-- either function, so only service_role keeps EXECUTE. NOT APPLIED.

do $$
declare
  fn regprocedure;
begin
  foreach fn in array array[
    to_regprocedure('public.get_upcoming_events(uuid, integer)'),
    to_regprocedure('public.get_expiring_certificates(integer)')
  ]
  loop
    continue when fn is null;
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
