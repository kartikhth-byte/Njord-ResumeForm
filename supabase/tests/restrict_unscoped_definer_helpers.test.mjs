// Run from a scratch directory with @electric-sql/pglite installed:
// node restrict_unscoped_definer_helpers.test.mjs <path-to-2026110210.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
let passed = 0
let failed = 0
const test = async (name, run) => {
  try {
    await run()
    passed++
    console.log('PASS', name)
  } catch (error) {
    failed++
    console.log('FAIL', name, '-', error.message)
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const db = new PGlite()
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table public.applicants(email text);
  insert into public.applicants values ('synthetic@example.invalid');
  create table public.audit_events(message text);
  create function public.get_documents_needing_warnings()
    returns setof text language sql security definer
    as 'select email from public.applicants';
  create function public.get_documents_needing_warnings(integer)
    returns setof text language sql security definer
    as 'select email from public.applicants';
  create function public.write_audit_event(message text)
    returns integer language plpgsql security definer as $$
    begin insert into public.audit_events values (message); return 1; end $$;
  create function public.cleanup_old_expiry_records()
    returns integer language sql security definer as 'select 1';
  create function public.extract_expiries_for_application_sql(uuid)
    returns integer language sql security definer as 'select 1';
  create function public.extract_expiries_for_application(uuid)
    returns integer language sql security definer as 'select 1';
  create function public.trusted_write()
    returns integer language sql security definer
    as 'select public.write_audit_event(''trusted'')';
`)

const names = [
  'get_documents_needing_warnings()',
  'get_documents_needing_warnings(integer)',
  'write_audit_event(text)',
  'cleanup_old_expiry_records()',
  'extract_expiries_for_application_sql(uuid)',
  'extract_expiries_for_application(uuid)',
]
const permitted = async (role, name) =>
  (await db.query(`select has_function_privilege($1, $2, 'execute') as allowed`,
    [role, `public.${name}`])).rows[0].allowed

await test('reproduces default authenticated access', async () => {
  for (const name of names) assert(await permitted('authenticated', name), name)
})
await test('migration applies', () => db.exec(migration))
for (const name of names) {
  await test(`${name}: only service role can execute`, async () => {
    assert(!(await permitted('anon', name)), `anon can execute ${name}`)
    assert(!(await permitted('authenticated', name)), `authenticated can execute ${name}`)
    assert(await permitted('service_role', name), `service role cannot execute ${name}`)
  })
}
await test('authenticated direct warning call fails', async () => {
  await db.exec('set role authenticated')
  let denied = false
  try { await db.query('select * from public.get_documents_needing_warnings()') }
  catch { denied = true }
  finally { await db.exec('reset role') }
  assert(denied, 'warning call succeeded')
})
await test('trusted definer may still write an audit event', async () => {
  await db.exec('set role authenticated')
  try {
    const result = await db.query('select public.trusted_write() as written')
    assert(result.rows[0].written === 1, 'trusted call failed')
  } finally { await db.exec('reset role') }
  const result = await db.query('select count(*)::integer as n from public.audit_events')
  assert(result.rows[0].n === 1, 'audit event missing')
})
await test('migration is re-runnable', () => db.exec(migration))

const incomplete = new PGlite()
await incomplete.exec(`
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create function public.get_documents_needing_warnings()
    returns integer language sql security definer as 'select 1';
`)
await test('missing dependency aborts without partial revoke', async () => {
  let rejected = false
  try { await incomplete.exec(migration) } catch { rejected = true }
  assert(rejected, 'migration did not reject incomplete schema')
  await incomplete.exec('rollback')
  const result = await incomplete.query(`select has_function_privilege(
    'authenticated', 'public.get_documents_needing_warnings()', 'execute') as allowed`)
  assert(result.rows[0].allowed, 'grant was partly revoked')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1
