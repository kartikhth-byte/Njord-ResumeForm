// Guard applicant application writes — migration tests against an in-memory Postgres (PGlite).
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node guard_applicant_application_writes.test.mjs <path>/2026110202_close_anonymous_application_access.sql <path>/2026110204_guard_applicant_application_writes.sql
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import crypto from 'node:crypto'
const db = new PGlite()
const U=(n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0')
const applicant=U(1), other=U(2), recruiter=U(3)
const tok='raw-access-token-123', hash=crypto.createHash('sha256').update(tok).digest('hex')
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 grant usage on schema public to anon, authenticated, service_role;
 create schema auth; grant usage on schema auth to anon, authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
 grant execute on function auth.uid() to anon, authenticated;
 create table public.profiles(id uuid primary key, user_type text);
 insert into profiles values ('${applicant}','applicant'),('${other}','applicant'),('${recruiter}','recruiter');
 create table public.applications(id uuid primary key default gen_random_uuid(), user_id uuid, status text default 'new', public_token text, submitted_at timestamptz, review_access_token_hash text, review_access_token_expires_at timestamptz, offer_details jsonb, handling_recruiter_id uuid, reference_number text, applied_rank text, prospect_id uuid, updated_at timestamptz);
 create table public.application_data(id uuid primary key default gen_random_uuid(), application_id uuid, data jsonb);
 alter table applications enable row level security; alter table application_data enable row level security;
 grant all on applications, application_data to anon, authenticated;
 -- leaky live policies
 create policy "Public can view by token" on applications for select to anon, authenticated using (public_token is not null and submitted_at is not null);
 create policy "Anyone can insert" on applications for insert with check (true);
 create policy "Users own" on applications for all to authenticated using (user_id = auth.uid());
 create policy "Public data by token" on application_data for select using (exists(select 1 from applications a where a.id=application_id and a.public_token is not null));
 insert into applications(id,user_id,public_token,submitted_at,review_access_token_hash,review_access_token_expires_at) values
   ('${U(11)}','${applicant}','pub-11',now(),'${hash}',now()+interval '7 days'),
   ('${U(12)}','${other}','pub-12',now(),null,null),
   ('${U(13)}','${applicant}','pub-13',null,null,null);
 insert into application_data(application_id,data) values ('${U(11)}','{"section2":{"firstName":"A"}}'),('${U(12)}','{"section2":{"firstName":"B"}}'),('${U(13)}','{}');
 create view public.dashboard_applications as select a.id, a.public_token, d.data from applications a join application_data d on d.application_id=a.id;
 grant select on dashboard_applications to anon, authenticated;
 create function public.get_upcoming_events() returns setof applications language sql security definer as $$ select * from applications $$;
 create function public.reserve_prospect_invite() returns int language sql security definer as $$ select 1 $$;
 revoke all on function public.reserve_prospect_invite() from public; grant execute on function public.reserve_prospect_invite() to service_role;
 create function public.has_permission(u uuid, p text) returns boolean language sql stable security definer as $$ select false $$;
 -- storage stub
 create schema storage; create table storage.buckets(id text primary key, public boolean);
 insert into storage.buckets values ('application-photos',true),('offer-letters',true);
 create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
 alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 grant execute on function storage.foldername(text) to anon, authenticated;
 create policy "public photos" on storage.objects for select using (bucket_id = 'application-photos');
 insert into storage.objects(bucket_id,name) values ('application-photos','${applicant}/1.png'),('application-photos','${other}/2.png');
`)

await db.exec(fs.readFileSync(process.argv[2],'utf8'))   // 2026110202
await db.exec(fs.readFileSync(process.argv[3],'utf8'))   // 2026110204
let pass=0, fail=0
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'-',e.message)}}
const ok=(c,m)=>{if(!c)throw new Error(m)}
const as=async(uid, sql, params=[])=>{
  await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role authenticated;`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
const denied=async(uid, sql)=>{ try { await as(uid, sql); return false } catch(e){ return true } }
const D=U(21)

await t('applicant inserts own draft (status new)', async()=>{ await as(applicant, `insert into applications(id,user_id,status,offer_details,handling_recruiter_id) values ('${D}','${applicant}','new','{"x":1}','${recruiter}')`) })
await t('recruiter-only fields cleared on insert', async()=>{ const r=(await db.query(`select offer_details, handling_recruiter_id from applications where id='${D}'`)).rows[0]; ok(r.offer_details===null && r.handling_recruiter_id===null, JSON.stringify(r)) })
await t('applicant cannot insert as submitted', async()=>{ ok(await denied(applicant, `insert into applications(user_id,status) values ('${applicant}','submitted')`), 'allowed') })
await t('applicant cannot insert status offered', async()=>{ ok(await denied(applicant, `insert into applications(user_id,status) values ('${applicant}','offered')`), 'allowed') })
await t('autosave touch (updated_at) allowed', async()=>{ await as(applicant, `update applications set updated_at=now() where id='${D}'`) })
await t('draft cannot be set to offered', async()=>{ ok(await denied(applicant, `update applications set status='offered' where id='${D}'`), 'allowed') })
await t('draft cannot set handling recruiter', async()=>{ ok(await denied(applicant, `update applications set handling_recruiter_id='${recruiter}' where id='${D}'`), 'allowed') })
await t('draft cannot set review token hash', async()=>{ ok(await denied(applicant, `update applications set review_access_token_hash='x' where id='${D}'`), 'allowed') })
await t('submitted_at without submitted status denied', async()=>{ ok(await denied(applicant, `update applications set submitted_at=now() where id='${D}'`), 'allowed') })
await t('applicant submits (status, submitted_at, ref, token, rank)', async()=>{ await as(applicant, `update applications set status='submitted', submitted_at=now(), updated_at=now(), reference_number='R1', public_token='tok', applied_rank='Master' where id='${D}'`); const r=(await db.query(`select status from applications where id='${D}'`)).rows[0]; ok(r.status==='submitted', r.status) })
await t('submitted application no longer editable by applicant', async()=>{ const r=await as(applicant, `update applications set applied_rank='Bosun' where id='${D}'`); ok(r.affectedRows===0, 'rows '+r.affectedRows) })
await t('recruiter can change status', async()=>{ await as(recruiter, `update applications set status='offered', offer_details='{"a":1}' where id='${D}'`); const r=(await db.query(`select status from applications where id='${D}'`)).rows[0]; ok(r.status==='offered', r.status) })
await t('definer function can set prospect_id on applicant draft', async()=>{
  await db.exec(`create or replace function public.test_link(a uuid, p uuid) returns void language sql security definer as $$ update applications set prospect_id=p where id=a $$; grant execute on function public.test_link(uuid,uuid) to authenticated;`)
  await as(applicant, `insert into applications(id,user_id,status) values ('${U(22)}','${applicant}','new')`)
  await as(applicant, `select public.test_link('${U(22)}','${U(99)}')`)
  const r=(await db.query(`select prospect_id from applications where id='${U(22)}'`)).rows[0]; ok(r.prospect_id===U(99), JSON.stringify(r))
})
await t('migration re-runnable', ()=>db.exec(fs.readFileSync(process.argv[3],'utf8')))
console.log(`\n${pass} passed, ${fail} failed`)
