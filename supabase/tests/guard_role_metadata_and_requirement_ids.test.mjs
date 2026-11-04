// Run from a scratch directory with @electric-sql/pglite installed:
// node guard_role_metadata_and_requirement_ids.test.mjs <path-to-2026110211.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
let passed = 0
let failed = 0
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const test = async (name, run) => {
  try { await run(); passed++; console.log('PASS', name) }
  catch (error) { failed++; console.log('FAIL', name, '-', error.message) }
}
const db = new PGlite()

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '')
  $$;
  grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
  create table public.roles(id integer primary key, name text not null);
  create table public.permissions(id integer primary key, name text not null);
  create table public.user_roles(user_id uuid, role_id integer, assigned_at timestamptz);
  create table public.role_permissions(role_id integer, permission_id integer);
  insert into public.roles values (1, 'Recruiter'), (2, 'Coordinator');
  insert into public.permissions values (1, 'create_requirements');
  insert into public.user_roles values ('${owner}', 1, now()), ('${other}', 2, now());
  insert into public.role_permissions values (1, 1);
  create table public.requirement_id_sequences(
    req_year_month text primary key, next_sequence integer not null, updated_at timestamptz not null default now()
  );
  create table public.requirements(req_year_month text not null, req_sequence integer, req_id_display text);
  grant insert, select on public.requirements to authenticated;
  create function public.build_requirement_display_id(p_req_year_month text, p_req_sequence integer)
    returns text language sql stable as $$select p_req_year_month || '-' || p_req_sequence::text$$;
  create function public.get_user_role(user_uuid uuid) returns table(role_name text)
    language sql security definer as $$
    select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = user_uuid limit 1$$;
  create function public.get_user_permissions(user_uuid uuid) returns table(permission_name text)
    language sql security definer as $$
    select p.name from public.user_roles ur join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id where ur.user_id = user_uuid$$;
  create function public.check_permission(user_uuid uuid, permission_name text) returns boolean
    language sql security definer as $$
    select exists(select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = user_uuid and p.name = permission_name)$$;
  create function public.has_permission(user_uuid uuid, permission_name text) returns boolean
    language sql security definer as $$select public.check_permission(user_uuid, permission_name)$$;
  create function public.user_has_permission(p_user_id uuid, p_permission_key text) returns boolean
    language sql security definer as $$select public.check_permission(p_user_id, p_permission_key)$$;
  create function public.allocate_requirement_identifier(p_req_year_month text)
    returns table(req_sequence integer, req_id_display text)
    language plpgsql security definer set search_path = public, pg_temp as $$
    begin
      insert into public.requirement_id_sequences values (p_req_year_month, 1, now())
      on conflict (req_year_month) do nothing;
      update public.requirement_id_sequences set next_sequence = next_sequence + 1
      where req_year_month = p_req_year_month returning next_sequence - 1 into req_sequence;
      req_id_display := public.build_requirement_display_id(p_req_year_month, req_sequence);
      return next;
    end$$;
  create function public.prepare_requirement_row() returns trigger language plpgsql as $$
    begin
      select req_sequence, req_id_display into new.req_sequence, new.req_id_display
      from public.allocate_requirement_identifier(new.req_year_month);
      return new;
    end$$;
  create trigger requirements_prepare_row before insert on public.requirements
    for each row execute function public.prepare_requirement_row();
  alter table public.requirements enable row level security;
  create policy requirements_insert on public.requirements for insert to authenticated
    with check (public.has_permission(auth.uid(), 'create_requirements'));
  create policy requirements_read on public.requirements for select to authenticated
    using (public.has_permission(auth.uid(), 'create_requirements'));
  create function public.trusted_role_lookup(user_uuid uuid) returns text language sql security definer
    as $$select role_name from public.get_user_role(user_uuid)$$;
  grant execute on function public.trusted_role_lookup(uuid) to authenticated;
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
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const denied = async (run) => {
  let rejected = false
  try { await run() } catch { rejected = true }
  assert(rejected, 'call unexpectedly succeeded')
}

