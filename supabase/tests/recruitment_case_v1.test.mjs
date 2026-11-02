// Recruitment case v1 — migration tests against an in-memory Postgres (PGlite).
// Stubs auth.uid(), has_permission() and the referenced tables; does not touch any real database.
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node recruitment_case_v1.test.mjs <path-to>/supabase/migrations/2026110203_recruitment_case_v1.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const MIG = process.argv[2]
const db = new PGlite()
const U = (n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0')
const recruiter=U(1), coordinator=U(2)
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
  insert into public.profiles values ('${recruiter}'),('${coordinator}');
  insert into public.perms values ('${recruiter}','edit_junction_status'),('${recruiter}','create_prospects'),('${recruiter}','send_prospect_invites'),('${recruiter}','withdraw_junctions'),('${recruiter}','view_requirements'),('${coordinator}','view_requirements');
  insert into public.prospects values ('${U(11)}'),('${U(12)}'),('${U(13)}'),('${U(14)}'),('${U(15)}');
  insert into public.requirements values ('${U(21)}'),('${U(22)}');
  -- legacy data for backfill
  insert into public.prospect_requirements values ('${U(13)}','${U(21)}','shortlisted',now()),('${U(14)}','${U(21)}','joined',now()),('${U(15)}','${U(22)}','withdrawn',now());
  insert into public.applications values ('${U(31)}','${U(13)}',now(),now()),('${U(32)}','${U(11)}',null,now());
`)
await db.exec(fs.readFileSync(MIG,'utf8'))
// run backfill twice (idempotency)
const backfill = fs.readFileSync(MIG,'utf8').split('-- Backfill:')[1]
await db.exec('-- Backfill:'+backfill)

let pass=0, fail=0
const as = async (uid)=> db.exec(`select set_config('test.uid','${uid}',false)`)
const q = async (sql, params=[]) => (await db.query(sql, params)).rows
async function ok(name, fn){ try{ await fn(); pass++; console.log('PASS', name) } catch(e){ fail++; console.log('FAIL', name, '-', e.message) } }
async function rejects(name, fn, msg){ try{ await fn(); fail++; console.log('FAIL', name, '- expected error', msg) } catch(e){ if(!msg || e.message.includes(msg)){ pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, '- got', e.message) } } }
const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`) }
const open = (p,r,src='recruiter',k=null)=> q(`select * from recruitment_case_open($1,$2,$3,$4)`,[p,r,src,k])
const tr = (c,to,reason=null,k=null)=> q(`select * from recruitment_case_transition($1,$2,$3,$4)`,[c,to,reason,k])

