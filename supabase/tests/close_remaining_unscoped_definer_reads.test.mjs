// Run from a scratch directory with @electric-sql/pglite installed:
// node close_remaining_unscoped_definer_reads.test.mjs <path-to-2026110212.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const master = '11111111-1111-4111-8111-111111111111'
const applicant = '22222222-2222-4222-8222-222222222222'
let passed = 0
let failed = 0
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const test = async (name, run) => {
  try { await run(); passed++; console.log('PASS', name) }
  catch (error) { failed++; console.log('FAIL', name, '-', error.message) }
}
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
  create table public.profiles(id uuid primary key, user_type text);
  insert into public.profiles values ('${master}', 'recruiter'), ('${applicant}', 'applicant');
  create table public.roles(id integer primary key, name text);
  create table public.user_roles(user_id uuid, role_id integer);
  insert into public.roles values (1, 'Master Recruiter');
  insert into public.user_roles values ('${master}', 1);
  create function public.master_recruiter_role_name() returns text language sql
    as $$select 'Master Recruiter'::text$$;
  create table public.requirements(id uuid primary key, status text, positions_required integer, deleted_by uuid);
  create table public.prospect_requirements(requirement_id uuid, status text);
  insert into public.requirements values ('33333333-3333-4333-8333-333333333333', 'open', 1, null);
  create table public.document_expiries(expiry_date date);
  insert into public.document_expiries values (current_date + 7);
  create function public.get_urgency_level(expiry_date date) returns text language sql
    as $$select 'urgent'::text$$;
  create function public.days_until_expiry(expiry_date date) returns integer language sql
    as $$select expiry_date - current_date$$;
  create function public.is_document_expired(expiry_date date) returns boolean language sql
    as $$select expiry_date < current_date$$;
  create function public.get_expiring_documents_summary()
    returns table(urgency_level text, count bigint) language sql security definer
    as $$select 'urgent'::text, count(*) from public.document_expiries$$;
  create function public.get_team_stats() returns json language sql security definer
    as $$select json_build_object('total', count(*)) from public.profiles$$;
  create function public.compute_should_prompt_close(p_requirement_id uuid)
    returns boolean language sql security definer as $$
    select exists(select 1 from public.requirements where id = p_requirement_id and status = 'open')$$;
  create function public.current_recruiter_role_name(profile_uuid uuid)
    returns text language sql stable security definer set search_path = public, pg_temp as $$
    select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = profile_uuid limit 1$$;
  create function public.is_master_recruiter_profile(profile_uuid uuid)
    returns boolean language sql stable security definer set search_path = public, pg_temp as $$
    select exists(select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = profile_uuid and r.name = 'Master Recruiter')$$;
  create function public.is_recruiter(p_user uuid)
    returns boolean language sql stable security definer set search_path = public, pg_temp as $$
    select exists(select 1 from public.profiles where id = p_user and user_type = 'recruiter')$$;
  create function public.trusted_close_prompt(p_requirement_id uuid) returns boolean
    language sql security definer as $$select public.compute_should_prompt_close(p_requirement_id)$$;
  create function public.prepare_requirement_delete() returns trigger language plpgsql as $$
    begin
      if public.current_recruiter_role_name(auth.uid()) is null then
        raise exception 'role required';
      end if;
      new.deleted_by := auth.uid();
      return new;
    end$$;
  create trigger requirement_delete_guard before update on public.requirements
    for each row execute function public.prepare_requirement_delete();
  grant update, select on public.requirements to authenticated;
