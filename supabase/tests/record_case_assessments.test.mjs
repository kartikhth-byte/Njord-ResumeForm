// Run from a scratch directory with @electric-sql/pglite installed:
// node record_case_assessments.test.mjs <case-v1-migration> <assessment-migration>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const recruiter = id(1)
const coordinator = id(2)
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
  create table public.perms(user_id uuid, name text);
  create function public.has_permission(u uuid, p text) returns boolean language sql stable as $$ select exists(select 1 from public.perms where user_id=u and name=p) $$;
  create table public.profiles(id uuid primary key);
  create table public.prospects(id uuid primary key);
  create table public.requirements(id uuid primary key);
  create table public.applications(id uuid primary key, prospect_id uuid, submitted_at timestamptz, created_at timestamptz default now());
  create table public.prospect_requirements(prospect_id uuid, requirement_id uuid, status text, created_at timestamptz default now());
  insert into public.profiles values ('${recruiter}'), ('${coordinator}');
  insert into public.perms values ('${recruiter}', 'edit_junction_status'), ('${recruiter}', 'view_requirements'), ('${coordinator}', 'view_requirements');
  insert into public.prospects values ('${id(11)}');
  insert into public.requirements values ('${id(21)}');
`)
await db.exec(fs.readFileSync(process.argv[2], 'utf8'))
await db.exec(fs.readFileSync(process.argv[3], 'utf8'))
await db.exec(fs.readFileSync(process.argv[3], 'utf8'))
const query = async (sql, params = []) => (await db.query(sql, params)).rows
const move = (caseId, status, reason = null, assessment = {}, version = null, key = null) => query(
  'select * from recruitment_case_transition($1::uuid,$2::text,$3::text,$4::text,$5::integer,$6::jsonb)',
  [caseId, status, reason, key, version, JSON.stringify(assessment)],
)
const expectError = async (fn, code) => assert.rejects(fn, (error) => error.message.includes(code))
await db.exec(`select set_config('test.uid','${recruiter}',false)`)
const row = (await query('select * from recruitment_case_open($1,$2,$3,$4)', [id(11), id(21), 'recruiter', 'open']))[0]
const oldSignature = await query('select * from recruitment_case_transition($1::uuid,$2::text,$3::text,$4::text,$5::integer)', [row.id, 'contacted', null, 'old-caller', row.version])
assert.equal(oldSignature[0].status, 'contacted')
await move(row.id, 'confirmed')
await expectError(() => move(row.id, 'test_scheduled'), 'assessment_time_required')
await expectError(() => move(row.id, 'test_scheduled', null, { scheduled_at: 'not-a-date' }), 'invalid_assessment_time')
await expectError(() => move(row.id, 'test_scheduled', null, { occurred_at: new Date().toISOString() }), 'assessment_time_required')
const scheduled = '2026-11-05T10:30:00.000Z'
const s = (await move(row.id, 'test_scheduled', null, { scheduled_at: scheduled, location: 'SMOKE test room', note: 'Synthetic' }, null, 'schedule-1'))[0]
assert.equal(s.status, 'test_scheduled')
const payload = (await query('select payload from recruitment_case_events where case_id=$1 and to_status=$2', [row.id, 'test_scheduled']))[0].payload
assert.equal(new Date(payload.scheduled_at).getTime(), new Date(scheduled).getTime())
assert.equal(payload.location, 'SMOKE test room')
await expectError(() => move(row.id, 'test_failed', null, { occurred_at: scheduled }), 'assessment_reason_required')
await expectError(() => move(row.id, 'test_no_show', null, { occurred_at: scheduled }), 'assessment_reason_required')
await expectError(() => move(row.id, 'test_passed', null, { occurred_at: 'bad' }), 'invalid_assessment_time')
await expectError(() => move(row.id, 'test_passed', null, { occurred_at: scheduled }, s.version - 1), 'version_conflict')
await db.exec(`select set_config('test.uid','${coordinator}',false)`)
await expectError(() => move(row.id, 'test_passed', null, { occurred_at: scheduled }), 'permission_denied')
await db.exec(`select set_config('test.uid','${recruiter}',false)`)
await move(row.id, 'test_no_show', 'SMOKE no-show', { occurred_at: scheduled }, s.version, 'no-show-1')
const eventCount = (await query('select count(*)::int n from recruitment_case_events where case_id=$1 and to_status=$2', [row.id, 'test_no_show']))[0].n
await move(row.id, 'test_no_show', 'SMOKE no-show', { occurred_at: scheduled }, s.version, 'no-show-1')
assert.equal((await query('select count(*)::int n from recruitment_case_events where case_id=$1 and to_status=$2', [row.id, 'test_no_show']))[0].n, eventCount)
await expectError(() => move(row.id, 'test_scheduled', null, { occurred_at: scheduled }), 'assessment_time_required')
await move(row.id, 'test_scheduled', null, { scheduled_at: scheduled })
await move(row.id, 'test_passed', null, { occurred_at: scheduled })
await move(row.id, 'interview_scheduled', null, { scheduled_at: scheduled })
await move(row.id, 'interview_passed', null, { occurred_at: scheduled, note: 'SMOKE panel' })
await expectError(() => move(row.id, 'selected', null, { occurred_at: scheduled }), 'assessment_not_allowed')
await move(row.id, 'selected')
assert.equal((await query('select status from recruitment_cases where id=$1', [row.id]))[0].status, 'selected')
assert.equal((await query("select has_function_privilege('anon', 'public.recruitment_case_transition(uuid,text,text,text,integer,jsonb)', 'execute') v"))[0].v, false)
assert.equal((await query("select has_function_privilege('authenticated', 'public.recruitment_case_transition(uuid,text,text,text,integer,jsonb)', 'execute') v"))[0].v, true)
console.log('Case assessment migration checks passed')
