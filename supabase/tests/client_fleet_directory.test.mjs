// Isolated actual migration, synthetic data, no network.
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const db = new PGlite()
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const org=id(1), actor=id(2), foreign=id(3), type=id(4)
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function needle_pilot_organization_id() returns uuid language sql as $$select '${org}'::uuid$$;
 create function has_permission(uuid,text) returns boolean language sql stable as $$select $2=any(string_to_array(current_setting('test.perms',true),','))$$;
 create function is_master_recruiter_profile(uuid) returns boolean language sql stable as $$select current_setting('test.role',true)='master'$$;
 create function is_platform_operator() returns boolean language sql stable as $$select current_setting('test.role',true)='operator'$$;
 create table vessel_types(id uuid primary key); insert into vessel_types values('${type}');
 create table requirements(id uuid primary key,company_id uuid,ship_id uuid,customer_name text,vessel_name text,vessel_type_id uuid);
 grant usage on schema public,auth to authenticated;
`)
const baseline=fs.readFileSync('supabase/migrations/2026110609_company_ship_drafts.sql','utf8')
await db.exec(baseline.slice(0,baseline.indexOf('alter table public.requirements add column'))+'commit;')
const identity=fs.readFileSync('supabase/migrations/2026110617_reviewed_candidate_and_ship_boundaries.sql','utf8')
await db.exec(identity.slice(identity.indexOf('create function public.guard_client_ship_identity()'),identity.indexOf('commit;')))
await db.exec(fs.readFileSync('supabase/migrations/2026111001_client_fleet_directory.sql','utf8'))
const as = async (role='master',perms='view_requirements,edit_requirements',uid=actor) => {
 await db.exec('reset role')
 await db.query("select set_config('test.uid',$1,false),set_config('test.role',$2,false),set_config('test.perms',$3,false)",[uid,role,perms])
 await db.exec('set role authenticated')
}
const save = (kind,name,record=null,company=null,vessel=null) => db.query('select save_client_fleet_record($1,$2,$3,$4,$5,$6) value',[kind,name,record?.id||null,company,vessel,record?.version??null]).then(r=>r.rows[0].value)
const rejects = (fn, text) => assert.rejects(fn, e => e.message.includes(text))
await as()
const company=await save('company',' Synthetic company ')
assert.equal(company.name,'Synthetic company')
const ship=await save('ship','Synthetic ship',null,company.id,type)
await rejects(()=>save('company','synthetic company'),'company_name_exists')
await rejects(()=>save('ship',' SYNTHETIC SHIP ',null,company.id,type),'ship_name_exists')
await rejects(()=>save('ship','No type',null,company.id),'vessel_type_required')
await rejects(()=>save('company','   '),'name_required')
await rejects(()=>save('company','a'.repeat(201)),'name_required')
await db.exec('reset role')
await db.query('insert into requirements values($1,$2,$3,$4,$5,$6)',[id(20),company.id,ship.id,company.name,ship.name,type])
await db.query('insert into client_companies(id,organization_id,name,created_by) values($1,$2,$3,$4)',[id(30),foreign,'Foreign',actor])
await as()
const renamed=await save('company','Corrected company',company)
assert.equal(renamed.id,company.id);assert.equal(renamed.version,2)
const renamedShip=await save('ship','Corrected ship',ship,company.id,type)
assert.equal(renamedShip.version,2)
await rejects(()=>save('ship','Stale overwrite',ship,company.id,type),'version_conflict')
await rejects(()=>save('company','Stale overwrite',company),'version_conflict')
await rejects(()=>save('company','Foreign overwrite',{id:id(30),version:1}),'record_unavailable')
await rejects(()=>save('ship','Foreign ship',null,id(30),type),'reviewed_company_required')
const company2=await save('company','Second company')
await rejects(()=>save('ship','Move ship',renamedShip,company2.id,type),'ship_company_cannot_change')
await rejects(()=>db.query("insert into client_companies(name) values('Bypass')"),'permission denied')
await rejects(()=>db.query("update client_ships set name='Bypass'"),'permission denied')
for (const role of ['recruiter','coordinator','applicant']) {
 await as(role,role==='recruiter'?'view_requirements,edit_requirements':role==='coordinator'?'view_requirements':'')
 await rejects(()=>save('company','Denied'),'permission_denied')
 const read=await db.query('select id from client_companies')
 assert.equal(read.rows.length,role==='applicant'?0:2)
}
await as('operator')
await save('company','Operator company')
await as('operator','view_requirements')
await rejects(()=>save('company','Permission absent'),'permission_denied')
await as('master','view_requirements,edit_requirements','')
await rejects(()=>save('company','Anonymous actor'),'permission_denied')
await db.exec('reset role')
const history=(await db.query('select * from requirements')).rows[0]
assert.equal(history.customer_name,company.name);assert.equal(history.vessel_name,ship.name)
await db.query('update client_companies set archived_at=now() where id=$1',[company.id])
await as()
await rejects(()=>save('company','Archived edit',renamed),'record_unavailable')
await rejects(()=>save('ship','Archived company',null,company.id,type),'reviewed_company_required')
await db.exec('set role anon')
await rejects(()=>save('company','Anonymous'),'permission denied')
console.log('PASS: fleet CRUD, versions, duplicates, organization/role/direct-write denial, immutable mapping and history')
await db.close()
