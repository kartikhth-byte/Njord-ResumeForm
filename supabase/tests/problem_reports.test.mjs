import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite(), dir=process.argv[2]
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const q=async(sql,args=[]) => (await db.query(sql,args)).rows
const as=async(n,role='authenticated')=>{await db.exec('reset role');await q("select set_config('test.uid',$1,false)",[n?id(n):'']);await db.exec(`set role ${role}`)}
const deny=(fn,reason)=>assert.rejects(fn,e=>e.message.includes(reason))
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
create table auth.users(id uuid primary key,banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.is_platform_operator() returns boolean language sql stable as $$select auth.uid()='${id(3)}'::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema auth,storage to anon,authenticated,service_role;
grant all on storage.objects to authenticated,anon,service_role;
-- Simulate a stray broad policy: our restrictive policies must still protect this bucket.
create policy legacy_broad on storage.objects for all to authenticated,anon using(true) with check(true);
insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');`)
await db.exec(fs.readFileSync(`${dir}/2026111301_problem_reports.sql`,'utf8'))
await db.exec(fs.readFileSync(`${dir}/2026111301_problem_reports.sql`,'utf8'))
await as(null,'anon')
await deny(()=>q('select begin_problem_report($1,$2,$3,$4)',[id(11),'/recruiter/candidates','test','']),'permission denied')
await as(1)
const [first]=await q('select (begin_problem_report($1,$2,$3,$4)).*',[id(11),'/recruiter/candidates','test',''])
assert.equal(first.reporter_id,id(1));assert.equal(first.status,'new')
assert.equal(Date.parse(first.screenshot_expires_at)-Date.parse(first.created_at),7*86400000)
await deny(()=>q('update problem_reports set status=$1',['resolved']),'permission denied')
await deny(()=>q('select submit_problem_report($1)',[id(11)]),'screenshot_missing')
await deny(()=>q("insert into storage.objects values('problem-screenshots','unreserved.png','{}')"),'row-level security')
await q("insert into storage.objects values('problem-screenshots',$1,$2)",[first.screenshot_path,{mimetype:'image/png',size:1024}])
await q('select submit_problem_report($1)',[id(11)])
await q('select submit_problem_report($1)',[id(11)])
assert.equal((await q('select * from problem_reports')).length,1)
assert.equal((await q('select * from storage.objects')).length,1)
assert.equal((await q("update storage.objects set metadata='{}' returning *")).length,0)
assert.equal((await q('delete from storage.objects returning *')).length,0)
await as(2)
assert.equal((await q('select * from problem_reports')).length,0)
assert.equal((await q('select * from storage.objects')).length,0)
await deny(()=>q('select begin_problem_report($1,$2,$3,$4)',[id(11),'/recruiter/candidates','test','']),'report_unavailable')
await deny(()=>q('select submit_problem_report($1)',[id(11)]),'report_unavailable')
await deny(()=>q('select set_problem_report_status($1,$2)',[id(11),'resolved']),'operator_required')
await deny(()=>q("insert into storage.objects values('problem-screenshots',$1,$2)",[first.screenshot_path,{mimetype:'image/png',size:1024}]),'row-level security')
await as(null,'anon')
await deny(()=>q('select * from problem_reports'),'permission denied')
// anon bucket policy evaluates no authenticated RPCs because auth.uid() is null
assert.equal((await q('select * from storage.objects')).length,0)
await as(3)
assert.equal((await q('select * from problem_reports')).length,1)
assert.equal((await q('select * from storage.objects')).length,1)
await q('select set_problem_report_status($1,$2)',[id(11),'in_progress'])
assert.equal((await q('select * from problem_report_status_history'))[0].actor_id,id(3))
await deny(()=>q('select set_problem_report_status($1,$2)',[id(11),'invented']),'invalid_status')
await db.exec('reset role');await q("update problem_reports set screenshot_expires_at=now()-interval '1 minute' where id=$1",[id(11)])
await as(1);assert.equal((await q('select * from storage.objects')).length,0)
assert.equal((await q('select * from problem_reports')).length,1)
await as(3);assert.equal((await q('select * from storage.objects')).length,0)
await as(1)
await q('select begin_problem_report($1,$2,$3,$4)',[id(12),'/recruiter/requirements','test','first'])
await q('select begin_problem_report($1,$2,$3,$4)',[id(12),'/recruiter/requirements','test','retry'])
assert.equal((await q('select description from problem_reports where id=$1',[id(12)]))[0].description,'retry')
await db.exec('reset role');await q("update problem_reports set created_at=now()-interval '2 hours' where id=$1",[id(12)])
await as(1)
await deny(()=>q('select submit_problem_report($1)',[id(12)]),'report_expired')
await deny(()=>q("insert into storage.objects values('problem-screenshots',$1,$2)",[`${id(1)}/${id(12)}.png`,{mimetype:'image/png',size:100}]),'row-level security')
await deny(()=>q('select begin_problem_report($1,$2,$3,$4)',[id(13),'/auth/callback?token=secret','test','']),'invalid_report')
for(let i=20;i<48;i++) await q('select begin_problem_report($1,$2,$3,$4)',[id(i),'/recruiter/companies','test',''])
await deny(()=>q('select begin_problem_report($1,$2,$3,$4)',[id(49),'/recruiter/companies','test','']),'report_limit_reached')
console.log('Problem reports SQL: owner isolation, operator status audit, anonymous denial, immutable objects, expired access, abandoned uploads, retries and rate limit PASS')
await db.close()
