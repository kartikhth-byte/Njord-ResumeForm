// Run with PGlite: node fill_audit_log_action.test.mjs <path>/2026110206_fill_audit_log_action.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const db = new PGlite()
let passed = 0

const test = async (name, run) => {
  await run()
  passed += 1
  console.log(`PASS ${name}`)
}

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create table public.audit_log (
    id uuid primary key default gen_random_uuid(),
    action text not null,
    event_type text,
    entity_type text,
    payload jsonb not null default '{}'::jsonb
  );
`)

await test('migration applies', () => db.exec(migration))

await test('typed event fills legacy action', async () => {
  const { rows } = await db.query(`
    insert into public.audit_log (entity_type, event_type)
    values ('prospect', 'bounce_received')
    returning action, event_type
  `)
  if (rows[0].action !== 'bounce_received' || rows[0].event_type !== 'bounce_received') {
    throw new Error(JSON.stringify(rows[0]))
  }
})

await test('explicit legacy action remains unchanged', async () => {
  const { rows } = await db.query(`
    insert into public.audit_log (action, entity_type, event_type)
    values ('delete_recruiter', 'prospect', 'prospect.changed')
    returning action
  `)
  if (rows[0].action !== 'delete_recruiter') throw new Error(JSON.stringify(rows[0]))
})

await test('rows with no action or event_type still fail', async () => {
  try {
    await db.query(`insert into public.audit_log (entity_type) values ('prospect')`)
  } catch (error) {
    if (error.message.includes('null value in column "action"')) return
    throw error
  }
  throw new Error('missing action was accepted')
})

await test('trigger helper is not directly executable by browser roles', async () => {
  const { rows } = await db.query(`
    select has_function_privilege('anon', 'public.fill_audit_log_action()', 'execute') as anon,
           has_function_privilege('authenticated', 'public.fill_audit_log_action()', 'execute') as authenticated
  `)
  if (rows[0].anon || rows[0].authenticated) throw new Error(JSON.stringify(rows[0]))
})

await test('migration is repeatable', () => db.exec(migration))

console.log(`${passed} passed`)
