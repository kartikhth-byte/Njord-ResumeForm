// Run with @electric-sql/pglite installed in the module lookup path:
// node coordinator_read_only_application_workflow.test.mjs <migration.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const master = '11111111-1111-4111-8111-111111111111'
const recruiter = '22222222-2222-4222-8222-222222222222'
const coordinator = '33333333-3333-4333-8333-333333333333'
const applicant = '44444444-4444-4444-8444-444444444444'
const db = new PGlite()
let passed = 0
let failed = 0
const test = async (name, run) => {
  try { await run(); passed++; console.log('PASS', name) }
  catch (error) { failed++; console.log('FAIL', name, '-', error.message) }
}
const asUser = async (id, run) => {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id}', false)`)
  await db.exec('set role authenticated')
  try { return await run() }
  finally { await db.exec('reset role') }
}
const count = async (sql) => (await db.query(sql)).rows.length
const denied = async (run) => {
  try { return (await run()).rows.length === 0 }
  catch { return true }
}

await db.exec(`
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create schema storage;
  grant usage on schema public, auth, storage to authenticated;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table public.profiles(id uuid primary key, user_type text);
  insert into public.profiles values
    ('${master}', 'recruiter'), ('${recruiter}', 'recruiter'),
    ('${coordinator}', 'recruiter'), ('${applicant}', 'applicant');
  create function public.is_recruiter(p_user uuid) returns boolean language sql stable security definer
    as $$ select exists(select 1 from public.profiles where id=p_user and user_type='recruiter') $$;
  create function public.has_permission(p_user uuid, p_name text) returns boolean language sql stable security definer
    as $$ select p_name='edit_junction_status' and p_user in ('${master}'::uuid, '${recruiter}'::uuid) $$;
  create table public.applications(id integer primary key, owner uuid, status text);
  insert into public.applications values (1, '${applicant}', 'submitted');
  alter table public.applications enable row level security;
  create policy app_recruiter on public.applications to authenticated
    using (public.is_recruiter(auth.uid())) with check (public.is_recruiter(auth.uid()));
  create policy app_own on public.applications to authenticated
    using (owner=auth.uid()) with check (owner=auth.uid());
  grant select,insert,update,delete on public.applications to authenticated;
  create table storage.objects(id integer primary key, bucket_id text, name text);
  insert into storage.objects values (1, 'offer-letters', 'offer.pdf'), (2, 'application-photos', 'photo.png');
  alter table storage.objects enable row level security;
  create policy storage_recruiter on storage.objects to authenticated
    using (public.is_recruiter(auth.uid())) with check (public.is_recruiter(auth.uid()));
  grant select,insert,update,delete on storage.objects to authenticated;
`)

for (const table of [
  'scheduled_events', 'event_participants', 'event_history',
  'scheduled_reminders', 'application_embeddings', 'application_status_history_legacy',
]) {
  await db.exec(`
    create table public.${table}(id integer primary key, note text);
    insert into public.${table} values (1, 'original');
    alter table public.${table} enable row level security;
    create policy old_recruiter on public.${table} to authenticated
      using (public.is_recruiter(auth.uid())) with check (public.is_recruiter(auth.uid()));
    grant select,insert,update,delete on public.${table} to authenticated;
  `)
}

await test('old coarse policy lets Coordinator mutate an application', async () => {
  const rows = await asUser(coordinator, () => db.query("update public.applications set status='changed' where id=1 returning id"))
  if (rows.rows.length !== 1) throw new Error('gap did not reproduce')
})
await test('migration applies to all seven public write targets and private storage', async () => {
  await db.exec(migration)
})
await test('Coordinator can still view application, schedule, history, and offer letter', async () => {
  for (const table of ['applications', 'scheduled_events', 'event_participants', 'event_history']) {
    if (await asUser(coordinator, () => count(`select id from public.${table}`)) !== 1) throw new Error(`${table} read failed`)
  }
  if (await asUser(coordinator, () => count('select id from storage.objects where id=1')) !== 1) throw new Error('offer read failed')
})
await test('Coordinator cannot insert, update, or delete application', async () => {
  const blocked = await asUser(coordinator, async () => [
    await denied(() => db.query(`insert into public.applications values (2, '${coordinator}', 'draft') returning id`)),
    await denied(() => db.query("update public.applications set status='hired' where id=1 returning id")),
    await denied(() => db.query('delete from public.applications where id=1 returning id')),
  ])
  if (blocked.some((value) => !value)) throw new Error('application write remained open')
})
await test('Coordinator cannot write scheduling, history, reminder, or embedding rows', async () => {
  for (const table of [
    'scheduled_events', 'event_participants', 'event_history',
    'scheduled_reminders', 'application_embeddings', 'application_status_history_legacy',
  ]) {
    const blocked = await asUser(coordinator, async () => [
      await denied(() => db.query(`insert into public.${table} values (2, 'new') returning id`)),
      await denied(() => db.query(`update public.${table} set note='changed' where id=1 returning id`)),
      await denied(() => db.query(`delete from public.${table} where id=1 returning id`)),
    ])
    if (blocked.some((value) => !value)) throw new Error(`${table} write remained open`)
  }
})
await test('Coordinator cannot upload, overwrite, or delete offer letters', async () => {
  const blocked = await asUser(coordinator, async () => [
    await denied(() => db.query("insert into storage.objects values (3, 'offer-letters', 'new.pdf') returning id")),
    await denied(() => db.query("update storage.objects set name='changed.pdf' where id=1 returning id")),
    await denied(() => db.query('delete from storage.objects where id=1 returning id')),
  ])
  if (blocked.some((value) => !value)) throw new Error('offer letter write remained open')
})
await test('Recruiter and Master Recruiter retain application and scheduling writes', async () => {
  for (const actor of [recruiter, master]) {
    const rows = await asUser(actor, () => db.query("update public.applications set status='reviewing' where id=1 returning id"))
    const eventRows = await asUser(actor, () => db.query("update public.scheduled_events set note='changed' where id=1 returning id"))
    if (rows.rows.length !== 1 || eventRows.rows.length !== 1) throw new Error('editor lost write access')
  }
})
await test('Applicant retains own draft path but cannot edit recruiter workflow', async () => {
  const own = await asUser(applicant, () => db.query("update public.applications set status='draft' where id=1 returning id"))
  const other = await asUser(applicant, () => db.query("update public.scheduled_events set note='changed' where id=1 returning id"))
  if (own.rows.length !== 1 || other.rows.length !== 0) throw new Error('applicant path changed')
})
await test('Storage gate does not affect other buckets', async () => {
  const rows = await asUser(coordinator, () => db.query("update storage.objects set name='changed.png' where id=2 returning id"))
  if (rows.rows.length !== 1) throw new Error('unrelated bucket was gated')
})

console.log(`\n${passed} passed, ${failed} failed`)
await db.close()
if (failed) process.exit(1)
