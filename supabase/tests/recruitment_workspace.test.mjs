import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite(),dir=process.argv[2]
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const master=id(1),a=id(2),b=id(3),coordinator=id(4)
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table auth.users(id uuid primary key,banned_until timestamptz);
create table perms(user_id uuid,name text);
create function check_permission(u uuid,p text) returns boolean language sql stable security definer as $$select exists(select 1 from perms where user_id=u and name=p)$$;
create function has_permission(u uuid,p text) returns boolean language sql stable security definer as $$select u=auth.uid() and not exists(select 1 from auth.users where id=u and banned_until>now()) and check_permission(u,p)$$;
create function is_master_recruiter_profile(u uuid) returns boolean language sql stable as $$select u='${master}'::uuid$$;
create table profiles(id uuid primary key,user_type text default 'recruiter');
insert into profiles(id) values('${master}'),('${a}'),('${b}'),('${coordinator}');
insert into auth.users(id) select id from profiles;
insert into perms select id,'view_requirements' from profiles;
insert into perms select id,'edit_junction_status' from profiles where id<>'${coordinator}';
insert into perms select id,'create_prospects' from profiles where id<>'${coordinator}';
create table prospects(id uuid primary key);create table requirements(id uuid primary key,status text default 'open',archived_at timestamptz,deleted_at timestamptz);
create table applications(id uuid primary key,prospect_id uuid,submitted_at timestamptz,created_at timestamptz default now());
create table prospect_requirements(prospect_id uuid,requirement_id uuid,status text,created_at timestamptz default now());
insert into prospects values('${id(10)}');insert into requirements(id) values('${id(20)}');
grant usage on schema public,auth to authenticated;`)
for(const f of ['2026110221_recruitment_case_v1.sql','2026110603_case_transition_retry_authorization.sql']) {
 const file=f.startsWith('2026110603')?fs.readdirSync(dir).find(x=>x.startsWith('2026110603')):f
 await db.exec(fs.readFileSync(dir+'/'+file,'utf8'))
}
await db.exec('create function needle_pilot_organization_id() returns uuid language sql stable as $$select default_organization_id()$$')
await db.exec(fs.readFileSync(dir+'/2026110605_principal_send_attestation.sql','utf8'))
await db.exec(fs.readFileSync(dir+'/2026111201_recruitment_workspace.sql','utf8'))
const as=async u=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[u]);await db.exec('set role authenticated')}
const deny=(fn,message)=>assert.rejects(fn,e=>e.message.includes(message))
await as(master)
const c=(await db.query("select * from recruitment_case_open($1,$2,'recruiter','open-workspace')",[id(10),id(20)])).rows[0]
const assign=(task,user,version=0,start=false)=>db.query('select * from recruitment_assign_work($1,$2,$3,null,$4,$5,null)',[c.id,task,user,start,version]).then(r=>r.rows[0])
await deny(()=>assign('case',coordinator),'invalid_assignee')
await db.exec('reset role');await db.exec(`update auth.users set banned_until='2099-01-01' where id='${a}'`)
await as(master);await deny(()=>assign('case',a),'invalid_assignee')
await db.exec('reset role');await db.exec(`update auth.users set banned_until=null where id='${a}'`)
await as(master);await assign('case',a)
await assign('interview',b)
await as(a)
await assign('test',a,0,true)
await deny(()=>assign('case',b,1),'assignment_requires_master')
await as(b)
await assign('case',b,1)
assert.equal((await db.query("select assignee_id from recruitment_work_assignments where task_key='test'")).rows[0].assignee_id,a)
await deny(()=>assign('case',b,1),'version_conflict')
const move=(status,version,key='move-contact',performer=b,at=new Date().toISOString())=>db.query('select * from recruitment_workspace_transition($1,$2,null,$3,$4,\'{}\'::jsonb,$5,$6)',[c.id,status,key,version,performer,at]).then(r=>r.rows[0])
await move('contacted',c.version,'move-contact',a)
assert.equal((await move('contacted',c.version,'move-contact',a)).status,'contacted')
await deny(()=>move('contacted',c.version,'move-contact',b),'idempotency_conflict')
assert.equal((await db.query('select count(*)::int n from recruitment_task_credits')).rows[0].n,1)
const credit=(await db.query('select * from recruitment_task_credits')).rows[0]
assert.equal(credit.performed_by,a);assert.equal(credit.recorded_by,b)
await deny(()=>move('confirmed',2,'move-future',a,'2099-01-01'),'valid_completion_time_required')
await deny(()=>move('offered',2,'move-invalid',a),'invalid_transition')
await deny(()=>db.query('update recruitment_work_assignments set assignee_id=$1',[b]),'permission denied')
// All status entry points reject a closed requirement; closure remains allowed.
await db.exec('reset role')
await db.exec(`update requirements set status='closed' where id='${id(20)}'`)
await as(b)
await deny(()=>move('confirmed',2,'closed-wrapper',a),'requirement_not_open')
await deny(()=>db.query("select * from recruitment_case_transition($1,'confirmed',null,'closed-original',2,'{}'::jsonb)",[c.id]),'requirement_not_open')
await deny(()=>assign('interview',b,1,true),'requirement_not_open')
await db.exec('reset role')
await db.exec(`update requirements set status='open' where id='${id(20)}'`)
await as(b)
await move('confirmed',2,'confirm-contact',a)
await deny(()=>assign('contact',b,0,true),'task_already_completed')
// Principal path retains personal attestation and records its actual send time.
await db.exec('reset role')
await db.exec(`insert into applications(id,prospect_id,submitted_at) values('${id(30)}','${id(10)}',now());update recruitment_cases set status='documents_verified',application_id='${id(30)}' where id='${c.id}';update requirements set status='closed' where id='${id(20)}'`)
const principalVersion=(await db.query('select version from recruitment_cases')).rows[0].version
const send=(performer=b,key='principal-send')=>db.query("select * from recruitment_workspace_principal_send($1,'synthetic@example.invalid','email','synthetic.pdf',$2,$3,'2026-01-01',$4)",[c.id,key,principalVersion,performer])
await as(b)
await deny(()=>send(a),'principal_send_requires_self')
await deny(()=>send(),'requirement_not_open')
await deny(()=>db.query("select * from recruitment_case_attest_principal_send_v2($1,'synthetic@example.invalid','email','synthetic.pdf','old-principal',$2,'2026-01-01')",[c.id,principalVersion]),'requirement_not_open')
await db.exec('reset role');await db.exec(`update requirements set status='open' where id='${id(20)}'`)
await as(b);await send();await send()
const principalCredit=(await db.query("select c.* from recruitment_task_credits c join recruitment_case_events e on e.id=c.event_id where e.event_type='principal_send_attested'")).rows
assert.equal(principalCredit.length,1);assert.equal(principalCredit[0].performed_by,b);assert.equal(new Date(principalCredit[0].occurred_at).toISOString(),'2026-01-01T00:00:00.000Z')
await as(a);await deny(()=>send(a),'idempotency_conflict')
await as(coordinator)
await deny(()=>assign('case',coordinator,2),'permission_denied')
await deny(()=>move('contacted',1,'move-contact',a),'permission_denied')
assert.equal((await db.query('select * from recruitment_work_assignments')).rows.length,3)
await as('')
await deny(()=>assign('case',a,2),'permission_denied')
assert.equal((await db.query('select * from recruitment_work_assignments')).rows.length,0)
await db.exec('reset role')
await deny(()=>db.exec("delete from recruitment_work_history"),'append-only')
await deny(()=>db.exec("delete from recruitment_task_credits"),'append-only')
await db.exec(`insert into organizations(id,name,slug) values('${id(99)}','Foreign','foreign');update recruitment_cases set organization_id='${id(99)}' where id='${c.id}'`)
await as(master)
assert.equal((await db.query('select * from recruitment_work_assignments')).rows.length,0)
await deny(()=>assign('case',master,2),'permission_denied')
await deny(()=>move('contacted',1,'move-contact',a),'permission_denied')
assert.equal((await db.query("select has_function_privilege('anon','recruitment_assign_work(uuid,text,uuid,timestamptz,boolean,integer,text)','execute') v")).rows[0].v,false)
await db.close();console.log('Recruitment workspace SQL: PASS — role, scope, takeover, stale writes, performer attribution, replay and immutable history')
