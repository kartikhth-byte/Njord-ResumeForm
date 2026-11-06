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
await db.exec(fs.readFileSync(process.argv[2],'utf8'))
const perms='create_prospects,view_prospects,edit_prospects,edit_junction_status'
async function as(uid=actor,permissions=perms){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[uid,permissions]);await db.exec('set role authenticated')}
async function evidence(n,{owner=actor,organization=org,available=true,resume=String(n).padStart(64,'a')}={}){
 await db.exec('reset role')
 await db.query('insert into needle_resume_registry(organization_id,resume_id,filename,status,original_available) values($1,$2,\'synthetic.pdf\',\'ready\',$3) on conflict do nothing',[organization,resume,available])
 const e=(await db.query("insert into needle_resume_evidence(organization_id,resume_id,actor_id,source) values($1,$2,$3,'needle_search') returning id",[organization,resume,owner])).rows[0].id
 await as();return e
}
const save=(e,fields={},options={})=>db.query('select save_resume_candidate($1,$2::jsonb,$3,$4,$5,$6) result',[e,JSON.stringify(fields),options.req||null,options.link||null,options.confirm||false,options.version??null]).then(r=>r.rows[0].result)
const rejects=(fn,message)=>assert.rejects(fn,e=>e.message.includes(message))
const e1=await evidence(1)
await rejects(()=>save(e1,{name:'Synthetic'}),'phone_or_email_required')
await rejects(()=>save(e1,{name:'Synthetic',email:'bad'}),'valid_email_required')
const person=await save(e1,{name:'Synthetic First',email:'one@example.invalid',exp_in_rank_months:0},{req,version:1})
assert.equal(person.created,true)
assert.equal((await save(e1,{name:'changed',email:'else@example.invalid'},{req,version:1})).prospect_id,person.prospect_id)
await db.exec('reset role')
let row=(await db.query('select * from prospects where id=$1',[person.prospect_id])).rows[0]
assert.equal(row.dob,null);assert.equal(row.rank_applied_for_id,null);assert.equal(row.exp_in_rank_months,0);assert.equal(row.status,'open');assert.equal(row.first_contacted_at,null)
assert.equal((await db.query('select count(*)::int n from recruitment_cases')).rows[0].n,1)
await rejects(()=>db.query("update recruitment_cases set status='confirmed' where id=$1",[person.case_id]),'complete_phone_email_dob_nationality')
await as(other)
await rejects(()=>save(e1,{name:'Other',email:'other@example.invalid'}),'verified_resume_required')
const ef=await evidence(2,{organization:foreign})
await rejects(()=>save(ef,{name:'Foreign',email:'foreign@example.invalid'}),'verified_resume_required')
const ebad=await evidence(3,{available:false})
await rejects(()=>save(ebad,{name:'Unavailable',email:'none@example.invalid'}),'verified_resume_required')
const e2=await evidence(4)
await rejects(()=>save(e2,{name:'Copy',email:'one@example.invalid'}),'explicit_link')
const linked=await save(e2,{}, {link:person.prospect_id})
assert.equal(linked.created,false)
await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from prospect_resumes where prospect_id=$1',[person.prospect_id])).rows[0].n,2)
assert.equal((await db.query('select name from prospects where id=$1',[person.prospect_id])).rows[0].name,'Synthetic First')
await as()
await db.query('select update_resume_candidate_contacts($1,1,$2::jsonb)',[person.prospect_id,JSON.stringify({name:'Synthetic First',email:'one@example.invalid',telephone:'+919000000001',dob:'1990-01-01',nationality_id:id(9)})])
await rejects(()=>db.query('select update_resume_candidate_contacts($1,1,$2::jsonb)',[person.prospect_id,'{}']),'version_conflict')
await db.exec('reset role');await db.query("update recruitment_cases set status='confirmed' where id=$1",[person.case_id]);await as()
const e3=await evidence(5)
await rejects(()=>save(e3,{name:'Possible',telephone:'+919000000001'}),'possible_duplicate_requires_review')
assert.equal((await save(e3,{name:'Possible',telephone:'+919000000001'},{confirm:true})).created,true)
await as(actor,'view_prospects')
await rejects(()=>save(e1,{}),'permission_denied')
await rejects(()=>db.query('select find_resume_candidate_matches($1)', ['a'.repeat(64)]),'permission_denied')
await rejects(()=>db.query('insert into needle_resume_evidence(organization_id,resume_id,actor_id,source) values($1,$2,$3,\'needle_search\')',[org,'a'.repeat(64),actor]),'permission denied')
await db.exec('reset role')
assert.equal((await db.query("select has_function_privilege('anon','save_resume_candidate(uuid,jsonb,uuid,uuid,boolean,integer)','execute') allowed")).rows[0].allowed,false)
await db.close()
console.log('Candidate resume integration: PASS (minimal entry, contact gate, actor/org evidence, duplicates, idempotence, stale edits, denied roles)')
