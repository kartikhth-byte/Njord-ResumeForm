// Run in a scratch directory with @electric-sql/pglite installed:
// node case_transition_replay.test.mjs <0603 migration>
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const db = new PGlite()
const caseId = '00000000-0000-4000-8000-000000000001'
const actorId = '00000000-0000-4000-8000-000000000002'
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  create function public.has_permission(actor uuid, permission text)
  returns boolean language sql stable as $$
    select coalesce(permission = any(string_to_array(current_setting('test.permissions', true), ',')), false)
  $$;
  create table public.recruitment_cases(
    id uuid primary key, organization_id uuid, status text, version integer, updated_at timestamptz
  );
  create table public.recruitment_case_events(
    case_id uuid, organization_id uuid, event_type text, from_status text,
    to_status text, reason text, payload jsonb, actor_id uuid, idempotency_key text
  );
  create function public.recruitment_case_is_terminal(status text)
  returns boolean language sql immutable as $$ select status in ('withdrawn', 'rejected', 'closed') $$;
  create function public.recruitment_case_allowed_next(status text)
  returns text[] language sql immutable as $$ select array['contacted']::text[] $$;
  insert into recruitment_cases values ('${caseId}', null, 'sourced', 1, now());
  insert into recruitment_case_events(case_id, idempotency_key)
    values ('${caseId}', 'backfill:2026110207');
  alter table recruitment_cases enable row level security;
  alter table recruitment_case_events enable row level security;
  grant usage on schema public, auth to authenticated;
`)
const migration = fs.readFileSync(process.argv[2], 'utf8')
await db.exec(migration)
await db.exec(migration)
const asActor = async (permissions, uid = actorId) => {
  await db.query("select set_config('test.uid', $1, false), set_config('test.permissions', $2, false)", [uid, permissions])
  await db.exec('set role authenticated')
}
const transition = (status, key = 'backfill:2026110207', reason = null) => db.query(
  'select * from public.recruitment_case_transition($1,$2,$3,$4,null,$5::jsonb)',
  [caseId, status, reason, key, '{}'],
)
const denied = (status, code) => assert.rejects(() => transition(status), (error) => error.code === code)

await asActor('', '')
await denied('contacted', '28000')
await asActor('') // Applicant: authenticated but no workflow permissions.
await denied('contacted', '42501')
await denied('withdrawn', '42501')
await asActor('view_requirements') // Coordinator/read access is not workflow authority.
await denied('contacted', '42501')
await asActor('withdraw_junctions')
await denied('contacted', '42501')
await denied(null, '42501')
assert.equal((await transition('withdrawn')).rows[0].status, 'sourced')
await asActor('edit_junction_status')
assert.equal((await transition('contacted')).rows[0].status, 'sourced')
assert.equal((await transition('contacted', 'new-transition')).rows[0].version, 2)
// A permitted retry still works after permission checks without reapplying state.
assert.equal((await transition('contacted', 'new-transition')).rows[0].version, 2)
await asActor('withdraw_junctions')
assert.equal((await transition('withdrawn', 'withdraw-transition', 'Synthetic exit')).rows[0].status, 'withdrawn')
assert.equal((await transition('withdrawn', 'withdraw-transition')).rows[0].version, 3)
await asActor('')
await denied('withdrawn', '42501')
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int as n from recruitment_case_events')).rows[0].n, 3)
assert.equal((await db.query("select has_function_privilege('anon','public.recruitment_case_transition(uuid,text,text,text,integer,jsonb)','execute') as allowed")).rows[0].allowed, false)
await db.close()
console.log('Case transition replay authorization: PASS (denied roles, authorized retry and withdraw-only transitions)')
