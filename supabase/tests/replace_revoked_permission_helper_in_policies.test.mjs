// node replace_revoked_permission_helper_in_policies.test.mjs <migration.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const master = '11111111-1111-4111-8111-111111111111'
const recruiter = '22222222-2222-4222-8222-222222222222'
const coordinator = '33333333-3333-4333-8333-333333333333'
const applicant = '44444444-4444-4444-8444-444444444444'
const db = new PGlite()
let passed = 0

async function check(name, run) {
  await run()
  passed++
  console.log('PASS', name)
}

async function asUser(id, run) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${id}', false)`)
  await db.exec('set role authenticated')
  try { return await run() }
  finally { await db.exec('reset role') }
}

await db.exec(`
  create role authenticated;
  create role anon;
  create role service_role;
  create schema auth;
  grant usage on schema public, auth to authenticated;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to authenticated;
  create function public.check_permission(p_user uuid, p_permission text)
  returns boolean language sql security definer as $$
    select (p_user = '${master}'::uuid)
      or (p_user = '${recruiter}'::uuid and p_permission in ('view_applications', 'schedule_interviews'))
      or (p_user = '${coordinator}'::uuid and p_permission in ('view_applications', 'view_team')) $$;
  create function public.has_permission(p_user uuid, p_permission text)
  returns boolean language sql security definer as $$
    select p_user = auth.uid() and public.check_permission(p_user, p_permission) $$;
  revoke all on function public.check_permission(uuid,text) from public, anon, authenticated;
  grant execute on function public.has_permission(uuid,text) to authenticated;
  create table public.applications(id integer primary key, user_id uuid);
  insert into public.applications values (1, '${applicant}');
  grant select on public.applications to authenticated;
  create table public.scheduled_events(id integer primary key, application_id integer, note text);
  insert into public.scheduled_events values (1, 1, 'original');
  grant select, insert, update, delete on public.scheduled_events to authenticated;
  alter table public.scheduled_events enable row level security;
  create policy "Create events with permission" on public.scheduled_events
    for insert to authenticated with check (public.check_permission(auth.uid(), 'schedule_interviews'));
  create policy "Delete events with permission" on public.scheduled_events
    for delete to authenticated using (public.check_permission(auth.uid(), 'schedule_interviews'));
  create policy "Update events with permission" on public.scheduled_events
    for update to authenticated using (public.check_permission(auth.uid(), 'schedule_interviews'));
  create policy "View events with permission" on public.scheduled_events
    for select to authenticated using (
      public.check_permission(auth.uid(), 'view_applications')
      or exists (select 1 from public.applications
                 where applications.id = scheduled_events.application_id
                   and applications.user_id = auth.uid()));
  create policy coordinator_update_gate on public.scheduled_events as restrictive
    for update to authenticated using (public.has_permission(auth.uid(), 'schedule_interviews'));
  create table public.user_roles(user_id uuid primary key, role_id integer);
  insert into public.user_roles values ('${master}', 1), ('${recruiter}', 2), ('${coordinator}', 3);
  grant select, insert, update, delete on public.user_roles to authenticated;
  alter table public.user_roles enable row level security;
  create policy "Manage team can assign roles" on public.user_roles
    for insert to authenticated with check (public.check_permission(auth.uid(), 'manage_team'));
  create policy "Manage team can delete roles" on public.user_roles
    for delete to authenticated using (public.check_permission(auth.uid(), 'manage_team'));
  create policy "Manage team can update roles" on public.user_roles
    for update to authenticated using (public.check_permission(auth.uid(), 'manage_team'));
  create policy "Users can view roles" on public.user_roles
    for select to authenticated using (
      user_id = auth.uid() or public.check_permission(auth.uid(), 'view_team'));
`)

await check('old scheduled-event policy fails after helper revoke', async () => {
  let denied = false
  try { await asUser(coordinator, () => db.query('select id from public.scheduled_events')) }
  catch (error) { denied = /permission denied for function check_permission/.test(error.message) }
  if (!denied) throw new Error('expected the live policy regression')
})

await check('migration replaces all eight policy references', async () => {
  await db.exec(migration)
  const result = await db.query(`select count(*)::integer as n from pg_policies
    where schemaname='public' and (qual ilike '%check_permission(%' or with_check ilike '%check_permission(%')`)
  if (result.rows[0].n !== 0) throw new Error('direct helper reference remains')
})

await check('Coordinator reads events but cannot change them', async () => {
  const rows = await asUser(coordinator, () => db.query('select id from public.scheduled_events'))
  const write = await asUser(coordinator, () => db.query("update public.scheduled_events set note='changed' where id=1 returning id"))
  if (rows.rows.length !== 1 || write.rows.length !== 0) throw new Error('Coordinator policy mismatch')
})

await check('Recruiter can still edit events', async () => {
  const rows = await asUser(recruiter, () => db.query("update public.scheduled_events set note='changed' where id=1 returning id"))
  if (rows.rows.length !== 1) throw new Error('Recruiter lost event access')
})

await check('applicant sees their event but cannot edit it', async () => {
  const rows = await asUser(applicant, () => db.query('select id from public.scheduled_events'))
  const write = await asUser(applicant, () => db.query("update public.scheduled_events set note='changed' where id=1 returning id"))
  if (rows.rows.length !== 1 || write.rows.length !== 0) throw new Error('applicant policy mismatch')
})

await check('role rows remain self-readable and Master can manage team', async () => {
  const own = await asUser(recruiter, () => db.query('select user_id from public.user_roles'))
  const all = await asUser(master, () => db.query('select user_id from public.user_roles'))
  const edit = await asUser(master, () => db.query(`update public.user_roles set role_id=role_id where user_id='${recruiter}' returning user_id`))
  if (own.rows.length !== 1 || all.rows.length !== 3 || edit.rows.length !== 1) throw new Error('team policy mismatch')
})

await check('direct helper remains private and migration is repeatable', async () => {
  const result = await db.query(`select has_function_privilege('authenticated',
    'public.check_permission(uuid,text)', 'execute') as executable`)
  if (result.rows[0].executable) throw new Error('legacy helper became callable')
  await db.exec(migration)
})

console.log(`\n${passed} passed`)
await db.close()
