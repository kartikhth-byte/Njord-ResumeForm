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
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('test.email',true))$$;
create function has_permission(u uuid,p text) returns boolean language sql as $$select u='${id(3)}'::uuid$$;
create table auth.users(id uuid primary key,banned_until timestamptz);
create function check_permission(u uuid,p text) returns boolean language sql as $$select u='${id(3)}'::uuid$$;
create function is_master_recruiter_profile(u uuid) returns boolean language sql as $$select u='${id(3)}'::uuid$$;
create table profiles(id uuid primary key,full_name text,email text,user_type text);
create table prospects(id uuid primary key default gen_random_uuid(),dob date,nationality_id uuid,rank_applied_for_id uuid,vessel_type_id uuid,exp_in_rank_months int,previous_employer text,is_first_time_at_sea boolean,telephone text,lead_source text,first_contacted_at timestamptz,created_by_recruiter_id uuid,version int default 1,invited_at timestamptz,invited_by_recruiter_id uuid,last_activity_at timestamptz,updated_at timestamptz,name text,email text,email_normalized text generated always as (lower(btrim(email))) stored,status text,archived_at timestamptz,deleted_at timestamptz,bounce_flag boolean default false,applicant_user_id uuid,claimed_at timestamptz);
create table requirements(id uuid primary key,rank_id uuid,vessel_type_id uuid,version int default 1,req_id_display text,status text default 'open',archived_at timestamptz,deleted_at timestamptz);
create table applications(id uuid primary key default gen_random_uuid(),user_id uuid not null,status text,prospect_id uuid,submitted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz);
create table application_data(application_id uuid references applications on delete cascade,data jsonb,created_at timestamptz,updated_at timestamptz);
create table prospect_requirements(prospect_id uuid,requirement_id uuid,status text,created_at timestamptz);
create table applicant_magic_link_requests(id uuid primary key,prospect_id uuid,email_normalized text,request_status text,sent_at timestamptz,invalidated_at timestamptz);
grant usage on schema public,auth to authenticated,service_role;
create function add_prospect_note(uuid,text,text) returns void language sql as $$select$$;
alter table applications enable row level security;
create policy own_applications on applications for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on applications to authenticated;
`)

const apply=async prefix=>{const file=fs.readdirSync(dir).find(f=>f.startsWith(prefix));await db.exec(fs.readFileSync(`${dir}/${file}`,'utf8'))}
for(const prefix of ['2026110221','2026110223','2026110224','2026110225','2026110602','2026110603','2026110604','2026110610','2026110615','2026111002','2026111201','2026111202','2026111203'])await apply(prefix)
await apply('2026111203') // migration retry must be safe
await db.exec(`insert into profiles values('${id(1)}','Applicant','synthetic@example.invalid','applicant'),('${id(2)}','Other','other@example.invalid','applicant'),('${id(3)}','Recruiter','recruiter@example.invalid','recruiter');
insert into auth.users(id) select id from profiles;
insert into requirements(id,req_id_display) values('${id(20)}','REQ-1'),('${id(21)}','REQ-2');`)
const org=(await q('select default_organization_id() id'))[0].id
const fields={name:'Synthetic reviewed candidate',email:'synthetic@example.invalid',telephone:'+12025550123',dob:'1990-01-01',nationality_id:id(99)}
// Verified source receipt is normally minted by the server after original/facts
// verification. The test provides synthetic evidence, then calls the REAL review
// transaction and REAL case transition RPCs; it never pre-approves this person.
async function source(n,email,complete=true){
 await admin('');const hash=String(n).padStart(64,'a'), revision='sha256:'+'b'.repeat(64)
 await q("insert into needle_resume_registry(organization_id,resume_id,filename,status,original_available,facts_revision) values($1,$2,'synthetic.pdf','ready',true,$3)",[org,hash,revision])
 const e=(await q("insert into needle_resume_evidence(organization_id,resume_id,actor_id,source,facts_revision) values($1,$2,$3,'needle_search',$4) returning id",[org,hash,id(3),revision]))[0].id
 const f=complete?{...fields,email}:{name:fields.name,email}
 const request={p_evidence:e,p_decision:'new',p_fields:f,p_link:null,p_confirm_new:true,p_requirement:id(20),p_requirement_version:1}
 const receipt=(await q('insert into existing_resume_save_receipts(evidence_id,actor_id,organization_id,resume_id,facts_revision,reviewed_request,verified_at) values($1,$2,$3,$4,$5,$6,now()) returning id',[e,id(3),org,hash,revision,JSON.stringify(request)]))[0].id
 await as(3)
 const result=(await q("select review_existing_resume($1,'new',$2::jsonb,null,true,$3,1,$4) r",[e,JSON.stringify(f),id(20),receipt]))[0].r
 return {...result,e,receipt,hash}
}
const reviewed=await source(101,fields.email)
await admin('')
assert.equal((await q('select status from prospects where id=$1',[reviewed.prospect_id]))[0].status,'open')
assert.equal((await q('select count(*)::int n from existing_resume_identity_reviews where candidate_id=$1',[reviewed.prospect_id]))[0].n,1)
const eligibility=async(invited=true,caseId=reviewed.case_id,p=reviewed.prospect_id)=>(await q('select case_form_invite_eligible($1,$2,$3) ok',[caseId,p,invited]))[0].ok
const reserve=async(actor=3,caseId=reviewed.case_id,p=reviewed.prospect_id)=>q("select reserve_case_form_invite($1,$2,$3,'Recruiter','Synthetic test') value",[caseId,p,id(actor)])
assert.equal(await eligibility(false),false)
await deny(()=>reserve(),'passed interview')
await as(3)
for(const stage of ['contacted','confirmed','test_waived','interview_scheduled','interview_passed']) {
 await q('select recruitment_case_transition($1,$2,$3,$4,null,$5::jsonb)',[reviewed.case_id,stage,'Synthetic test only',`test-${stage}`,JSON.stringify(stage==='interview_scheduled'?{scheduled_at:new Date().toISOString()}:stage==='interview_passed'?{occurred_at:new Date().toISOString()}: {})])
}
await admin('');assert.equal(await eligibility(false),true);assert.equal(await eligibility(),false)
await deny(()=>reserve(2),'Insufficient permissions')
await db.exec('set role authenticated');await deny(()=>reserve(),'permission denied');await db.exec('reset role;set role service_role')
assert.equal((await reserve())[0].value.invite_state,'sent')
assert.equal((await reserve())[0].value.invite_state,'already_sent')
await as(3);await q('select recruitment_case_record_form_invite($1,$2)',[reviewed.case_id,'synthetic-invite'])
await admin('');assert.equal(await eligibility(),true)
// Reissue uses the same eligibility, even while global prospect status is open.
assert.equal((await q('select * from eligible_form_invite_prospects($1)',[fields.email])).length,1)
// Explicit cross-case/person and organization pairing cannot borrow eligibility.
assert.equal(await eligibility(true,reviewed.case_id,id(999)),false)
await deny(()=>reserve(3,id(999)),'eligible_recruitment_case_required')
await deny(()=>reserve(3,reviewed.case_id,id(999)),'eligible_recruitment_case_required')
await db.exec(`insert into organizations(id,name,slug) values('${id(900)}','Foreign','foreign')`)
await q('update recruitment_cases set organization_id=$1 where id=$2',[id(900),reviewed.case_id]);assert.equal(await eligibility(),false)
await deny(()=>reserve(),'eligible_recruitment_case_required')
await q('update recruitment_cases set organization_id=$1 where id=$2',[org,reviewed.case_id])
// Claim token binds the exact identity + case. No pre-linked applicant user.
await q("insert into applicant_magic_link_requests(id,prospect_id,organization_id,email_normalized,request_status,sent_at,claim_token_hash,case_id) values($1,$2,$3,$4,'sent',now(),$5,$6)",[id(60),reviewed.prospect_id,org,fields.email,'a'.repeat(64),reviewed.case_id])
await as(2);await q("select set_config('test.email','other@example.invalid',false)")
await deny(()=>q('select claim_applicant_magic_link($1)',['a'.repeat(64)]),'invalid_claim')
await as(1);assert.equal((await q('select claim_applicant_magic_link($1) result',['a'.repeat(64)]))[0].result.case_id,reviewed.case_id)
await deny(()=>q('select claim_applicant_magic_link($1)',['a'.repeat(64)]),'invalid_claim')
assert.equal((await q('select get_applicant_claims() value'))[0].value.length,1)
const start=async()=> (await q('select start_claimed_application_for_case($1,$2::jsonb) id',[reviewed.case_id,JSON.stringify({test:'synthetic'})]))[0].id
const draft=await start();assert.equal(await start(),draft)
const submit=()=>q("update applications set submitted_at=now(),status='submitted' where id=$1 returning id",[draft])
// Revocation denies all downstream entrances consistently. Restore each change.
for(const [change,restore] of [["bounce_flag=true","bounce_flag=false"],["archived_at=now()","archived_at=null"],["deleted_at=now()","deleted_at=null"],["status='rejected'","status='open'"]]){
 await admin(`update prospects set ${change} where id='${reviewed.prospect_id}'`)
 assert.equal(await eligibility(),false)
 assert.equal((await q('select * from eligible_form_invite_prospects($1)',[fields.email])).length,0)
 await as(1);assert.equal((await q('select get_applicant_claims() value'))[0].value.length,0)
 await deny(start,'form_invite_required');await deny(submit,'application_recruitment_link_required')
 await admin(`update prospects set ${restore} where id='${reviewed.prospect_id}'`)
}
await admin(`update requirements set status='closed' where id='${id(20)}'`)
assert.equal(await eligibility(),false);await deny(()=>reserve(),'passed interview')
await as(1);await deny(start,'requirement_not_open');await deny(submit,'application_recruitment_link_required')
await admin(`update requirements set status='open' where id='${id(20)}'`)
// Losing the original or review evidence is not treated as a new approval.
await q('update needle_resume_registry set original_available=false where resume_id=$1',[reviewed.hash]);assert.equal(await eligibility(),false)
await q('update needle_resume_registry set original_available=true where resume_id=$1',[reviewed.hash])
await q('delete from existing_resume_identity_reviews where candidate_id=$1',[reviewed.prospect_id]);assert.equal(await eligibility(),false)
await as(1);await deny(submit,'application_recruitment_link_required')
await admin('');await q("insert into existing_resume_identity_reviews(evidence_id,actor_id,decision,candidate_id,requirement_id,reviewed_fields,receipt_id) values($1,$2,'new',$3,$4,$5,$6)",[reviewed.e,id(3),reviewed.prospect_id,id(20),JSON.stringify(fields),reviewed.receipt])
await as(1);assert.equal((await submit()).length,1)
await as(2);assert.equal((await q('select * from applications where id=$1',[draft])).length,0)
await admin('');assert.equal((await q('select status from prospects where id=$1',[reviewed.prospect_id]))[0].status,'open')
// Incomplete newly reviewed identities cannot reach confirmation, let alone invite.
const incomplete=await source(102,'incomplete@example.invalid',false)
await deny(()=>q("select recruitment_case_transition($1,'confirmed','synthetic','incomplete',null)",[incomplete.case_id]),'invalid_transition')
await q("select recruitment_case_transition($1,'contacted','synthetic','incomplete-contact',null)",[incomplete.case_id])
await deny(()=>q("select recruitment_case_transition($1,'confirmed','synthetic','incomplete-confirm',null)",[incomplete.case_id]),'complete_phone_email_dob_nationality')
await admin('');assert.equal(await eligibility(false,incomplete.case_id,incomplete.prospect_id),false)
// An approved legacy record remains supported, with complete contact details.
await q("update prospects set status='approved' where id=$1",[reviewed.prospect_id])
await q('delete from existing_resume_identity_reviews where candidate_id=$1',[reviewed.prospect_id])
assert.equal(await eligibility(),true)
// Isolate legacy incomplete-contact data without bypassing the tested read guard.
await db.exec('alter table prospects disable trigger prospects_resume_entry_guard')
await q('update prospects set dob=null where id=$1',[reviewed.prospect_id]);assert.equal(await eligibility(),false)
await q("update prospects set dob='1990-01-01',status='open' where id=$1",[reviewed.prospect_id])
await db.exec('alter table prospects enable trigger prospects_resume_entry_guard')
assert.equal(await eligibility(),false) // a CV/registry by itself is not review
// A fresh identity review of an existing résumé keeps the ORIGINAL link evidence.
const freshEvidence=(await q("insert into needle_resume_evidence(organization_id,resume_id,actor_id,source,facts_revision) values($1,$2,$3,'needle_search',$4) returning id",[org,reviewed.hash,id(3),'sha256:'+'b'.repeat(64)]))[0].id
const freshRequest={p_evidence:freshEvidence,p_decision:'link',p_fields:{},p_link:reviewed.prospect_id,p_confirm_new:false,p_requirement:null,p_requirement_version:null}
const freshReceipt=(await q('insert into existing_resume_save_receipts(evidence_id,actor_id,organization_id,resume_id,facts_revision,reviewed_request,verified_at) values($1,$2,$3,$4,$5,$6,now()) returning id',[freshEvidence,id(3),org,reviewed.hash,'sha256:'+'b'.repeat(64),JSON.stringify(freshRequest)]))[0].id
await as(3);await q("select review_existing_resume($1,'link','{}',$2,false,null,null,$3)",[freshEvidence,reviewed.prospect_id,freshReceipt])
await admin('');assert.equal((await q('select evidence_id from prospect_resumes where prospect_id=$1',[reviewed.prospect_id]))[0].evidence_id,reviewed.e)
assert.equal(await eligibility(),true)
await q('delete from existing_resume_identity_reviews where candidate_id=$1',[reviewed.prospect_id]);assert.equal(await eligibility(),false)
// Exercise the other supported review path through its actual RPC.
const file=(await q("insert into resume_files(organization_id,content_hash,filename,size_bytes,source,uploader_id,storage_status) values($1,$2,'synthetic.pdf',100,'holmes_upload',$3,'stored') returning id",[org,reviewed.hash,id(3)]))[0].id
const version=(await q('insert into resume_versions(organization_id,file_id) values($1,$2) returning id',[org,file]))[0].id
const platformEvidence=(await q("insert into needle_resume_evidence(organization_id,resume_id,actor_id,source) values($1,$2,$3,'holmes_upload') returning id",[org,reviewed.hash,id(3)]))[0].id
await as(3)
await q("select review_platform_resume($1,$2,'link','{}',$3,false,null,null)",[version,platformEvidence,reviewed.prospect_id])
await admin('');assert.equal(await eligibility(),true)
await q("update prospects set status='unexpected' where id=$1",[reviewed.prospect_id]);assert.equal(await eligibility(),false)
await q("update prospects set status='open' where id=$1",[reviewed.prospect_id])
// Multiple case invitations return one identity and both claims, never a guessed case.
await as(3)
const another=(await q("select (recruitment_case_open($1,$2,'recruiter','another')).id id",[reviewed.prospect_id,id(21)]))[0].id
await admin('');await q("update recruitment_cases set status='interview_passed',form_invited_at=now() where id=$1",[another])
assert.equal((await q('select * from eligible_form_invite_prospects($1)',[fields.email])).length,1)
await as(1);assert.equal((await q('select get_applicant_claims() value'))[0].value.length,2)
await deny(()=>q('select start_claimed_application($1)',[reviewed.prospect_id]),'select_invited_requirement')
await admin('')
for(const role of ['anon','authenticated'])for(const sig of ['eligible_form_invite_prospects(text)','case_form_invite_eligible(uuid,uuid,boolean)','reserve_case_form_invite(uuid,uuid,uuid,text,text)','form_invite_candidate_ready(prospects)'])assert.equal((await q("select has_function_privilege($1,$2,'execute') ok",[role,sig]))[0].ok,false)
await db.close()
console.log('PASS reviewed CV → real case progression → reservation → exact claim → draft/retry → submission; revocation, original/review, incomplete contact, role and owner denials')