`)
const asRole = async (role, user, run) => {
  await db.exec(`set role ${role}`)
  await db.query(`select set_config('request.jwt.claim.role', $1, false),
    set_config('request.jwt.claim.sub', $2, false)`, [role, user || ''])
  try { return await run() }
  finally {
    await db.exec('reset role')
    await db.exec(`reset "request.jwt.claim.role"; reset "request.jwt.claim.sub"`)
  }
}
const row = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const denied = async (run) => {
  let rejected = false
  try { await run() } catch { rejected = true }
  assert(rejected, 'call unexpectedly succeeded')
}

await test('reproduces unguarded reads and cross-user role probes', async () =>
  asRole('authenticated', applicant, async () => {
    assert((await row('select * from public.get_expiring_documents_summary()')).count === 1, 'expiry count not exposed')
    assert((await row('select public.get_team_stats() as result')).result.total === 2, 'team count not exposed')
    assert((await row('select public.compute_should_prompt_close($1) as result', ['33333333-3333-4333-8333-333333333333'])).result, 'close prompt not exposed')
    assert((await row('select public.current_recruiter_role_name($1) as result', [master])).result === 'Master Recruiter', 'role name not exposed')
    assert((await row('select public.is_master_recruiter_profile($1) as result', [master])).result, 'master membership not exposed')
    assert((await row('select public.is_recruiter($1) as result', [master])).result, 'recruiter membership not exposed')
  }))
await test('migration applies', () => db.exec(migration))
await test('unscoped reads are service-role only', async () => {
  for (const fn of ['get_expiring_documents_summary()', 'get_team_stats()', 'compute_should_prompt_close(uuid)']) {
    for (const role of ['anon', 'authenticated']) {
      assert(!(await row(`select has_function_privilege($1, $2, 'execute') as allowed`, [role, `public.${fn}`])).allowed, `${role} can execute ${fn}`)
    }
    assert((await row(`select has_function_privilege('service_role', $1, 'execute') as allowed`, [`public.${fn}`])).allowed, `service role lost ${fn}`)
  }
})
await test('direct expiry and team reads fail for applicant', async () =>
  asRole('authenticated', applicant, async () => {
    await denied(() => db.query('select * from public.get_expiring_documents_summary()'))
    await denied(() => db.query('select public.get_team_stats()'))
    await denied(() => db.query('select public.compute_should_prompt_close($1)', ['33333333-3333-4333-8333-333333333333']))
  }))
await test('permission-checked definer may still call close-prompt helper', async () =>
  asRole('authenticated', master, async () =>
    assert((await row('select public.trusted_close_prompt($1) as result', ['33333333-3333-4333-8333-333333333333'])).result, 'trusted call failed')))
await test('recruiter can read own role and membership', async () =>
  asRole('authenticated', master, async () => {
    assert((await row('select public.current_recruiter_role_name($1) as result', [master])).result === 'Master Recruiter', 'own role denied')
    assert((await row('select public.is_master_recruiter_profile($1) as result', [master])).result, 'own master membership denied')
    assert((await row('select public.is_recruiter($1) as result', [master])).result, 'own recruiter membership denied')
  }))
await test('applicant cannot probe recruiter role or membership', async () =>
  asRole('authenticated', applicant, async () => {
    assert((await row('select public.current_recruiter_role_name($1) as result', [master])).result === null, 'role name leaked')
    assert(!(await row('select public.is_master_recruiter_profile($1) as result', [master])).result, 'master membership leaked')
    assert(!(await row('select public.is_recruiter($1) as result', [master])).result, 'recruiter membership leaked')
  }))
await test('requirement update trigger can still read acting recruiter role', async () =>
  asRole('authenticated', master, async () => {
    await db.exec(`update public.requirements set status = 'closed'`)
    assert((await row('select deleted_by from public.requirements')).deleted_by === master, 'trigger lost actor')
  }))
await test('service role can inspect role and summary', async () =>
  asRole('service_role', '', async () => {
    assert((await row('select public.current_recruiter_role_name($1) as result', [master])).result === 'Master Recruiter', 'service role lookup failed')
    assert((await row('select public.is_master_recruiter_profile($1) as result', [master])).result, 'service role membership failed')
    assert((await row('select public.is_recruiter($1) as result', [master])).result, 'service role recruiter check failed')
    assert((await row('select public.get_team_stats() as result')).result.total === 2, 'service role summary failed')
  }))
await test('migration is re-runnable', () => db.exec(migration))

const incomplete = new PGlite()
await test('missing dependency aborts before any changes', async () => {
  await denied(() => incomplete.exec(migration))
  await incomplete.exec('rollback')
  assert((await incomplete.query(`select to_regprocedure('public.get_team_stats()') as fn`)).rows[0].fn === null,
    'migration left partial objects')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1
