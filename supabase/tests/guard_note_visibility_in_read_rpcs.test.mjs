// Run from a scratch directory with @electric-sql/pglite installed:
// node guard_note_visibility_in_read_rpcs.test.mjs <path-to-2026110213.sql>
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const migration = fs.readFileSync(process.argv[2], 'utf8')
const master = '11111111-1111-4111-8111-111111111111'
const recruiter = '22222222-2222-4222-8222-222222222222'
const coordinator = '33333333-3333-4333-8333-333333333333'
const applicant = '44444444-4444-4444-8444-444444444444'
const prospect = '55555555-5555-4555-8555-555555555555'
const requirement = '66666666-6666-4666-8666-666666666666'
let passed = 0
let failed = 0
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const test = async (name, run) => {
  try { await run(); passed++; console.log('PASS', name) }
  catch (error) { failed++; console.log('FAIL', name, '-', error.message) }
}
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
  create function public.has_permission(user_uuid uuid, permission_name text)
    returns boolean language sql security definer as $$
    select user_uuid = auth.uid() and case
      when auth.uid() = '${master}' then true
      when auth.uid() = '${recruiter}' then permission_name in ('view_prospects', 'view_prospect_notes', 'view_requirements')
      when auth.uid() = '${coordinator}' then permission_name in ('view_prospects', 'view_requirements')
      else false end $$;
  create function public.is_master_recruiter_profile(profile_uuid uuid)
    returns boolean language sql security definer as $$
    select profile_uuid = auth.uid() and profile_uuid = '${master}' $$;
  create function public.resolve_audit_actor_display_name(uuid, text, text)
    returns text language sql as $$select 'Synthetic Actor'::text$$;
  create table public.prospects (
    id uuid primary key, name text, dob date, nationality_id uuid,
    rank_applied_for_id uuid, vessel_type_id uuid, exp_in_rank_months integer,
    previous_employer text, is_first_time_at_sea boolean, telephone text, email text,
    lead_source text, status text, first_contacted_at timestamptz,
    last_terminal_status text, last_terminal_status_at timestamptz,
    archived_at timestamptz, archive_reason text, deleted_at timestamptz,
    invited_at timestamptz, claimed_at timestamptz, applicant_user_id uuid,
    bounce_flag boolean, created_by_recruiter_id uuid, last_activity_at timestamptz,
    created_at timestamptz, updated_at timestamptz, version integer
  );
  insert into public.prospects(id, name) values ('${prospect}', 'Synthetic Candidate');
  create table public.prospect_notes (
    id uuid primary key, prospect_id uuid, body text, visibility text, created_at timestamptz
  );
  insert into public.prospect_notes values
    ('77777777-7777-4777-8777-777777777777', '${prospect}', 'internal note', 'internal', now()),
    ('88888888-8888-4888-8888-888888888888', '${prospect}', 'master secret', 'master_only', now());
  create table public.requirement_remarks (
    id uuid primary key, requirement_id uuid, body text, visibility text, created_at timestamptz
  );
  insert into public.requirement_remarks values
    ('99999999-9999-4999-8999-999999999999', '${requirement}', 'internal remark', 'internal', now()),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${requirement}', 'master remark', 'master_only', now());
  create table public.prospect_requirements (
    id uuid, prospect_id uuid, requirement_id uuid, updated_at timestamptz
  );
  create table public.applications (
    id uuid, prospect_id uuid, public_token text, reference_number text,
    status text, submitted_at timestamptz, created_at timestamptz, updated_at timestamptz
  );
  create table public.audit_log (
    id uuid, event_type text, created_at timestamptz, actor_type text,
    actor_user_id uuid, actor_role_at_event text, system_actor text,
    prospect_id uuid, requirement_id uuid, payload jsonb
  );
  insert into public.audit_log values
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'prospect.note_added', now(), 'recruiter', '${master}', 'Master Recruiter', null,
      '${prospect}', null, '{"prospect_note_id":"77777777-7777-4777-8777-777777777777","visibility":"internal","body":"old internal body"}'),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'prospect.note_edited', now(), 'recruiter', '${master}', 'Master Recruiter', null,
      '${prospect}', null, '{"prospect_note_id":"88888888-8888-4888-8888-888888888888","body":"old master body"}'),
    ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'prospect.contacted', now(), 'recruiter', '${master}', 'Master Recruiter', null,
      '${prospect}', null, '{"result":"ok"}'),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'requirement.remark_added', now(), 'recruiter', '${master}', 'Master Recruiter', null,
      null, '${requirement}', '{"requirement_remark_id":"99999999-9999-4999-8999-999999999999","visibility":"internal","body":"old internal remark"}'),
    ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'requirement.remark_edited', now(), 'recruiter', '${master}', 'Master Recruiter', null,
      null, '${requirement}', '{"requirement_remark_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","body":"old master remark"}');
  create function public.get_prospect_detail(p_prospect_id uuid) returns jsonb
    language sql security definer as $$
    select jsonb_build_object('notes', coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb))
    from public.prospect_notes n where n.prospect_id = p_prospect_id $$;
  create function public.get_prospect_activity(p_prospect_id uuid, p_limit integer default 25) returns jsonb
    language sql security definer as $$
    select coalesce(jsonb_agg(jsonb_build_object('event_type', event_type, 'payload', payload)), '[]'::jsonb)
    from public.audit_log where prospect_id = p_prospect_id $$;
  create function public.get_requirement_activity(p_requirement_id uuid, p_limit integer default 25) returns jsonb
    language sql security definer as $$
    select coalesce(jsonb_agg(jsonb_build_object('event_type', event_type, 'payload', payload)), '[]'::jsonb)
    from public.audit_log where requirement_id = p_requirement_id $$;
