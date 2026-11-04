// Run: node supabase/tests/allow_related_audit_context.test.mjs supabase/migrations/2026110220_allow_related_audit_context.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const db = new PGlite()
const prospect = '11111111-1111-4111-8111-111111111111'
const requirement = '22222222-2222-4222-8222-222222222222'
const junction = '33333333-3333-4333-8333-333333333333'
const application = '44444444-4444-4444-8444-444444444444'
let passed = 0

const test = async (name, run) => {
  await run()
  passed += 1
  console.log(`PASS ${name}`)
}

const insert = (entityType, ids = {}) => db.query(`
  insert into public.audit_log (entity_type, prospect_id, requirement_id, prospect_requirement_id, application_id)
  values ($1, $2, $3, $4, $5)
  returning entity_type, prospect_id, requirement_id, prospect_requirement_id, application_id
`, [entityType, ids.prospect ?? null, ids.requirement ?? null, ids.junction ?? null, ids.application ?? null])

const rejects = async (entityType, ids) => {
  try {
    await insert(entityType, ids)
  } catch (error) {
    if (error.message.includes('audit_log_typed_fk_check')) return
    throw error
  }
  throw new Error(`accepted invalid ${entityType} audit row`)
}

await db.exec(`
  create table public.audit_log (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null,
    prospect_id uuid,
    requirement_id uuid,
    prospect_requirement_id uuid,
    application_id uuid,
    constraint audit_log_typed_fk_check check (
      (entity_type = 'export' and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 0)
      or (entity_type <> 'export' and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 1)
    )
  );
`)

await test('old constraint rejects the attachment audit shape', () =>
  rejects('prospect_requirement', { prospect, requirement, junction }))
await test('migration applies', () => db.exec(migration))
await test('attachment audit retains all three searchable IDs', async () => {
  const { rows } = await insert('prospect_requirement', { prospect, requirement, junction })
  if (rows[0].prospect_id !== prospect || rows[0].requirement_id !== requirement || rows[0].prospect_requirement_id !== junction) {
    throw new Error(JSON.stringify(rows[0]))
  }
})
await test('application event can retain its prospect context', () =>
  insert('application', { prospect, application }))
await test('prospect event can retain its application context', () =>
  insert('prospect', { prospect, application }))
await test('single-ID events and ID-free exports remain valid', async () => {
  await insert('prospect', { prospect })
  await insert('requirement', { requirement })
  await insert('export')
})
await test('non-export events require their typed entity ID', async () => {
  await rejects('prospect_requirement', { prospect, requirement })
  await rejects('prospect', { requirement })
  await rejects('requirement', { prospect })
  await rejects('application', { prospect })
})
await test('exports cannot carry entity IDs or an unknown entity type', async () => {
  await rejects('export', { prospect })
  await rejects('unknown', { prospect })
})
await test('migration is repeatable', () => db.exec(migration))

console.log(`${passed} passed`)
