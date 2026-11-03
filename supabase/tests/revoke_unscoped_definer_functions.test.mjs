// Revoke unscoped definer functions — migration tests against an in-memory Postgres (PGlite).
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node revoke_unscoped_definer_functions.test.mjs <path-to>/supabase/migrations/2026110203_revoke_unscoped_definer_functions.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const sql = fs.readFileSync(process.argv[2], 'utf8')
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); pass++; console.log('PASS', name) } catch (e) { fail++; console.log('FAIL', name, '-', e.message) } }
const ok = (c, m) => { if (!c) throw new Error(m) }

// 1. functions absent: migration is a no-op
{
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;`)
  await t('no error when functions do not exist', () => db.exec(sql))
}
// 2. functions present and granted widely
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create function public.get_upcoming_events(recruiter_id uuid default null, days_ahead integer default 30)
    returns int language sql security definer as 'select 1';
  create function public.get_expiring_certificates(days_ahead integer default 90)
    returns int language sql security definer as 'select 1';
  grant execute on function public.get_upcoming_events(uuid, integer) to anon, authenticated, service_role;
  grant execute on function public.get_expiring_certificates(integer) to anon, authenticated, service_role;
`)
await db.exec(sql)
const priv = async (role, fn) => (await db.query(`select has_function_privilege($1, $2, 'execute') as p`, [role, fn])).rows[0].p
for (const fn of ['public.get_upcoming_events(uuid, integer)', 'public.get_expiring_certificates(integer)']) {
  await t(`${fn}: authenticated denied`, async () => ok(!(await priv('authenticated', fn)), 'still allowed'))
  await t(`${fn}: anon denied`, async () => ok(!(await priv('anon', fn)), 'still allowed'))
  await t(`${fn}: service_role allowed`, async () => ok(await priv('service_role', fn), 'denied'))
}
await t('re-runnable', () => db.exec(sql))
console.log(`\n${pass} passed, ${fail} failed`)
