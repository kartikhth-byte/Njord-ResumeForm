// Isolated PostgreSQL behavior tests; no network or production data.
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const db = new PGlite()
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const org=id('a1'), actor=id(2), other=id(3), foreign=id(4), req=id(5)
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function has_permission(uuid,text) returns boolean language sql stable as $$ select $2=any(string_to_array(current_setting('test.permissions',true),',')) $$;
create function is_master_recruiter_profile(uuid) returns boolean language sql stable as $$ select false $$;
create table organizations(id uuid primary key); insert into organizations values('${org}'),('${foreign}');
create table profiles(id uuid primary key); insert into profiles values('${actor}'),('${other}');
create table prospects(id uuid primary key default gen_random_uuid(),organization_id uuid default '${org}',name text not null,
 dob date not null,nationality_id uuid not null,rank_applied_for_id uuid not null,vessel_type_id uuid not null,
 exp_in_rank_months integer not null check(exp_in_rank_months>=0),previous_employer text,is_first_time_at_sea boolean,
 telephone text not null check(telephone ~ '^\\+[1-9][0-9]{1,14}$'),email text not null,
 email_normalized text generated always as(lower(trim(email))) stored,lead_source text,status text,
 first_contacted_at timestamptz,created_by_recruiter_id uuid,deleted_at timestamptz,archived_at timestamptz,version int default 1,
 constraint prospects_previous_employer_check check(is_first_time_at_sea or previous_employer is not null));
