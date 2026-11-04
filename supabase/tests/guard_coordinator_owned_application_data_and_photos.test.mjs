// Run with @electric-sql/pglite installed in the module lookup path:
// node guard_coordinator_owned_application_data_and_photos.test.mjs <migration.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const db = new PGlite()
const migration = fs.readFileSync(process.argv[2], 'utf8')
const coordinator = '11111111-1111-4111-8111-111111111111'
const applicant = '22222222-2222-4222-8222-222222222222'
const recruiter = '33333333-3333-4333-8333-333333333333'
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
const blocked = async (run) => {
  try { return (await run()).rows.length === 0 }
  catch { return true }
}

await db.exec(`
  create role authenticated;
  create schema auth;
  create schema storage;
  grant usage on schema public, auth, storage to authenticated;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function public.is_recruiter(p_user uuid) returns boolean language sql stable security definer
    as $$ select p_user in ('${coordinator}'::uuid, '${recruiter}'::uuid) $$;
  create function public.has_permission(p_user uuid, p_name text) returns boolean language sql stable security definer
    as $$ select p_name='edit_junction_status' and p_user='${recruiter}'::uuid $$;
  create table public.application_data(id integer primary key, owner uuid, note text);
  create table public.application_photos(id integer primary key, owner uuid, note text);
  create table storage.objects(id integer primary key, bucket_id text, name text);
  insert into public.application_data values (1,'${coordinator}','old'),(2,'${applicant}','old');
  insert into public.application_photos values (1,'${coordinator}','old'),(2,'${applicant}','old');
  insert into storage.objects values
    (1,'application-photos','${coordinator}/photo.png'),
    (2,'application-photos','${applicant}/photo.png'),
    (3,'offer-letters','offer.pdf');
  alter table public.application_data enable row level security;
  alter table public.application_photos enable row level security;
  alter table storage.objects enable row level security;
  create policy owner_data on public.application_data to authenticated
    using (owner=auth.uid()) with check (owner=auth.uid());
  create policy owner_photo on public.application_photos to authenticated
    using (owner=auth.uid()) with check (owner=auth.uid());
  create policy owner_storage on storage.objects to authenticated
    using (name like auth.uid()::text || '/%') with check (name like auth.uid()::text || '/%');
  grant select,insert,update,delete on public.application_data, public.application_photos, storage.objects to authenticated;
`)

await test('old owner policies let Coordinator change own draft and photo', async () => {
  const data = await asUser(coordinator, () => db.query("update public.application_data set note='edited' where id=1 returning id"))
  const photo = await asUser(coordinator, () => db.query("update storage.objects set name=name where id=1 returning id"))
  if (data.rows.length !== 1 || photo.rows.length !== 1) throw new Error('old gap not reproduced')
})
await test('follow-up migration applies', async () => { await db.exec(migration) })
await test('Coordinator retains own-row read', async () => {
  for (const table of ['application_data', 'application_photos']) {
    const rows = await asUser(coordinator, () => db.query(`select id from public.${table} where id=1`))
    if (rows.rows.length !== 1) throw new Error(`${table} read lost`)
  }
  const photo = await asUser(coordinator, () => db.query('select id from storage.objects where id=1'))
  if (photo.rows.length !== 1) throw new Error('storage read lost')
})
await test('Coordinator cannot insert, update, or delete owned draft or photo rows', async () => {
  for (const table of ['application_data', 'application_photos']) {
    const results = await asUser(coordinator, async () => [
      await blocked(() => db.query(`insert into public.${table} values (3,'${coordinator}','new') returning id`)),
      await blocked(() => db.query(`update public.${table} set note='changed' where id=1 returning id`)),
      await blocked(() => db.query(`delete from public.${table} where id=1 returning id`)),
    ])
    if (results.some((result) => !result)) throw new Error(`${table} write remained open`)
  }
})
await test('Coordinator cannot upload, overwrite, or delete own-prefix photos', async () => {
  const results = await asUser(coordinator, async () => [
    await blocked(() => db.query(`insert into storage.objects values (4,'application-photos','${coordinator}/new.png') returning id`)),
    await blocked(() => db.query('update storage.objects set name=name where id=1 returning id')),
    await blocked(() => db.query('delete from storage.objects where id=1 returning id')),
  ])
  if (results.some((result) => !result)) throw new Error('storage photo write remained open')
})
await test('Applicant retains own draft and photo writes', async () => {
  for (const table of ['application_data', 'application_photos']) {
    const rows = await asUser(applicant, () => db.query(`update public.${table} set note='edited' where id=2 returning id`))
    if (rows.rows.length !== 1) throw new Error(`${table} applicant write lost`)
  }
  const photo = await asUser(applicant, () => db.query('update storage.objects set name=name where id=2 returning id'))
  if (photo.rows.length !== 1) throw new Error('applicant photo storage write lost')
})
await test('non-photo bucket is unchanged', async () => {
  const policies = await db.query("select count(*)::integer as n from pg_policies where schemaname='storage' and policyname like 'application_photos_coordinator_%'")
  if (policies.rows[0].n !== 3) throw new Error('photo bucket gates missing')
})

console.log(`\n${passed} passed, ${failed} failed`)
await db.close()
if (failed) process.exit(1)
