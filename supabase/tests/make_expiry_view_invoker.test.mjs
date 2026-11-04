// Run from a scratch directory with @electric-sql/pglite installed:
// node make_expiry_view_invoker.test.mjs <path-to-2026110214.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const applicantOne = '11111111-1111-4111-8111-111111111111'
const applicantTwo = '22222222-2222-4222-8222-222222222222'
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
  create role service_role bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to authenticated;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to authenticated;
  create table public.applications(id uuid primary key, user_id uuid, submitted_at timestamptz);
  create table public.application_data(application_id uuid, expiry_date date);
  insert into public.applications values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${applicantOne}', now()),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${applicantTwo}', now());
  insert into public.application_data values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date + 7),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 14);
  alter table public.applications enable row level security;
  alter table public.application_data enable row level security;
  create policy applications_read on public.applications for select to authenticated
    using (user_id = auth.uid());
  create policy application_data_read on public.application_data for select to authenticated
    using (exists (select 1 from public.applications a
                  where a.id = application_id and a.user_id = auth.uid()));
  grant select on public.applications, public.application_data to authenticated, service_role;
  create view public.v_expiring_documents as
    select a.id, d.expiry_date from public.applications a
    join public.application_data d on d.application_id = a.id;
  grant select on public.v_expiring_documents to anon, authenticated, service_role;
`)

await test('owner-run view exposes both synthetic applicants to anon', async () => {
  await db.exec('set role anon')
  const { rows } = await db.query('select id from public.v_expiring_documents')
  assert(rows.length === 2, 'did not reproduce owner-view leak')
  await db.exec('reset role')
})

await test('migration applies', async () => { await db.exec(migration) })

await test('anonymous SELECT grant is removed', async () => {
  const { rows } = await db.query("select has_table_privilege('anon','public.v_expiring_documents','select') as allowed")
  assert(rows[0].allowed === false, 'anon can still select view')
})

await test('view now runs as caller', async () => {
  const { rows } = await db.query(`select reloptions from pg_class where oid='public.v_expiring_documents'::regclass`)
  assert(rows[0].reloptions.includes('security_invoker=true'), 'security_invoker missing')
})

await test('anon query is refused', async () => {
  await db.exec('set role anon')
  let refused = false
  try { await db.query('select * from public.v_expiring_documents') }
  catch { refused = true }
  await db.exec('reset role')
  assert(refused, 'anon query succeeded')
})

await test('authenticated applicant sees only own expiry', async () => {
  await db.exec(`select set_config('request.jwt.claim.sub', '${applicantOne}', false)`)
  await db.exec('set role authenticated')
  const { rows } = await db.query('select id from public.v_expiring_documents')
  await db.exec('reset role')
  assert(rows.length === 1 && rows[0].id === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS did not limit view')
})

await test('migration is re-runnable', async () => { await db.exec(migration) })

console.log(`\n${passed} passed, ${failed} failed`)
await db.close()
if (failed) process.exit(1)
