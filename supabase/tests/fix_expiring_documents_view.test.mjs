// Expiring documents view — tests against an in-memory Postgres (PGlite).
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node fix_expiring_documents_view.test.mjs <path>/2026110202_close_anonymous_application_access.sql <path>/2026110208_fix_expiring_documents_view.sql
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
 create table public.applications(id uuid primary key default gen_random_uuid(), user_id uuid, status text default 'new', public_token text, submitted_at timestamptz, review_access_token_hash text, review_access_token_expires_at timestamptz, reference_number text);
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

// old (live) view shape, so CREATE OR REPLACE is checked against it
await db.exec(`create view public.v_expiring_documents as
  select a.id as application_id, a.reference_number, a.status, 'x'::text as applicant_name, 'y'::text as "position",
         null::date as expiry_date, 'Passport'::text as document_name, 'passport'::text as document_type,
         0 as days_until_expiry, null::text as urgency_level
  from applications a join application_data ad on ad.application_id = a.id where false;
  grant select on public.v_expiring_documents to anon, authenticated;`)
await db.exec(fs.readFileSync(process.argv[2],'utf8'))   // 2026110202
const d=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)}
const data = {
  section1:{appliedForRank:'Master'}, section2:{firstName:'Ann', surname:'Lee'},
  section3:{dateOfExpiry:d(20)}, section4:{dateOfExpiry:'not-a-date'},
  section5:{visas:[{type:'C1/D',dateOfExpiry:d(50)},{type:'Schengen',dateOfExpiry:d(400)}]},
  section8:{certificates:[{grade:'Master',dateOfExpiry:d(10),dateRevalidationExpiry:d(80)},{grade:'Chief Mate',dateOfExpiry:'2026-02-30'}]},
  section9:{gmdss:[{dateOfExpiry:d(-5)}]},
  section10:{medicalFitness:[{type:'PEME',dateOfExpiry:d(30)}], vaccinations:{yellowFever:{received:true,dateOfExpiry:d(5),lifetimeValidity:true}}},
  section14:{courses:[{courseName:'Basic Training',dateOfExpiry:d(60)}]},
  section15:{endorsements:{not:'an array'}}
}
await db.query(`update application_data set data=$1 where application_id=$2`, [data, U(11)])
await db.query(`update application_data set data=$1 where application_id=$2`, [{section3:{dateOfExpiry:d(15)}}, U(12)])
await db.exec(`
  create table auth.users(id uuid primary key);
  insert into auth.users values ('${applicant}'),('${other}'),('${recruiter}');
  alter table profiles add column full_name text, add column email text;
  update profiles set email = id::text || '@example.com';
  create table public.document_expiries(
    id uuid primary key default gen_random_uuid(),
    application_id uuid references applications(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    document_type text, document_name text, section_number int, expiry_date date,
    issuing_authority text, certificate_number text, place_of_issue text,
    constraint valid_document_type check (document_type = any (array['passport','seaman_book','visa','coc','gmdss','medical','yellow_fever','course','endorsement'])),
    constraint valid_section check (section_number = any (array[3,4,5,8,9,10,14,15])));
  create table public.expiry_notifications(
    id uuid primary key default gen_random_uuid(),
    document_expiry_id uuid references document_expiries(id) on delete cascade,
    application_id uuid, user_id uuid, notification_type text, status text default 'sent', warning_level text, sent_to_applicant boolean, sent_to_recruiter boolean, applicant_email text, subject text, template_used text, sent_at timestamptz, scheduled_for timestamptz, error_message text,
    unique (document_expiry_id, notification_type));
  create function public.get_documents_needing_warnings() returns table(id uuid) language sql security definer as 'select id from document_expiries';
  grant execute on function public.get_documents_needing_warnings() to authenticated;
`)
await db.exec(fs.readFileSync(process.argv[3],'utf8'))   // 2026110208
let pass=0, fail=0
const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'-',e.message)}}
const ok=(c,m)=>{if(!c)throw new Error(m)}
const as=async(role, uid, sql)=>{ await db.exec(`reset role; select set_config('test.uid','${uid||''}',false); set role ${role};`); try { return (await db.query(sql)).rows } finally { await db.exec('reset role') } }
const all=(await db.query(`select * from v_expiring_documents order by application_id, document_key`)).rows
const mine=all.filter(r=>r.application_id===U(11))
const keys=mine.map(r=>r.document_key)
await t('passport from section3.dateOfExpiry', async()=>ok(keys.includes('passport') && mine.find(r=>r.document_key==='passport').urgency_level==='critical', JSON.stringify(keys)))
await t('bad CDC date ignored, no error', async()=>ok(!keys.includes('seaman_book'), 'present'))
await t('visa within 90 days only', async()=>ok(keys.includes('visa:0') && !keys.includes('visa:1'), JSON.stringify(keys)))
await t('CoC uses revalidation expiry', async()=>{ const r=mine.find(r=>r.document_key==='coc:0'); ok(r && r.days_until_expiry===80 && r.urgency_level==='moderate', JSON.stringify(r)) })
await t('impossible date (Feb 30) ignored', async()=>ok(!keys.includes('coc:1'), 'present'))
await t('expired GMDSS listed as expired', async()=>ok(mine.find(r=>r.document_key==='gmdss:0')?.urgency_level==='expired', 'missing'))
await t('medical from section10.medicalFitness[]', async()=>ok(mine.find(r=>r.document_key==='medical:0')?.document_name==='Medical — PEME', 'missing'))
await t('lifetime yellow fever excluded', async()=>ok(!keys.includes('yellow_fever'), 'present'))
await t('course listed by name', async()=>ok(mine.find(r=>r.document_key==='course:0')?.document_name==='Basic Training', 'missing'))
await t('non-array endorsements tolerated', async()=>ok(!keys.some(k=>k.startsWith('endorsement')), 'present'))
await t('applicant name built from parts', async()=>ok(mine[0].applicant_name==='Ann Lee', mine[0].applicant_name))
await t('draft application excluded', async()=>ok(!all.some(r=>r.application_id===U(13)), 'draft present'))
await t('keys unique per application', async()=>ok(new Set(keys).size===keys.length, 'dup'))
await t('recruiter sees all submitted', async()=>{ const r=await as('authenticated', recruiter, 'select distinct application_id from v_expiring_documents'); ok(r.length===2, r.length) })
await t('applicant sees only own', async()=>{ const r=await as('authenticated', applicant, 'select distinct application_id from v_expiring_documents'); ok(r.length===1 && r[0].application_id===U(11), JSON.stringify(r)) })
await t('anon cannot select', async()=>{ try { await as('anon', null, 'select 1 from v_expiring_documents'); throw new Error('allowed') } catch(e){ ok(/permission/.test(e.message), e.message) } })