`)
const asUser = async (user, run) => {
  await db.exec('set role authenticated')
  await db.query(`select set_config('request.jwt.claim.role', 'authenticated', false),
    set_config('request.jwt.claim.sub', $1, false)`, [user])
  try { return await run() }
  finally {
    await db.exec('reset role')
    await db.exec(`reset "request.jwt.claim.role"; reset "request.jwt.claim.sub"`)
  }
}
const value = async (sql, params) => (await db.query(sql, params)).rows[0].result
const denied = async (run) => {
  let rejected = false
  try { await run() } catch { rejected = true }
  assert(rejected, 'call unexpectedly succeeded')
}

await test('reproduces Coordinator note leak', async () =>
  asUser(coordinator, async () => {
    const detail = await value('select public.get_prospect_detail($1) as result', [prospect])
    assert(detail.notes.length === 2, 'baseline detail did not expose notes')
  }))
await test('migration applies', () => db.exec(migration))
await test('Coordinator sees prospect but no notes or note events', async () =>
  asUser(coordinator, async () => {
    const detail = await value('select public.get_prospect_detail($1) as result', [prospect])
    assert(detail.prospect.name === 'Synthetic Candidate', 'prospect disappeared')
    assert(detail.notes.length === 0, 'Coordinator can read notes')
    const events = await value('select public.get_prospect_activity($1, 25) as result', [prospect])
    assert(events.length === 1 && events[0].event_type === 'prospect.contacted', 'note events leaked')
  }))
await test('Recruiter sees internal note, not master-only note', async () =>
  asUser(recruiter, async () => {
    const detail = await value('select public.get_prospect_detail($1) as result', [prospect])
    assert(detail.notes.length === 1 && detail.notes[0].body === 'internal note', 'note visibility wrong')
    const events = await value('select public.get_prospect_activity($1, 25) as result', [prospect])
    const noteEvents = events.filter(e => e.event_type.startsWith('prospect.note_'))
    assert(noteEvents.length === 1, 'master-only note event visible')
    assert(!('body' in noteEvents[0].payload), 'historical body leaked')
  }))
await test('Master sees both note types and full audit activity', async () =>
  asUser(master, async () => {
    const detail = await value('select public.get_prospect_detail($1) as result', [prospect])
    assert(detail.notes.length === 2, 'master notes missing')
    const events = await value('select public.get_prospect_activity($1, 25) as result', [prospect])
    assert(events.length === 3, 'master events missing')
    assert(events.some(e => e.payload.body === 'old master body'), 'master historical payload missing')
  }))
await test('Requirement activity hides master-only remark and historical body', async () =>
  asUser(recruiter, async () => {
    const events = await value('select public.get_requirement_activity($1, 25) as result', [requirement])
    assert(events.length === 1 && events[0].event_type === 'requirement.remark_added', 'master remark leaked')
    assert(!('body' in events[0].payload), 'historical remark body leaked')
  }))
await test('Master sees full requirement activity', async () =>
  asUser(master, async () => {
    const events = await value('select public.get_requirement_activity($1, 25) as result', [requirement])
    assert(events.length === 2, 'master remark activity missing')
  }))
await test('Applicant is denied all three RPCs', async () =>
  asUser(applicant, async () => {
    await denied(() => db.query('select public.get_prospect_detail($1)', [prospect]))
    await denied(() => db.query('select public.get_prospect_activity($1, 25)', [prospect]))
    await denied(() => db.query('select public.get_requirement_activity($1, 25)', [requirement]))
  }))
await test('migration is re-runnable', () => db.exec(migration))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1
