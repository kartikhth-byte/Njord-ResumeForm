// Close anonymous application access — migration tests against an in-memory Postgres (PGlite).
// Stubs auth, roles and storage; does not touch any real database.
// Run from a scratch dir:  npm i @electric-sql/pglite@0.2 && node close_anonymous_application_access.test.mjs <path-to>/supabase/migrations/2026110202_close_anonymous_application_access.sql
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
 create table public.applications(id uuid primary key default gen_random_uuid(), user_id uuid, status text default 'new', public_token text, submitted_at timestamptz, review_access_token_hash text, review_access_token_expires_at timestamptz);
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
await db.exec(fs.readFileSync(process.argv[2],'utf8'))
let pass=0,fail=0
const as=async(role,uid='')=>{ await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role ${role}`) }
const q=async(sql,p=[])=>(await db.query(sql,p)).rows
async function t(name,fn){ try{ await fn(); pass++; console.log('PASS',name)}catch(e){ fail++; console.log('FAIL',name,'-',e.message)} }
const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`) }
const denied=async(fn,m)=>{ try{ await fn(); throw new Error('NOT DENIED: '+m) }catch(e){ if(e.message.startsWith('NOT DENIED')) throw e } }

await as('anon')
await t('anon cannot read applications', async()=>{ await denied(()=>q('select * from applications'),'select') })
await t('anon cannot read application_data', async()=>{ await denied(()=>q('select * from application_data'),'select') })
await t('anon cannot read dashboard_applications', async()=>{ await denied(()=>q('select * from dashboard_applications'),'view') })
await t('anon cannot insert application', async()=>{ await denied(()=>q(`insert into applications(user_id) values ('${other}')`),'insert') })
await t('anon cannot call definer function', async()=>{ await denied(()=>q('select * from get_upcoming_events()'),'fn') })
await t('review RPC: correct token returns only that application', async()=>{ const r=(await q('select get_application_for_review($1,$2) j',['pub-11',tok]))[0].j; eq([r.application.id, r.data.section2.firstName, 'review_access_token_hash' in r.application],[U(11),'A',false],'payload') })
await t('review RPC: wrong token returns null', async()=>{ eq((await q('select get_application_for_review($1,$2) j',['pub-11','nope']))[0].j,null,'null') })
await t('review RPC: other app with no token returns null', async()=>{ eq((await q('select get_application_for_review($1,$2) j',['pub-12',tok]))[0].j,null,'null') })
await t('review RPC: expired token returns null', async()=>{ await db.exec(`reset role; update applications set review_access_token_expires_at=now()-interval '1 minute' where id='${U(11)}'; set role anon`); eq((await q('select get_application_for_review($1,$2) j',['pub-11',tok]))[0].j,null,'null'); await db.exec(`reset role; update applications set review_access_token_expires_at=now()+interval '7 days' where id='${U(11)}'; set role anon`) })
await t('anon cannot list photo objects', async()=>{ eq((await q('select count(*)::int n from storage.objects')).length?((await q('select count(*)::int n from storage.objects'))[0].n):0,0,'objects') })

await as('authenticated',applicant)
await t('applicant sees only own applications', async()=>{ eq((await q('select id from applications order by id')).map(r=>r.id),[U(11),U(13)],'own') })
await t('applicant sees only own application_data', async()=>{ eq((await q('select application_id from application_data order by application_id')).map(r=>r.application_id),[U(11),U(13)],'own data') })
await t('applicant can create own draft', async()=>{ await q(`insert into applications(user_id) values ('${applicant}')`) })
await t('applicant cannot create row for another user', async()=>{ await denied(()=>q(`insert into applications(user_id) values ('${other}')`),'insert other') })
await t('applicant can update own draft data', async()=>{ const r=await q(`update application_data set data='{"x":1}' where application_id='${U(13)}' returning id`); eq(r.length,1,'updated') })
await t('applicant cannot edit submitted application', async()=>{ const r=await q(`update applications set status='hired' where id='${U(11)}' returning id`); eq(r.length,0,'blocked') })
await t('applicant cannot read view rows of others', async()=>{ eq((await q('select id from dashboard_applications order by id')).map(r=>r.id),[U(11),U(13)],'view invoker') })
await t('applicant sees only own photos', async()=>{ eq((await q('select name from storage.objects')).map(r=>r.name),[`${applicant}/1.png`],'photos') })
await t('applicant cannot call service-only function', async()=>{ await denied(()=>q('select reserve_prospect_invite()'),'service fn') })

await as('authenticated',recruiter)
await t('recruiter sees all applications', async()=>{ eq((await q('select count(*)::int n from applications'))[0].n,4,'all') })
await t('recruiter sees all application_data', async()=>{ eq((await q('select count(*)::int n from application_data'))[0].n,3,'all data') })
await t('recruiter can update status', async()=>{ eq((await q(`update applications set status='under_review' where id='${U(11)}' returning id`)).length,1,'update') })
await t('recruiter cannot delete submitted application', async()=>{ eq((await q(`delete from applications where id='${U(11)}' returning id`)).length,0,'no delete') })
await t('recruiter can delete a draft', async()=>{ await q(`delete from application_data where application_id='${U(13)}'`); eq((await q(`delete from applications where id='${U(13)}' returning id`)).length,1,'draft deleted') })
await t('recruiter reads all photos', async()=>{ eq((await q('select count(*)::int n from storage.objects'))[0].n,2,'photos') })
await t('recruiter can call definer function', async()=>{ await q('select * from get_upcoming_events()') })

await db.exec('reset role')
await t('buckets are private', async()=>{ eq((await q('select bool_or(public) b from storage.buckets'))[0].b,false,'public') })
await t('leaky policies removed', async()=>{ const r=await q(`select policyname from pg_policies where policyname in ('Public can view by token','Anyone can insert','Public data by token','public photos')`); eq(r.length,0,'old policies') })
await t('service-only function not widened', async()=>{ const r=(await q(`select has_function_privilege('authenticated','public.reserve_prospect_invite()','EXECUTE') a, has_function_privilege('service_role','public.reserve_prospect_invite()','EXECUTE') s`))[0]; eq([r.a,r.s],[false,true],'grants') })
await t('migration is re-runnable', async()=>{ await db.exec(fs.readFileSync(process.argv[2],'utf8')) })
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0)
