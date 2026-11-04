-- Close the remaining unscoped definer reads found in the callable-function
-- audit. Keep self-check helpers executable where RLS and invoker triggers
-- need them; do not apply the unrelated expiry behavior migration 0208.
begin;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.get_expiring_documents_summary()',
    'public.get_team_stats()',
    'public.compute_should_prompt_close(uuid)',
    'public.current_recruiter_role_name(uuid)',
    'public.is_master_recruiter_profile(uuid)',
    'public.is_recruiter(uuid)',
    'auth.uid()',
    'auth.role()'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'close_remaining_unscoped_definer_reads: missing %', signature;
    end if;
  end loop;
end;
$$;

-- No frontend or Edge Function calls these three directly. The close-prompt
-- helper is called by permission-checked SECURITY DEFINER recruiter RPCs.
do $$
declare
  target_name text;
  fn regprocedure;
  leaked text;
begin
  foreach target_name in array array[
    'get_expiring_documents_summary',
    'get_team_stats',
    'compute_should_prompt_close'
  ] loop
    if exists (
      select 1 from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = target_name
        and not p.prosecdef
    ) then
      raise exception 'close_remaining_unscoped_definer_reads: unexpected invoker overload %', target_name;
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
    and p.proname in (
      'get_expiring_documents_summary', 'get_team_stats', 'compute_should_prompt_close'
    )
    and has_function_privilege(r.rolname, p.oid, 'execute');

  if leaked is not null then
    raise exception 'close_remaining_unscoped_definer_reads: still executable: %', leaked;
  end if;
end;
$$;

-- The requirement-delete trigger is SECURITY INVOKER and calls this helper
-- with auth.uid(); a direct authenticated call must not inspect other users.
create or replace function public.current_recruiter_role_name(profile_uuid uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = profile_uuid
    and (auth.role() = 'service_role' or profile_uuid = auth.uid())
  order by case when r.name = public.master_recruiter_role_name() then 0 else 1 end, r.name
  limit 1;
$function$;

-- These predicates are used with auth.uid() by RLS and applicant write guards.
-- Preserve that contract, but avoid arbitrary UUID role-membership probes.
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
      and (auth.role() = 'service_role' or profile_uuid = auth.uid())
  );
$function$;

create or replace function public.is_recruiter(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1 from public.profiles
    where id = p_user
      and user_type = 'recruiter'
      and (auth.role() = 'service_role' or p_user = auth.uid())
  );
$function$;

commit;