await test('reproduces cross-user role and permission leak', async () =>
  asRole('authenticated', other, async () => {
    assert((await scalar('select role_name from public.get_user_role($1)', [owner])).role_name === 'Recruiter', 'role lookup did not leak')
    assert((await scalar('select public.has_permission($1, $2) as allowed', [owner, 'create_requirements'])).allowed, 'permission lookup did not leak')
  }))
await test('migration applies', () => db.exec(migration))
await test('all direct metadata lookups deny clients and allow service role', async () => {
  const functions = ['get_user_role(uuid)', 'get_user_permissions(uuid)', 'check_permission(uuid,text)', 'user_has_permission(uuid,text)']
  for (const fn of functions) {
    for (const role of ['anon', 'authenticated']) {
      assert(!(await scalar(`select has_function_privilege($1, $2, 'execute') as allowed`, [role, `public.${fn}`])).allowed, `${role} can execute ${fn}`)
    }
    assert((await scalar(`select has_function_privilege('service_role', $1, 'execute') as allowed`, [`public.${fn}`])).allowed, `service role lost ${fn}`)
  }
})
await test('direct role lookup fails but trusted definer still works', async () =>
  asRole('authenticated', other, async () => {
    await denied(() => db.query('select * from public.get_user_role($1)', [owner]))
    assert((await scalar('select public.trusted_role_lookup($1) as name', [owner])).name === 'Recruiter', 'trusted lookup failed')
  }))
await test('RLS permission probe allows self but not another user', async () =>
  asRole('authenticated', owner, async () => {
    assert((await scalar('select public.has_permission($1, $2) as allowed', [owner, 'create_requirements'])).allowed, 'self permission denied')
    assert(!(await scalar('select public.has_permission($1, $2) as allowed', [other, 'create_requirements'])).allowed, 'other permission leaked')
  }))
await test('coordinator cannot probe recruiter permissions', async () =>
  asRole('authenticated', other, async () =>
    assert(!(await scalar('select public.has_permission($1, $2) as allowed', [owner, 'create_requirements'])).allowed, 'cross-user probe succeeded')))
await test('recruiter cannot consume an ID via direct RPC', async () =>
  asRole('authenticated', owner, async () =>
    denied(() => db.query(`select * from public.allocate_requirement_identifier('2026-11')`))))
await test('coordinator cannot consume an ID via direct RPC', async () =>
  asRole('authenticated', other, async () =>
    denied(() => db.query(`select * from public.allocate_requirement_identifier('2026-11')`))))
await test('normal recruiter INSERT allocates an ID through the trigger', async () =>
  asRole('authenticated', owner, async () => {
    await db.exec(`insert into public.requirements(req_year_month) values ('2026-11')`)
    const row = await scalar(`select req_sequence, req_id_display from public.requirements`)
    assert(row.req_sequence === 1 && row.req_id_display === '2026-11-1', 'insert did not allocate ID')
  }))
await test('coordinator INSERT is rejected without consuming an ID', async () =>
  asRole('authenticated', other, async () =>
    denied(() => db.exec(`insert into public.requirements(req_year_month) values ('2026-11')`))))
await test('failed calls did not advance sequence', async () => {
  const row = await scalar(`select next_sequence from public.requirement_id_sequences where req_year_month = '2026-11'`)
  assert(row.next_sequence === 2, `unexpected next_sequence: ${row.next_sequence}`)
})
await test('service role may allocate directly', async () =>
  asRole('service_role', '', async () => {
    const row = await scalar(`select * from public.allocate_requirement_identifier('2026-11')`)
    assert(row.req_sequence === 2, 'service role allocation failed')
  }))
await test('migration is re-runnable', () => db.exec(migration))

const incomplete = new PGlite()
await test('missing dependency aborts before changes', async () => {
  await denied(() => incomplete.exec(migration))
  await incomplete.exec('rollback')
  assert((await incomplete.query(`select to_regprocedure('public.allocate_requirement_identifier(text)') as fn`)).rows[0].fn === null,
    'migration left a partial allocator')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1
