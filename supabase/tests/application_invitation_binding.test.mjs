// Run in the existing PGlite scratch runtime, with the migrations directory.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite(), dir = process.argv[2]
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const q = async (sql, args=[]) => (await db.query(sql,args)).rows
const as = async n => { await db.exec('reset role'); await q("select set_config('test.uid',$1,false),set_config('test.email','synthetic@example.invalid',false)",[n ? id(n) : '']); await db.exec('set role authenticated') }
const admin = async sql => {await db.exec('reset role');await db.exec(sql)}
const deny = (fn, reason) => assert.rejects(fn, e=>e.message.includes(reason))
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('test.email',true))$$;
create function has_permission(u uuid,p text) returns boolean language sql as $$select u='${id(3)}'::uuid$$;
create table auth.users(id uuid primary key,banned_until timestamptz);
create function check_permission(u uuid,p text) returns boolean language sql as $$select u='${id(3)}'::uuid$$;
create function is_master_recruiter_profile(u uuid) returns boolean language sql as $$select u='${id(3)}'::uuid$$;
create table profiles(id uuid primary key,full_name text,email text,user_type text);
create table prospects(id uuid primary key,name text,email text,email_normalized text generated always as (lower(btrim(email))) stored,status text,archived_at timestamptz,deleted_at timestamptz,bounce_flag boolean default false,applicant_user_id uuid,claimed_at timestamptz);
create table requirements(id uuid primary key,req_id_display text,status text default 'open',archived_at timestamptz,deleted_at timestamptz);
create table applications(id uuid primary key default gen_random_uuid(),user_id uuid not null,status text,prospect_id uuid,submitted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz);
create table application_data(application_id uuid references applications on delete cascade,data jsonb,created_at timestamptz,updated_at timestamptz);
create table prospect_requirements(prospect_id uuid,requirement_id uuid,status text,created_at timestamptz);
create table applicant_magic_link_requests(id uuid primary key,prospect_id uuid,email_normalized text,request_status text,sent_at timestamptz,invalidated_at timestamptz);
grant usage on schema public,auth to authenticated;
alter table applications enable row level security;
create policy own_applications on applications for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on applications to authenticated;
`)
for(const prefix of ['2026110221','2026110224','2026110225','2026110602']) {
 const file=fs.readdirSync(dir).find(f=>f.startsWith(prefix));await db.exec(fs.readFileSync(`${dir}/${file}`,'utf8'))
}
await db.exec(`insert into profiles values('${id(1)}','Applicant','synthetic@example.invalid','applicant'),('${id(2)}','Other','other@example.invalid','applicant'),('${id(3)}','Recruiter','recruiter@example.invalid','recruiter');
insert into prospects(id,name,email,status,applicant_user_id) values('${id(10)}','Applicant','synthetic@example.invalid','approved','${id(1)}'),('${id(11)}','Other','other@example.invalid','approved','${id(2)}');
insert into requirements(id,req_id_display) values('${id(20)}','REQ-1'),('${id(21)}','REQ-2');
insert into recruitment_cases(id,prospect_id,requirement_id,status,source,form_invited_at) values
('${id(30)}','${id(10)}','${id(20)}','interview_passed','recruiter',now()),
('${id(31)}','${id(10)}','${id(21)}','interview_passed','recruiter',now()),
('${id(32)}','${id(11)}','${id(20)}','interview_passed','recruiter',now());
insert into applications(id,user_id,status,prospect_id,submitted_at) values('${id(50)}','${id(2)}','submitted','${id(11)}',now());`)
await db.exec(`create function needle_pilot_organization_id() returns uuid language sql as $$select default_organization_id()$$;insert into auth.users(id) select id from profiles;`)
await db.exec(fs.readFileSync(`${dir}/2026111201_recruitment_workspace.sql`,'utf8'))
const migration=fs.readFileSync(`${dir}/2026111202_application_invitation_binding.sql`,'utf8')
await db.exec(migration);await db.exec(migration)
const start = (n,data={section1:{name:'Synthetic'}}) => q('select start_claimed_application_for_case($1,$2::jsonb) id',[id(n),JSON.stringify(data)]).then(r=>r[0].id)
await as(1)
const claims=(await q('select get_applicant_claims() value'))[0].value
assert.equal(claims.length,2);assert.equal(claims[0].requirement_reference,'REQ-1');assert.equal(claims[0].case_id,id(30))
await deny(()=>q('select start_claimed_application($1)',[id(10)]),'select_invited_requirement')
await deny(()=>start(32),'form_invite_required')
const draft=await start(31)
assert.equal(await start(31,{overwrite:true}),draft)
await deny(()=>start(30),'existing_draft_requires_review')
await admin('')
assert.equal((await q('select application_id from recruitment_cases where id=$1',[id(31)]))[0].application_id,draft)
assert.equal((await q('select application_id from recruitment_cases where id=$1',[id(30)]))[0].application_id,null)
assert.deepEqual((await q('select data from application_data where application_id=$1',[draft]))[0].data,{section1:{name:'Synthetic'}})
assert.equal((await q("select count(*)::int n from recruitment_case_events where payload->>'action'='invited_application_started'"))[0].n,1)
assert.equal((await q('select status from recruitment_cases where id=$1',[id(31)]))[0].status,'interview_passed')
await as(3)
await q("select recruitment_assign_work($1,'application',$2,null,true,0,null)",[id(31),id(3)])
await as(1)
const submit=()=>q("update applications set submitted_at=now(),status='submitted' where id=$1 returning id",[draft])
await admin(`update requirements set status='closed' where id='${id(21)}'`)
await as(1);await deny(submit,'application_recruitment_link_required');await deny(()=>start(31),'requirement_not_open')
await admin('');await deny(()=>q('update recruitment_cases set form_invited_at=now() where id=$1',[id(31)]),'requirement_not_open')
await admin(`update requirements set status='open' where id='${id(21)}';update recruitment_cases set form_invited_at=null where id='${id(31)}'`)
await as(1);await deny(submit,'application_recruitment_link_required')
await admin(`update recruitment_cases set form_invited_at=now(),status='rejected' where id='${id(31)}'`)
await as(1);await deny(submit,'application_recruitment_link_required');await deny(()=>start(31),'form_invite_required')
await admin(`update recruitment_cases set status='interview_passed' where id='${id(31)}'`)
await as(1);assert.equal((await submit()).length,1)
await deny(()=>start(31),'application_already_linked')
await as(3);await deny(()=>q("select recruitment_assign_work($1,'application',$2,null,true,1,null)",[id(31),id(3)]),'task_already_completed')
await as(2);assert.equal((await q('select * from applications where id=$1',[draft])).length,0)
// Historical submitted records remain editable; migration never invents links.
await q('update applications set updated_at=now() where id=$1',[id(50)])
await admin(`insert into applications(id,user_id,status,prospect_id) values('${id(51)}','${id(2)}','new','${id(11)}')`)
await as(2)
await deny(()=>q("update applications set submitted_at=now(),status='submitted' where id=$1",[id(51)]),'application_recruitment_link_required')
await deny(()=>start(32),'existing_draft_requires_review')
await admin(`delete from applications where id='${id(51)}'`)
await as(2);const second=await start(32)
assert.ok(second)
// Claims preserve case and all token/identity guards without adopting drafts.
await admin(`insert into applicant_magic_link_requests(id,prospect_id,organization_id,email_normalized,request_status,sent_at,claim_token_hash,case_id) values
('${id(60)}','${id(10)}',default_organization_id(),'synthetic@example.invalid','sent',now(),'${'a'.repeat(64)}','${id(30)}'),
('${id(61)}','${id(10)}',default_organization_id(),'synthetic@example.invalid','sent',now(),'${'b'.repeat(64)}','${id(32)}'),
('${id(62)}','${id(10)}',default_organization_id(),'synthetic@example.invalid','sent',now(),'${'c'.repeat(64)}',null),
('${id(63)}','${id(10)}',default_organization_id(),'synthetic@example.invalid','sent',now()-interval '2 hours','${'d'.repeat(64)}','${id(30)}');`)
await as(1)
const claim=char=>q('select claim_applicant_magic_link($1) value',[char.repeat(64)]).then(r=>r[0].value)
assert.equal((await claim('a')).case_id,id(30))
await deny(()=>claim('a'),'invalid_claim');await deny(()=>claim('b'),'invalid_claim');await deny(()=>claim('d'),'invalid_claim')
assert.equal((await claim('c')).case_id,null)
await as(3);await deny(()=>start(30),'form_invite_required')
await as(null);await deny(()=>start(30),'auth_required')
await admin('')
assert.equal((await q("select has_function_privilege('anon','start_claimed_application_for_case(uuid,jsonb)','execute') v"))[0].v,false)
assert.equal((await q('select application_id from recruitment_cases where id=$1',[id(30)]))[0].application_id,null)
// Missing/wrong prospect links fail even on privileged direct submission.
await db.exec(`insert into applications(id,user_id,status,prospect_id) values('${id(52)}','${id(2)}','new','${id(11)}');update recruitment_cases set application_id='${id(52)}' where id='${id(30)}'`)
await deny(()=>q("update applications set submitted_at=now() where id=$1",[id(52)]),'application_recruitment_link_required')
await db.close()
console.log('Application invitation SQL PASS: exact case, ambiguity, identity, retry, token, ownership, submission gate, legacy preservation')