await as(recruiter)
// 1. idempotent open
let c1
await ok('1 open twice -> one case, two events', async()=>{
  const a=(await open(U(11),U(21),'recruiter','k1'))[0]
  const b=(await open(U(11),U(21),'needle','k2'))[0]
  const a2=(await open(U(11),U(21),'recruiter','k1'))[0]
  eq(a.id,b.id,'same case'); eq(a.id,a2.id,'retry same case')
  const n=(await q(`select count(*)::int n from recruitment_cases where prospect_id=$1 and requirement_id=$2`,[U(11),U(21)]))[0].n; eq(n,1,'cases')
  const ev=(await q(`select event_type from recruitment_case_events where case_id=$1 order by created_at`,[a.id])).map(r=>r.event_type); eq(ev,['opened','source_added'],'events')
  c1=a.id
})
// 3/2. invite gate + flow
await rejects('3 invite before interview pass rejected', ()=>q(`select * from recruitment_case_record_form_invite($1,'inv1')`,[c1]), 'form_invite_requires_passed_interview')
await rejects('invalid jump sourced->offered', ()=>tr(c1,'offered'), 'invalid_transition')
await ok('2 test+interview recorded with no application link', async()=>{
  for (const s of ['contacted','confirmed','test_scheduled','test_passed','interview_scheduled','interview_passed']) await tr(c1,s)
  const c=(await q(`select status, application_id from recruitment_cases where id=$1`,[c1]))[0]; eq(c,{status:'interview_passed',application_id:null},'state')
})
await ok('3 invite allowed after interview pass, before selection', async()=>{ await q(`select * from recruitment_case_record_form_invite($1,'inv1')`,[c1]) })
await ok('5 invite twice -> one event', async()=>{
  await q(`select * from recruitment_case_record_form_invite($1,'inv1')`,[c1])
  const n=(await q(`select count(*)::int n from recruitment_case_events where case_id=$1 and event_type='form_invited'`,[c1]))[0].n; eq(n,1,'invite events')
})
// 7 waiver
const c2=(await open(U(12),U(21)))[0].id
await tr(c2,'contacted'); await tr(c2,'confirmed')
await rejects('7 waiver without reason rejected', ()=>tr(c2,'test_waived','  '), 'waiver_reason_required')
await ok('7 waiver with reason recorded in history', async()=>{ await tr(c2,'test_waived','Senior officer, assessed previously'); const e=(await q(`select reason from recruitment_case_events where case_id=$1 and to_status='test_waived'`,[c2]))[0]; eq(e.reason,'Senior officer, assessed previously','reason') })
// 4 failed cannot be invited
await tr(c2,'interview_scheduled'); await tr(c2,'interview_failed')
await rejects('4 failed interview cannot be invited', ()=>q(`select * from recruitment_case_record_form_invite($1,'inv2')`,[c2]), 'form_invite_requires_passed_interview')
// 12 selected only after interview pass
await rejects('12 select after failed interview rejected', ()=>tr(c2,'selected'), 'invalid_transition')
// 11 coordinator denied
await as(coordinator)
await rejects('11 coordinator cannot transition', ()=>tr(c1,'selected'), 'permission_denied')
await rejects('11 coordinator cannot invite', ()=>q(`select * from recruitment_case_record_form_invite($1,'x')`,[c1]), 'permission_denied')
await rejects('11 coordinator cannot open', ()=>open(U(12),U(22)), 'permission_denied')
await as(recruiter)
// 14 attestation gates
for (const s of ['selected','offered','offer_accepted','documents_pending']) await tr(c1,s)
await rejects('14 attest before documents verified rejected', ()=>q(`select * from recruitment_case_attest_principal_send($1,'crew@principal.com','email','v1')`,[c1]), 'attestation_requires_documents_verified')
await tr(c1,'documents_verified')
await rejects('14 attest without submitted form rejected', ()=>q(`select * from recruitment_case_attest_principal_send($1,'crew@principal.com','email','v1')`,[c1]), 'attestation_requires_submitted_form')
await rejects('direct transition to sent_to_principal blocked', ()=>tr(c1,'sent_to_principal'), 'use_recruitment_case_attest_principal_send')
await rejects('link draft of another prospect rejected', ()=>q(`select * from recruitment_case_link_application($1,$2)`,[c1,U(31)]), 'application_prospect_mismatch')
await ok('14 attest after submitted form + verified documents', async()=>{
  await db.exec(`update applications set submitted_at=now() where id='${U(32)}'`)
  await q(`select * from recruitment_case_link_application($1,$2)`,[c1,U(32)])
  const r=(await q(`select * from recruitment_case_attest_principal_send($1,'crew@principal.com','email','v1','att1')`,[c1]))[0]; eq(r.status,'sent_to_principal','status')
  const p=(await q(`select payload from recruitment_case_events where case_id=$1 and event_type='principal_send_attested'`,[c1]))[0].payload
  eq([p.recipient,p.channel,p.worksheet_version,p.attested_by],['crew@principal.com','email','v1',recruiter],'payload')
})
// 15 hired terminal
await ok('15 hired is final', async()=>{ await tr(c1,'hired'); })
await rejects('15 no transition after hired', ()=>tr(c1,'withdrawn','late'), 'case_closed')
await ok('new cycle after terminal case', async()=>{ const c=(await open(U(11),U(21)))[0]; eq([c.cycle,c.status],[2,'sourced'],'cycle 2') })
// withdraw needs reason
const c3=(await open(U(12),U(22)))[0].id
await rejects('withdraw without reason rejected', ()=>tr(c3,'withdrawn'), 'reason_required')
// 16 events
await ok('16 every transition has an event with actor', async()=>{ const n=(await q(`select count(*)::int n from recruitment_case_events where event_type='transition' and (actor_id is null or to_status is null or from_status is null)`))[0].n; eq(n,0,'incomplete events') })
// append-only
await rejects('events are append-only', ()=>db.exec(`update recruitment_case_events set reason='x'`), 'append-only')
// 9 backfill
await ok('9 backfill: one case per legacy link, idempotent, terminal mapping', async()=>{
  const rows=await q(`select p.prospect_id, c.status, c.legacy_status, c.application_id, (select count(*)::int from recruitment_case_events e where e.case_id=c.id and e.idempotency_key='backfill:2026110203') ev
     from prospect_requirements p join recruitment_cases c on c.prospect_id=p.prospect_id and c.requirement_id=p.requirement_id and c.source='legacy' order by p.prospect_id`)
  eq(rows.map(r=>[r.status,r.legacy_status,r.ev]),[['legacy','shortlisted',1],['hired','joined',1],['withdrawn','withdrawn',1]],'mapping')
  eq(rows[0].application_id,U(31),'application linked')
  const n=(await q(`select count(*)::int n from recruitment_cases where source='legacy'`))[0].n; eq(n,3,'no duplicates after rerun')
})
await ok('legacy triage onto new flow with reason', async()=>{ const c=(await q(`select id from recruitment_cases where legacy_status='shortlisted'`))[0].id; await tr(c,'interview_passed','Interview held before cutover') })
// direct table writes denied to clients
await ok('authenticated role has no insert/update on cases', async()=>{ const r=(await q(`select has_table_privilege('authenticated','public.recruitment_cases','INSERT') i, has_table_privilege('authenticated','public.recruitment_cases','UPDATE') u, has_table_privilege('authenticated','public.recruitment_cases','SELECT') s`))[0]; eq([r.i,r.u,r.s],[false,false,true],'privileges') })
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0)