create unique index email_unique on prospects(organization_id,email_normalized) where deleted_at is null and archived_at is null;
create table requirements(id uuid primary key,rank_id uuid,vessel_type_id uuid,status text,version int,deleted_at timestamptz,archived_at timestamptz);
insert into requirements values('${req}',null,null,'open',1,null,null);
create table recruitment_cases(id uuid primary key default gen_random_uuid(),organization_id uuid,prospect_id uuid,requirement_id uuid,status text);
create function recruitment_case_open(uuid,uuid,text,text) returns recruitment_cases language plpgsql as $$
declare c recruitment_cases; begin select * into c from recruitment_cases where prospect_id=$1 and requirement_id=$2;
if not found then insert into recruitment_cases(organization_id,prospect_id,requirement_id,status) values('${org}',$1,$2,'sourced') returning * into c; end if; return c; end $$;
create function add_prospect_note(uuid,text,text) returns void language sql as $$ select $$;
grant usage on schema public,auth to authenticated;
`)
await db.exec(fs.readFileSync(process.argv[2]+'/2026110604_candidate_resume_integration.sql','utf8'))
// Restore the actual pre-platform browser grants/RLS, not a deny-all fixture.
const baseline=fs.readFileSync(process.argv[2]+'/2026060302_prospect_schema.sql','utf8')
await db.exec(baseline.slice(baseline.indexOf('alter table public.prospects enable row level security;'),baseline.indexOf('create table if not exists public.prospect_notes')))

await db.exec(`update requirements set rank_id=gen_random_uuid(),vessel_type_id=gen_random_uuid();
alter table requirements alter column id set default gen_random_uuid(),alter column version set default 1,alter column version set not null;
alter table requirements add constraint requirements_status_check check(status in ('open','closed','cancelled'));
alter table requirements add company_placeholder text,add vessel_name text,add customer_name text,add positions_required int not null default 1,add target_days int not null default 30,
add owner_recruiter_id uuid,add created_by_recruiter_id uuid,add req_year_month text,add req_sequence int,add req_id_display text,add date_opened date,add date_closed date,add closure_reason text,add updated_at timestamptz;
create table requirement_nationalities(requirement_id uuid,nationality_id uuid);
create table prospect_requirements(requirement_id uuid,prospect_id uuid);
create function allocate_requirement_identifier(text) returns table(req_sequence int,req_id_display text) language sql as $$select 1,'Synthetic-001'::text$$;
create function build_requirement_display_id(text,int) returns text language sql as $$select 'Synthetic-001'::text$$;
create function is_recruiter_profile(uuid) returns boolean language sql as $$select true$$;
create function add_requirement_remark(uuid,text,text) returns void language sql as $$select$$;
grant select,insert,update on requirements to authenticated;`)
for(const file of ['2026110608_requirement_match_versions.sql','2026110609_company_ship_drafts.sql','2026110610_platform_resume_intake.sql','2026110611_append_only_extraction_attempts.sql','2026110612_requirement_creator_choice.sql','2026110613_guard_all_requirement_attachments.sql','2026110614_resume_lead_drafts.sql','2026110615_review_before_index_registration.sql','2026110616_allow_historical_ship_close.sql','2026110617_reviewed_candidate_and_ship_boundaries.sql'])await db.exec(fs.readFileSync(process.argv[2]+'/'+file,'utf8'))
await db.exec('create trigger prepare_requirement_row before insert or update on requirements for each row execute function prepare_requirement_row()')
const perms='view_requirements,create_requirements,edit_requirements,create_prospects,view_prospects,edit_prospects,edit_junction_status'
const rejects=(fn,message)=>assert.rejects(fn,e=>e.message.includes(message))
const as=async(permissions=perms,uid=actor)=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[uid,permissions]);await db.exec('set role authenticated')}
await as()
const company=(await db.query("insert into client_companies(name) values('Synthetic Company') returning id")).rows[0].id
const ship=(await db.query("insert into client_ships(name,company_id) values('Synthetic Ship',$1) returning id",[company])).rows[0].id
const saveReq=(fields,id=null,version=null,reason=null)=>db.query('select * from save_platform_requirement($1::jsonb,$2,$3,$4)',[JSON.stringify(fields),id,version,reason]).then(r=>r.rows[0])
await db.exec('reset role')
const leadsBefore=(await db.query('select count(*)::int n from prospects')).rows[0].n
await as()
const lead=(await db.query("select save_resume_lead_draft($1::jsonb) id",[JSON.stringify({telephone:'+919000009999'})])).rows[0].id
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from prospects')).rows[0].n,leadsBefore)
await as()
await rejects(()=>db.query("select review_resume_lead($1,1,$2,$3,'new','{}')",[lead,id(999),id(998)]),'resume_version_not_found')
let draft=await saveReq({status:'draft'})
assert.equal(draft.status,'draft');assert.equal(draft.ship_id,null)
await db.exec('reset role');await rejects(()=>db.query('insert into prospect_requirements(requirement_id,prospect_id) values($1,$2)',[draft.id,id(999)]),'requirement_not_open');await as()
await rejects(()=>db.query('select recruitment_case_open($1,$2)',[id(999),draft.id]),'requirement_not_open')
await rejects(()=>saveReq({status:'open'},draft.id,draft.version),'reviewed_ship_required')
const fields={status:'open',company_id:company,ship_id:ship,rank_id:id(81),vessel_type_id:id(82),positions_required:1,target_days:30}
let open=await saveReq(fields,draft.id,draft.version)
assert.equal(open.location_reviewed_at!==null,true)
await rejects(()=>saveReq(fields,open.id,draft.version),'version_conflict')
await rejects(()=>saveReq({...fields,positions_required:null},open.id,open.version),'requirement_open_fields')
await rejects(()=>db.query('update requirements set ship_id=null where id=$1',[open.id]),'audited_ship_correction_required')
await rejects(()=>saveReq({...fields,ship_id:null},open.id,open.version,'Bad ship'),'reviewed_ship_required')
const ship2=(await db.query("insert into client_ships(name,company_id) values('Synthetic Ship 2',$1) returning id",[company])).rows[0].id
await rejects(()=>saveReq({...fields,ship_id:ship2},open.id,open.version),'correction_reason_required')
open=await saveReq({...fields,ship_id:ship2},open.id,open.version,'Reviewed original ship was wrong')
assert.equal((await db.query('select count(*)::int n from requirement_location_audit')).rows[0].n,1)
const company2=(await db.query("insert into client_companies(name) values('Synthetic Second Company') returning id")).rows[0].id
await rejects(()=>db.query('update client_ships set company_id=$1 where id=$2',[company2,ship2]),'referenced_ship_requires_audited_requirement_correction')
await rejects(()=>db.query('update client_ships set id=$1 where id=$2',[id(911),ship2]),'immutable_ship_identity')
await db.query('update client_ships set name=$1 where id=$2',['Synthetic renamed ship',ship2])
await db.query('update client_companies set archived_at=now() where id=$1',[company])
const closed=await saveReq({...fields,ship_id:ship2,status:'closed'},open.id,open.version)
assert.equal(closed.status,'closed')
await rejects(()=>saveReq({...fields,ship_id:ship2},closed.id,closed.version),'reviewed_company_required')
await db.query('update client_companies set archived_at=null where id=$1',[company])
await as('view_requirements,view_prospects')
await rejects(()=>saveReq({status:'draft'}),'permission_denied')
await rejects(()=>db.query("insert into client_companies(name) values('Denied')"),'row-level security')
await db.exec('reset role')
const lease=id(101),digest='b'.repeat(64)
const claim=async(hash=digest)=>db.query('select claim_platform_resume($1,$2,$3,$4,$5,$6,$7) result',[org,hash,'synthetic.pdf',100,'holmes_upload',actor,lease]).then(r=>r.rows[0].result)
const registration=await claim()
await rejects(()=>db.query('select finish_platform_resume($1,$2,$3)',[registration.file.id,id(102),'drive_test']),'resume_lease_expired')
await db.query('select finish_platform_resume($1,$2,$3)',[registration.file.id,lease,'drive_test'])
assert.equal((await claim()).version.id,registration.version.id)
assert.equal((await db.query('select count(*)::int n from resume_index_events')).rows[0].n,0)
await rejects(()=>db.query('update resume_files set drive_file_id=$1 where id=$2',['different',registration.file.id]),'immutable_original_conflict')
await db.query("insert into needle_resume_registry(organization_id,resume_id,filename,status,original_available) values($1,$2,'synthetic.pdf','pending',true)",[org,digest])
const evidence=(await db.query("insert into needle_resume_evidence(organization_id,resume_id,actor_id,source) values($1,$2,$3,'holmes_upload') returning id",[org,digest,actor])).rows[0].id
await as()
await rejects(()=>db.query('select * from resume_files'),'permission denied')
await rejects(()=>db.query('select save_resume_candidate($1,$2)',[evidence,'{}']),'permission denied')
await rejects(()=>db.query("insert into prospects(name,email,status,needle_resume_id,resume_evidence_id) values('Synthetic bypass','bypass@example.invalid','open',$1,$2)",[digest,evidence]),'platform_identity_review_required')
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from resume_identity_reviews')).rows[0].n,0)
assert.equal((await db.query('select count(*)::int n from prospect_resumes')).rows[0].n,0)
await as()
const review=(decision,fields={},link=null)=>db.query('select review_platform_resume($1,$2,$3,$4,$5) result',[registration.version.id,evidence,decision,JSON.stringify(fields),link]).then(r=>r.rows[0].result)
assert.equal((await review('hold')).held,true)
assert.equal((await db.query('select platform_resume_review_queue() result')).rows[0].result.length,1)
const person=await review('new',{name:'Synthetic Platform Person',email:'platform@example.invalid'})
assert.equal(person.created,true)
await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from resume_index_events')).rows[0].n,1);await as()
assert.equal((await review('new',{name:'Must not overwrite',email:'changed@example.invalid'})).prospect_id,person.prospect_id)
await rejects(()=>review('hold'),'cannot_be_unlinked')
await db.exec('reset role')
assert.equal((await db.query('select name from prospects where id=$1',[person.prospect_id])).rows[0].name,'Synthetic Platform Person')
await rejects(()=>db.query('update resume_versions set candidate_id=null where id=$1',[registration.version.id]),'immutable_reviewed_version')
await db.exec('reset role')
await db.query("insert into resume_extractions(version_id,extractor_version,contract_version,payload,status) values($1,'synthetic-v1','v1','{}','needs_review'),($1,'synthetic-v1','v1','{}','needs_review')",[registration.version.id])
await rejects(()=>db.query("update resume_extractions set payload='{\"changed\":true}' where version_id=$1",[registration.version.id]),'immutable_extraction_attempt')
const second=await claim('c'.repeat(64))
await db.query('select finish_platform_resume($1,$2,$3)',[second.file.id,lease,'drive_second'])
await db.query("insert into needle_resume_registry(organization_id,resume_id,filename,status,original_available) values($1,$2,'same-name.pdf','pending',true)",[org,'c'.repeat(64)])
const e2=(await db.query("insert into needle_resume_evidence(organization_id,resume_id,actor_id,source) values($1,$2,$3,'holmes_upload') returning id",[org,'c'.repeat(64),actor])).rows[0].id
await as()
await rejects(()=>db.query('update prospects set needle_resume_id=$1,resume_evidence_id=$2 where id=$3',['c'.repeat(64),e2,person.prospect_id]),'platform_identity_review_required')
// Ordinary browser edits and the reviewed link path still work under real RLS.
await db.query('update prospects set telephone=$1 where id=$2',['+919000000007',person.prospect_id])
await db.query("select review_platform_resume($1,$2,'link',$3::jsonb,$4)",[second.version.id,e2,JSON.stringify({name:'Must not overwrite',email:'wrong@example.invalid'}),person.prospect_id])
await db.exec('reset role')
assert.equal((await db.query('select name from prospects where id=$1',[person.prospect_id])).rows[0].name,'Synthetic Platform Person')
assert.equal((await db.query('select count(*)::int n from prospect_resumes where prospect_id=$1',[person.prospect_id])).rows[0].n,2)
assert.equal((await db.query('select count(*)::int n from resume_index_events')).rows[0].n,2)
await as('view_prospects')
await rejects(()=>db.query('select platform_resume_review_queue()'),'permission_denied')
await rejects(()=>review('new',{}),'permission_denied')
await rejects(()=>db.query("select save_resume_lead_draft('{\"telephone\":\"+919000009999\"}')"),'permission_denied')
await db.close()
console.log('Platform SQL: PASS (Draft/open gates, audited correction, stale writes, RLS, immutable registry, reviewed identity, no overwrite, replay)')
