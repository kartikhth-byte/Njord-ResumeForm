// All-overload revoke for get_upcoming_events / get_expiring_certificates — PGlite, Supabase default privileges modelled.
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node revoke_all_unscoped_definer_overloads.test.mjs <path>/2026110203_revoke_unscoped_definer_functions.sql <path>/2026110209_revoke_all_unscoped_definer_overloads.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const [m0203, m0209] = process.argv.slice(2).map((p) => fs.readFileSync(p, 'utf8'))
let pass = 0, fail = 0
const t = async (n, f) => { try { await f(); pass++; console.log('PASS', n) } catch (e) { fail++; console.log('FAIL', n, '-', e.message) } }
const ok = (c, m) => { if (!c) throw new Error(m) }

{
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;`)
  await t('no-op when neither function exists', () => db.exec(m0209))
}

const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create table public.applicants(name text, email text);
  insert into applicants values ('Ann','ann@x.test');
  create function public.get_upcoming_events(recruiter_id uuid default null, days_ahead integer default 30)
    returns setof applicants language sql security definer as 'select * from applicants';
  create function public.get_upcoming_events(days_ahead integer)
    returns setof applicants language sql security definer as 'select * from applicants';
  create function public.get_expiring_certificates(days_ahead integer default 90)
    returns setof applicants language sql security definer as 'select * from applicants';
  create function public.get_expiring_certificates(recruiter_id uuid, days_ahead integer)
    returns setof applicants language sql security definer as 'select * from applicants';
  create function public.unrelated_helper() returns int language sql as 'select 1';
`)
await db.exec(m0203)
const priv = async (role, fn) => (await db.query(`select has_function_privilege($1, $2, 'execute') p`, [role, fn])).rows[0].p
await t('reproduces the gap: one-arg overload still open after 0203', async () => ok(await priv('authenticated', 'public.get_upcoming_events(integer)'), 'gap not reproduced'))

await t('0209 applies', () => db.exec(m0209))
const fns = ['public.get_upcoming_events(uuid, integer)', 'public.get_upcoming_events(integer)',
  'public.get_expiring_certificates(integer)', 'public.get_expiring_certificates(uuid, integer)']
for (const fn of fns) {
  await t(`${fn}: anon and authenticated denied, service_role allowed`, async () => {
    ok(!(await priv('anon', fn)) && !(await priv('authenticated', fn)), 'still executable')
    ok(await priv('service_role', fn), 'service_role denied')
  })
}
await t('authenticated call to one-arg overload fails', async () => {
  await db.exec('set role authenticated')
  let denied = false
  try { await db.query('select * from public.get_upcoming_events(7)') } catch { denied = true } finally { await db.exec('reset role') }
  ok(denied, 'call succeeded')
})
await t('unrelated functions untouched', async () => ok(await priv('authenticated', 'public.unrelated_helper()'), 'changed'))
await t('re-runnable', () => db.exec(m0209))
console.log(`\n${pass} passed, ${fail} failed`)
