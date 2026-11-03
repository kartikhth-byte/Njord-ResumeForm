// Invite/bounce RPC repair — tests against an in-memory Postgres (PGlite), modelling Supabase default privileges.
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node repair_invite_bounce_rpcs.test.mjs <path>/2026110205_repair_invite_bounce_rpcs.sql <path>/2026060309_prospect_invite_bounce.sql <path>/2026060308_deep_read_rpcs.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const [repairPath, o309Path, o308Path] = process.argv.slice(2)
const repair = fs.readFileSync(repairPath, 'utf8')
const U = (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0')
const master = U(1), recruiter = U(2), applicant = U(3), noPerm = U(4)
const P1 = U(101), P2 = U(102)

// Base schema modelled on production, including Supabase default privileges.
const base = (withAudit = true) => `
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 grant usage on schema public to anon, authenticated, service_role;
 alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
 alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
 create schema auth; grant usage on schema auth to anon, authenticated, service_role;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
 grant execute on function auth.uid() to anon, authenticated, service_role;
 create table public.profiles(id uuid primary key, full_name text, email text, user_type text);
 create table public.roles(id serial primary key, name text unique);
 create table public.user_roles(user_id uuid, role_id int);
 create table public.perms(user_id uuid, permission text);
 insert into profiles values ('${master}','Mia Master','m@x.test','recruiter'),('${recruiter}','Rex Rec','r@x.test','recruiter'),('${applicant}','Ann App','a@x.test','applicant'),('${noPerm}','Nora','n@x.test','recruiter');
 insert into roles(name) values ('Master Recruiter'),('Recruiter'),('Viewer');
 insert into user_roles values ('${master}',2),('${master}',1),('${recruiter}',2),('${noPerm}',3);
 insert into perms values ('${master}','send_prospect_invites'),('${master}','edit_prospects'),('${recruiter}','send_prospect_invites'),('${recruiter}','edit_prospects');
 create function public.master_recruiter_role_name() returns text language sql immutable as $$ select 'Master Recruiter'::text $$;
 create function public.has_permission(user_uuid uuid, permission_name text) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from perms where user_id=user_uuid and permission=permission_name) $$;
 create function public.get_user_role(user_uuid uuid) returns table(role_name text) language sql stable security definer set search_path = public as $$ select r.name from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=user_uuid order by r.id limit 1 $$;
 create table public.audit_events(id uuid primary key default gen_random_uuid(), entity_type text, event_type text, actor_type text, actor_user_id uuid, prospect_id uuid, payload jsonb);
 ${withAudit ? `create function public.write_audit_event(p_entity_type text, p_event_type text, p_actor_type text, p_actor_user_id uuid default null, p_actor_role_at_event text default null, p_system_actor text default null, p_correlation_id uuid default null, p_prospect_id uuid default null, p_requirement_id uuid default null, p_prospect_requirement_id uuid default null, p_application_id uuid default null, p_payload jsonb default '{}'::jsonb) returns uuid language plpgsql security definer set search_path = public as $f$ declare i uuid; begin insert into audit_events(entity_type,event_type,actor_type,actor_user_id,prospect_id,payload) values (p_entity_type,p_event_type,p_actor_type,p_actor_user_id,p_prospect_id,p_payload) returning id into i; return i; end $f$;` : ''}
 create table public.prospects(id uuid primary key, name text, email text, email_normalized text generated always as (lower(btrim(email))) stored, status text, bounce_flag boolean not null default false, invited_at timestamptz, last_activity_at timestamptz, archived_at timestamptz, deleted_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
 insert into prospects(id,name,email,status) values ('${P1}','Sam Sailor','Sam@Sea.test','approved'),('${P2}','Pat Pending','pat@sea.test','new');
`

let pass = 0, fail = 0
const t = async (n, f) => { try { await f(); pass++; console.log('PASS', n) } catch (e) { fail++; console.log('FAIL', n, '-', e.message) } }
const ok = (c, m) => { if (!c) throw new Error(m) }
const mk = (db) => ({
  as: async (role, uid, sql) => {
    await db.exec(`reset role; select set_config('test.uid','${uid ?? ''}',false); set role ${role};`)
    try { return await db.query(sql) } finally { await db.exec('reset role') }
  },
  denied: async function (role, uid, sql) { try { await this.as(role, uid, sql); return false } catch { return true } },
  one: async (sql) => (await db.query(sql)).rows[0],
})

// 1. Missing dependency: precheck aborts, nothing is created.
await t('precheck aborts when write_audit_event is missing; nothing created', async () => {
  const db = new PGlite(); await db.exec(base(false))
  let msg = ''
  try { await db.exec(repair) } catch (e) { msg = e.message }
  try { await db.exec('rollback') } catch {}
  ok(msg.includes('missing dependencies') && msg.includes('write_audit_event'), 'error: ' + msg)
  const r = (await db.query(`select to_regclass('public.prospect_email_webhook_events') t, to_regprocedure('public.reserve_prospect_invite(uuid,uuid,text,text)') f,
    exists(select 1 from information_schema.columns where table_name='prospects' and column_name='invited_by_recruiter_id') c`)).rows[0]
  ok(r.t === null && r.f === null && r.c === false, JSON.stringify(r))
})

// 2. Production-like database: objects absent.
const db = new PGlite(); await db.exec(base()); const h = mk(db)
await t('applies on production-like database', () => db.exec(repair))

await t('column, FK, index and table restored', async () => {
  const r = await h.one(`select
    exists(select 1 from information_schema.columns where table_name='prospects' and column_name='invited_by_recruiter_id' and data_type='uuid') col,
    exists(select 1 from pg_constraint where conrelid='public.prospects'::regclass and contype='f' and confdeltype='n') fk,
    to_regclass('public.prospects_invited_by_recruiter_id_idx') is not null idx,
    (select relrowsecurity from pg_class where oid='public.prospect_email_webhook_events'::regclass) rls`)
  ok(r.col && r.fk && r.idx && r.rls, JSON.stringify(r))
})

await t('webhook table: no privileges for anon/authenticated, service_role can write', async () => {
  const r = await h.one(`select
    bool_or(has_table_privilege(r, 'public.prospect_email_webhook_events', p)) filter (where r in ('anon','authenticated')) leaked,
    bool_and(has_table_privilege('service_role', 'public.prospect_email_webhook_events', p)) svc
    from unnest(array['anon','authenticated']) r, unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p`)
  ok(r.leaked === false, 'anon/auth privilege present')
  const s = await h.one(`select bool_and(has_table_privilege('service_role','public.prospect_email_webhook_events',p)) ok from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p`)
  ok(s.ok, 'service_role missing privilege')
  ok(await h.denied('anon', null, `select * from prospect_email_webhook_events`), 'anon select allowed')
  ok(await h.denied('authenticated', recruiter, `insert into prospect_email_webhook_events(svix_id,event_type) values ('x','bounce')`), 'auth insert allowed')
})

await t('webhook dedupe insert as service_role; duplicate rejected', async () => {
  await h.as('service_role', null, `insert into prospect_email_webhook_events(svix_id,event_type,payload) values ('msg_1','email.bounced','{}')`)
  ok(await h.denied('service_role', null, `insert into prospect_email_webhook_events(svix_id,event_type) values ('msg_1','email.bounced')`), 'duplicate allowed')
})

const fnMatrix = {
  'public.current_recruiter_role_name(uuid)': { anon: false, authenticated: true, service_role: true },
  'public.reserve_prospect_invite(uuid,uuid,text,text)': { anon: false, authenticated: false, service_role: true },
  'public.release_prospect_invite_reservation(uuid,uuid,text,text)': { anon: false, authenticated: false, service_role: true },
  'public.record_prospect_email_bounce(text,uuid,jsonb,timestamptz)': { anon: false, authenticated: false, service_role: true },
  'public.update_prospect_email_and_clear_bounce(uuid,text,text)': { anon: false, authenticated: true, service_role: true },
}
const checkGrants = async (d) => {
  for (const [fn, exp] of Object.entries(fnMatrix)) {
    const sec = (await d.query(`select prosecdef from pg_proc where oid=to_regprocedure('${fn}')`)).rows[0]
    ok(sec?.prosecdef === true, fn + ' missing or not security definer')
    for (const [role, want] of Object.entries(exp)) {
      const got = (await d.query(`select has_function_privilege('${role}', '${fn}', 'EXECUTE') g`)).rows[0].g
      ok(got === want, `${fn} ${role}: ${got} != ${want}`)
    }
  }
}
await t('function execute grants match matrix (security definer)', () => checkGrants(db))

await t('retired 0307 claim helpers not restored', async () => {
  const r = await h.one(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and proname in ('current_request_email','claim_applicant_session','edit_prospect_email_preclaim')`)
  ok(r.n === 0, 'found ' + r.n)
})

await t('current_recruiter_role_name prefers Master Recruiter', async () => {
  const r = await h.one(`select public.current_recruiter_role_name('${master}') m, public.current_recruiter_role_name('${recruiter}') r, public.current_recruiter_role_name('${applicant}') a`)
  ok(r.m === 'Master Recruiter' && r.r === 'Recruiter' && r.a === null, JSON.stringify(r))
})

await t('invoker trigger-style caller (authenticated) can use role helper', async () => {
  await db.exec(`create function public.invoker_probe() returns text language sql as $$ select public.current_recruiter_role_name(auth.uid()) $$; grant execute on function public.invoker_probe() to authenticated;`)
  const r = await h.as('authenticated', recruiter, `select public.invoker_probe() v`)
  ok(r.rows[0].v === 'Recruiter', JSON.stringify(r.rows))
})

await t('anon cannot call role helper', async () => ok(await h.denied('anon', null, `select public.current_recruiter_role_name('${master}')`), 'allowed'))
await t('authenticated cannot call reserve_prospect_invite directly', async () => ok(await h.denied('authenticated', recruiter, `select public.reserve_prospect_invite('${P1}','${recruiter}','Recruiter',null)`), 'allowed'))

await t('reserve: sent, then already_sent within 5 minutes', async () => {
  const a = (await h.as('service_role', null, `select public.reserve_prospect_invite('${P1}','${recruiter}','Recruiter','  hi ') r`)).rows[0].r
  ok(a.invite_state === 'sent' && a.invited_by_recruiter_name === 'Rex Rec' && a.message === 'hi', JSON.stringify(a))
  const b = (await h.as('service_role', null, `select public.reserve_prospect_invite('${P1}','${master}','Master Recruiter',null) r`)).rows[0].r
  ok(b.invite_state === 'already_sent' && b.invited_by_recruiter_id === recruiter, JSON.stringify(b))
})
await t('reserve: actor without permission rejected', async () => ok(await h.denied('service_role', null, `select public.reserve_prospect_invite('${P1}','${noPerm}','Viewer',null)`), 'allowed'))
await t('reserve: non-approved prospect rejected', async () => ok(await h.denied('service_role', null, `select public.reserve_prospect_invite('${P2}','${recruiter}','Recruiter',null)`), 'allowed'))
await t('release clears the reservation', async () => {
  const r = (await h.as('service_role', null, `select public.release_prospect_invite_reservation('${P1}','${recruiter}','Recruiter','send failed') r`)).rows[0].r
  ok(r.invite_state === 'released' && r.reason === 'send failed', JSON.stringify(r))
  const p = await h.one(`select invited_at, invited_by_recruiter_id from prospects where id='${P1}'`)
  ok(p.invited_at === null && p.invited_by_recruiter_id === null, JSON.stringify(p))
})
await t('record bounce by email (case-insensitive) sets bounce_flag + audit', async () => {
  const r = (await h.as('service_role', null, `select public.record_prospect_email_bounce('  SAM@sea.test ', null, '{"email_id":"e1"}', now()) r`)).rows[0].r
  ok(r.matched === true && r.prospect_id === P1, JSON.stringify(r))
  const p = await h.one(`select bounce_flag from prospects where id='${P1}'`); ok(p.bounce_flag === true, 'flag not set')
  const a = await h.one(`select count(*)::int n from audit_events where event_type='bounce_received' and prospect_id='${P1}'`); ok(a.n === 1, 'audit ' + a.n)
})
await t('record bounce: unknown email returns matched=false', async () => {
  const r = (await h.as('service_role', null, `select public.record_prospect_email_bounce('nobody@x.test') r`)).rows[0].r
  ok(r.matched === false, JSON.stringify(r))
})
await t('reserve blocked while bounced', async () => ok(await h.denied('service_role', null, `select public.reserve_prospect_invite('${P1}','${recruiter}','Recruiter',null)`), 'allowed'))
await t('recruiter corrects email: bounce cleared, audit written', async () => {
  const r = (await h.as('authenticated', recruiter, `select (public.update_prospect_email_and_clear_bounce('${P1}',' New@Sea.test ')).*`)).rows[0]
  ok(r.email === 'new@sea.test' && r.bounce_flag === false && r.invited_by_recruiter_id === null, JSON.stringify(r))
  const a = await h.one(`select actor_user_id from audit_events where event_type='prospect.email_updated'`); ok(a?.actor_user_id === recruiter, JSON.stringify(a))
})
await t('email correction denied to applicant and anon', async () => {
  ok(await h.denied('authenticated', applicant, `select public.update_prospect_email_and_clear_bounce('${P1}','x@y.test')`), 'applicant allowed')
  ok(await h.denied('anon', null, `select public.update_prospect_email_and_clear_bounce('${P1}','x@y.test')`), 'anon allowed')
})
await t('re-run on repaired database is a no-op', async () => { await db.exec(repair); await checkGrants(db) })

// 3. Staging-like database: originals applied under Supabase default privileges.
await t('staging-like (originals present): repair applies and tightens grants', async () => {
  const s = new PGlite(); await s.exec(base())
  await s.exec(fs.readFileSync(o309Path, 'utf8'))
  const o308 = fs.readFileSync(o308Path, 'utf8')
  const helper = o308.slice(o308.indexOf('create or replace function public.current_recruiter_role_name'), o308.indexOf('create or replace function public.get_prospect_detail'))
  await s.exec(helper)
  const before = (await s.query(`select has_function_privilege('anon','public.reserve_prospect_invite(uuid,uuid,text,text)','EXECUTE') f, has_table_privilege('authenticated','public.prospect_email_webhook_events','SELECT') t`)).rows[0]
  console.log('   staging-like before repair: anon exec reserve =', before.f, ', authenticated select webhook table =', before.t)
  await s.exec(repair)
  await checkGrants(s)
  const after = (await s.query(`select has_table_privilege('authenticated','public.prospect_email_webhook_events','SELECT') t, (select relrowsecurity from pg_class where oid='public.prospect_email_webhook_events'::regclass) rls`)).rows[0]
  ok(after.t === false && after.rls === true, JSON.stringify(after))
})

console.log(`\n${pass} passed, ${fail} failed`)