await t('backlog: every in-window document marked at its current level, no email flag', async()=>{
  const r=(await db.query(`select de.id, de.expiry_date - current_date as d, n.notification_type, n.sent_to_applicant
    from document_expiries de left join expiry_notifications n on n.document_expiry_id=de.id
    where de.expiry_date - current_date <= 90`)).rows
  ok(r.length>0 && r.every(x=>x.notification_type && x.sent_to_applicant===false), JSON.stringify(r))
  const exp=r.find(x=>x.d<0); ok(!exp || exp.notification_type==='expired', JSON.stringify(exp))
})
await t('warnings: sync fills document_expiries', async()=>{ const r=await db.query('select * from get_documents_needing_warnings()'); ok(r.rows.length>0, 'none'); const c=(await db.query('select count(*)::int n from document_expiries')).rows[0].n; ok(c>=r.rows.length, 'table '+c) })
await t('warnings: only within 90 days, with email', async()=>{ const r=(await db.query('select * from get_documents_needing_warnings()')).rows; ok(r.every(x=>x.days_until_expiry<=90 && x.applicant_email), JSON.stringify(r[0])) })
await t('warnings: ids stable across runs', async()=>{ const a=(await db.query('select id from document_expiries order by id')).rows.map(r=>r.id).join(); await db.query('select * from get_documents_needing_warnings()'); const b=(await db.query('select id from document_expiries order by id')).rows.map(r=>r.id).join(); ok(a===b,'changed') })
await t('warnings: renewed document clears its old notifications', async()=>{
  const de=(await db.query(`select id from document_expiries where application_id='${U(11)}' and document_key='passport'`)).rows[0]
  await db.query(`insert into expiry_notifications(document_expiry_id, notification_type) values ($1,'30_day') on conflict do nothing`, [de.id])
  const cur=(await db.query(`select data from application_data where application_id='${U(11)}'`)).rows[0].data
  cur.section3.dateOfExpiry=d(70); await db.query(`update application_data set data=$1 where application_id='${U(11)}'`, [cur])
  await db.query('select * from get_documents_needing_warnings()')
  const n=(await db.query(`select count(*)::int n from expiry_notifications where document_expiry_id=$1`, [de.id])).rows[0].n
  const same=(await db.query(`select id from document_expiries where application_id='${U(11)}' and document_key='passport'`)).rows[0]
  ok(n===0 && same.id===de.id, 'n='+n)
})
await t('warnings: document removed from form is removed', async()=>{
  const cur=(await db.query(`select data from application_data where application_id='${U(11)}'`)).rows[0].data
  cur.section14.courses=[]; await db.query(`update application_data set data=$1 where application_id='${U(11)}'`, [cur])
  await db.query('select * from get_documents_needing_warnings()')
  const r=(await db.query(`select 1 from document_expiries where application_id='${U(11)}' and document_key='course:0'`)).rows
  ok(r.length===0,'still there')
})
await t('warnings function not callable by signed-in users', async()=>{ try { await as('authenticated', applicant, 'select * from get_documents_needing_warnings()'); throw new Error('allowed') } catch(e){ ok(/permission/.test(e.message), e.message) } })
await t('re-runnable', ()=>db.exec(fs.readFileSync(process.argv[3],'utf8')))
console.log(`\n${pass} passed, ${fail} failed`)
