import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const db=new PGlite()
const org='00000000-0000-4000-8000-0000000000a1',actor='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',cid='00000000-0000-4000-8000-000000000004',aid='00000000-0000-4000-8000-000000000005'
await db.exec(`
create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key,email text,banned_until timestamptz);
insert into auth.users values('${actor}','operator@example.invalid',null),('${other}','recruiter@example.invalid',null);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('role')$$;
create function check_permission(uuid,text) returns boolean language sql stable as $$select $2=any(string_to_array(current_setting('test.permissions',true),','))$$;
create function has_permission(uuid,text) returns boolean language sql stable as $$select check_permission($1,$2)$$;
create function is_platform_operator() returns boolean language sql stable as $$select auth.uid()='${actor}'::uuid$$;
create function needle_pilot_organization_id() returns uuid language sql immutable as $$select '${org}'::uuid$$;
create table organizations(id uuid,name text,slug text);insert into organizations values('${org}','Synthetic pilot','pilot');
create table profiles(id uuid,full_name text,user_type text);insert into profiles values('${actor}','Synthetic Operator','recruiter'),('${other}','Synthetic Recruiter','recruiter');
create table roles(id uuid,name text);create table user_roles(user_id uuid,role_id uuid);
create table platform_operators(user_id uuid);insert into platform_operators values('${actor}');
create table runtime_settings(setting_key text primary key,setting_value text,is_secret boolean,updated_by uuid);
create table prospect_email_webhook_events(event_type text,processed_at timestamptz);
create table audit_log(entity_type text,event_type text,actor_user_id uuid,created_at timestamptz);
create table recruitment_cases(id uuid primary key,organization_id uuid,status text,version int,application_id uuid,updated_at timestamptz,prospect_id uuid);
create table applications(id uuid,submitted_at timestamptz,prospect_id uuid);
create table recruitment_case_events(case_id uuid,organization_id uuid,event_type text,from_status text,to_status text,payload jsonb,actor_id uuid,idempotency_key text);
create function recruitment_case_attest_principal_send(uuid,text,text,text,text) returns recruitment_cases language sql as $$select * from recruitment_cases where id=$1$$;
create function recruitment_case_link_application(uuid,uuid) returns recruitment_cases language sql as $$select * from recruitment_cases where id=$1$$;
create function recruitment_case_post_interview(text) returns boolean language sql as $$select $1 in ('interview_passed','selected','offered','offer_accepted','documents_pending','documents_verified','sent_to_principal')$$;
insert into recruitment_cases(id,organization_id,status,version,application_id,updated_at) values('${cid}','${org}','documents_verified',5,'${aid}',now());
insert into applications(id,submitted_at) values('${aid}',now());
grant usage on schema public,auth to authenticated;
`)
for(const file of process.argv.slice(2))await db.exec(fs.readFileSync(file,'utf8'))
const as=async(uid,permissions='edit_junction_status')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[uid,permissions]);await db.exec('set role authenticated')}
const send=(version=5,key='synthetic-send',when=new Date(Date.now()-60000).toISOString())=>db.query('select to_jsonb(recruitment_case_attest_principal_send_v2($1,$2,$3,$4,$5,$6,$7)) result',[cid,'principal@example.invalid','Email','synthetic-v1.xlsx',key,version,when])
await as(other,'view_requirements')
await assert.rejects(send,/permission_denied/)
await assert.rejects(()=>db.query('select platform_operator_snapshot()'),/permission_denied/)
await as(other)
await assert.rejects(()=>send(4),/version_conflict/)
await assert.rejects(()=>send(5,'future',new Date(Date.now()+3600000).toISOString()),/valid_send_time_required/)
assert.equal((await send()).rows[0].result.status,'sent_to_principal')
assert.equal((await send(5)).rows[0].result.version,6)
await as(other,'view_requirements')
await assert.rejects(()=>send(),/permission_denied/)
await db.exec('reset role')
const event=(await db.query('select * from recruitment_case_events')).rows[0]
assert.equal(event.payload.worksheet_version,'synthetic-v1.xlsx');assert.ok(event.payload.sent_at)
assert.equal((await db.query("select has_function_privilege('authenticated','recruitment_case_attest_principal_send(uuid,text,text,text,text)','execute') allowed")).rows[0].allowed,false)
const linkCase='00000000-0000-4000-8000-000000000007',linkApp='00000000-0000-4000-8000-000000000008',draftApp='00000000-0000-4000-8000-000000000009'
await db.query("insert into recruitment_cases(id,organization_id,status,version,updated_at,prospect_id) values($1,$2,'interview_passed',1,now(),$3)",[linkCase,org,other])
await db.query('insert into applications(id,submitted_at,prospect_id) values($1,now(),$3),($2,null,$3)',[linkApp,draftApp,other])
const link=(app=linkApp,version=1)=>db.query('select to_jsonb(recruitment_case_link_application_v2($1,$2,$3)) result',[linkCase,app,version])
await as(other,'view_requirements');await assert.rejects(link,/permission_denied/)
await as(other);await assert.rejects(()=>link(linkApp,0),/version_conflict/)
await assert.rejects(()=>link(draftApp),/submitted_form_required/)
await assert.rejects(()=>link(aid),/application_prospect_mismatch/)
assert.equal((await link()).rows[0].result.application_id,linkApp)
assert.equal((await link()).rows[0].result.version,2)
await assert.rejects(()=>link(draftApp,2),/application_already_linked/)
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from recruitment_case_events where case_id=$1',[linkCase])).rows[0].n,1)
assert.equal((await db.query("select has_function_privilege('authenticated','recruitment_case_link_application(uuid,uuid)','execute') allowed")).rows[0].allowed,false)
await db.query('insert into runtime_settings values($1,$2,true,$3)',['RESEND_API_KEY','NEVER-EXPOSE-THIS-VALUE',actor])
await as(actor)
const snapshot=(await db.query('select platform_operator_snapshot() result')).rows[0].result
assert.equal(snapshot.users.length,2);assert.equal(snapshot.organizations.length,1)
assert.equal(snapshot.events[0].details.key,'RESEND_API_KEY')
assert.equal(JSON.stringify(snapshot).includes('NEVER-EXPOSE-THIS-VALUE'),false)
await as(other)
assert.equal((await db.query("select has_permission(auth.uid(),'edit_junction_status') allowed")).rows[0].allowed,true)
await db.exec('reset role');await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[other]);await as(other)
assert.equal((await db.query("select has_permission(auth.uid(),'edit_junction_status') allowed")).rows[0].allowed,false)
await db.close();console.log('Principal/operator SQL: PASS (submitted-form ownership/link/version/replay, manual evidence, role gates, no secret audit values, operator-only inventory, immediate permission ban)')
