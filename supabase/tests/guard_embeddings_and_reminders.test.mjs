// Run from a scratch directory with @electric-sql/pglite installed:
// node guard_embeddings_and_reminders.test.mjs <path-to-2026110215.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const recruiter = '11111111-1111-4111-8111-111111111111'
const applicant = '22222222-2222-4222-8222-222222222222'
const event = '33333333-3333-4333-8333-333333333333'
const otherEvent = '44444444-4444-4444-8444-444444444444'
let passed = 0
let failed = 0
const assert = (condition, message) => { if (!condition) throw new Error(message) }
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
const refused = async (run) => {
  try { await run(); return false }
  catch { return true }
}

const db = new PGlite()
await db.exec(`
  create role authenticated;
  create role service_role bypassrls;
  grant usage on schema public to authenticated, service_role;
  create schema auth;
  grant usage on schema auth to authenticated;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to authenticated;
  create table public.profiles(id uuid primary key, user_type text);
  insert into public.profiles values ('${recruiter}', 'recruiter'), ('${applicant}', 'applicant');
  create function public.is_recruiter(p_user uuid) returns boolean language sql stable security definer
    as $$ select exists(select 1 from public.profiles
                       where id=p_user and user_type='recruiter' and p_user=auth.uid()) $$;
  grant execute on function public.is_recruiter(uuid) to authenticated;
  create table public.application_embeddings(id integer generated always as identity primary key,
    application_id uuid, embedding text);
  create table public.scheduled_events(id uuid primary key, scheduled_by uuid);
  create table public.scheduled_reminders(id integer generated always as identity primary key,
    event_id uuid, reminder_type text);
  insert into public.scheduled_events values
    ('${event}', '${recruiter}'), ('${otherEvent}', '${applicant}');
  insert into public.application_embeddings(application_id, embedding)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'original');
  insert into public.scheduled_reminders(event_id, reminder_type)
    values ('${event}', '24h_before');
  alter table public.application_embeddings enable row level security;
  alter table public.scheduled_events enable row level security;
  alter table public.scheduled_reminders enable row level security;
  create policy "Recruiters can read embeddings" on public.application_embeddings
    for select to authenticated using (public.is_recruiter(auth.uid()));
  create policy "System can insert embeddings" on public.application_embeddings
    for insert to authenticated with check (true);
  create policy "System can update embeddings" on public.application_embeddings
    for update to authenticated using (true);
  create policy event_read on public.scheduled_events for select to authenticated
    using (public.is_recruiter(auth.uid()));
  create policy "Authenticated users can insert reminders" on public.scheduled_reminders
    for insert to authenticated with check (true);
  create policy "Users can view all reminders" on public.scheduled_reminders
    for select to authenticated using (true);
  grant select,insert,update on public.application_embeddings to authenticated;
  grant select on public.scheduled_events to authenticated;
  grant select,insert on public.scheduled_reminders to authenticated;
  grant usage on sequence public.application_embeddings_id_seq,
    public.scheduled_reminders_id_seq to authenticated;
`)

await test('old policies expose reminders to applicant', async () => {
  const rows = await asUser(applicant, () => db.query('select id from public.scheduled_reminders'))
  assert(rows.rows.length === 1, 'old reminder read gap not reproduced')
})
await test('old policies allow applicant embedding insert', async () => {
  await asUser(applicant, () => db.query(`insert into public.application_embeddings(application_id,embedding)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','forged')`))
  const { rows } = await db.query("select count(*)::integer as count from public.application_embeddings where embedding='forged'")
  assert(rows[0].count === 1, 'old embedding write gap not reproduced')
})
await test('migration applies', async () => { await db.exec(migration) })
await test('applicant cannot insert or update embeddings', async () => {
  const insertDenied = await asUser(applicant, () => refused(() => db.query(`insert into public.application_embeddings(application_id,embedding)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','forged')`)))
  const update = await asUser(applicant, () => db.query("update public.application_embeddings set embedding='forged' where id=1 returning id"))
  assert(insertDenied && update.rows.length === 0, 'applicant can still write embeddings')
})
await test('applicant cannot insert or read reminders', async () => {
  const insertDenied = await asUser(applicant, () => refused(() => db.query(`insert into public.scheduled_reminders(event_id,reminder_type)
    values ('${event}','forged')`)))
  const rows = await asUser(applicant, () => db.query('select id from public.scheduled_reminders'))
  assert(insertDenied && rows.rows.length === 0, 'applicant can still use reminders')
})
await test('recruiter can generate and refresh embeddings', async () => {
  const inserted = await asUser(recruiter, () => db.query(`insert into public.application_embeddings(application_id,embedding)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','generated') returning id`))
  const updated = await asUser(recruiter, () => db.query("update public.application_embeddings set embedding='refreshed' where id=1 returning id"))
  assert(inserted.rows.length === 1 && updated.rows.length === 1, 'recruiter embedding write broke')
})
await test('recruiter can add reminder for own event and read it', async () => {
  const inserted = await asUser(recruiter, () => db.query(`insert into public.scheduled_reminders(event_id,reminder_type)
    values ('${event}','interview_reminder') returning id`))
  const rows = await asUser(recruiter, () => db.query('select id from public.scheduled_reminders'))
  assert(inserted.rows.length === 1 && rows.rows.length >= 2, 'recruiter reminder flow broke')
})
await test('recruiter cannot add reminder for an event scheduled by someone else', async () => {
  const denied = await asUser(recruiter, () => refused(() => db.query(`insert into public.scheduled_reminders(event_id,reminder_type)
    values ('${otherEvent}','forged')`)))
  assert(denied, 'foreign event reminder was inserted')
})
await test('migration is re-runnable', async () => { await db.exec(migration) })

console.log(`\n${passed} passed, ${failed} failed`)
await db.close()
if (failed) process.exit(1)
