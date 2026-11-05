// Run from a scratch directory with @electric-sql/pglite installed:
// node bind_applicant_claim_to_invite.test.mjs <migration>
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const db = new PGlite()
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const email = 'shared@example.test'
const token = (char) => char.repeat(64)
const query = async (sql, params = []) => (await db.query(sql, params)).rows
const claim = (hash) => query('select public.claim_applicant_magic_link($1) as result', [hash])
const asUser = async (userId, userEmail = email) => {
  await query("select set_config('test.uid', $1, false), set_config('test.email', $2, false)", [userId, userEmail])
}
const expectRejected = async (fn, reason) => assert.rejects(fn, (error) => error.message.includes(reason))

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('email', current_setting('test.email', true))
  $$;
  create table public.organizations(id uuid primary key, name text);
  create function public.default_organization_id() returns uuid language sql immutable as $$
    select '${id(1)}'::uuid
  $$;
  insert into public.organizations values ('${id(1)}', 'Organization A'), ('${id(2)}', 'Organization B');
  create table public.profiles(id uuid primary key, full_name text, email text, user_type text);
  create table public.prospects(
    id uuid primary key, name text not null, email text not null,
    email_normalized text generated always as (lower(btrim(email))) stored,
    status text not null, archived_at timestamptz, deleted_at timestamptz,
    bounce_flag boolean not null default false, applicant_user_id uuid,
    claimed_at timestamptz
  );
  create unique index prospects_email_live_uidx on public.prospects(email_normalized)
    where archived_at is null and deleted_at is null;
  create unique index prospects_applicant_user_uidx on public.prospects(applicant_user_id)
    where applicant_user_id is not null and deleted_at is null;
  create table public.applicant_magic_link_requests(
    id uuid primary key, prospect_id uuid, email text not null,
    email_normalized text not null, request_status text not null,
    sent_to_email text, sent_at timestamptz, invalidated_at timestamptz,
    invalidation_reason text, created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table public.applications(
    id uuid primary key default gen_random_uuid(), user_id uuid not null,
    status text not null, submitted_at timestamptz, prospect_id uuid,
    created_at timestamptz, updated_at timestamptz
  );
  create table public.application_data(
    application_id uuid, data jsonb, created_at timestamptz, updated_at timestamptz
  );
  alter table public.applications enable row level security;
  create policy applications_insert_own_draft on public.applications
    for insert to authenticated with check (user_id = auth.uid());
`)

const migration = fs.readFileSync(process.argv[2], 'utf8')
await db.exec(migration)
await db.exec(migration)

await query('insert into prospects(id, name, email, status, organization_id) values ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)', [
  id(11), 'Person A', email, 'approved', id(1),
  id(12), 'Person B', email, 'approved', id(2),
])
await query(`insert into applicant_magic_link_requests
  (id, prospect_id, organization_id, email, email_normalized, request_status, claim_token_hash, sent_at)
  values ($1,$2,$3,$4,$5,'sent',$6,now()), ($7,$8,$9,$10,$11,'sent',$12,now())`, [
  id(21), id(11), id(1), email, email, token('a'),
  id(22), id(12), id(2), email, email, token('b'),
])

await asUser(id(31))
await expectRejected(() => claim(token('c')), 'invalid_claim')
await expectRejected(() => query('select start_claimed_application($1)', [id(12)]), 'claim_required')
const first = (await claim(token('a')))[0].result
assert.equal(first.prospect_id, id(11))
assert.equal(first.organization_id, id(1))
assert.equal((await query('select applicant_user_id from prospects where id=$1', [id(12)]))[0].applicant_user_id, null)
await expectRejected(() => claim(token('a')), 'invalid_claim')
const draft = (await query('select start_claimed_application($1, $2::jsonb) as id', [id(11), '{"section1":{"name":"Synthetic"}}']))[0].id
assert.equal((await query('select prospect_id from applications where id=$1', [draft]))[0].prospect_id, id(11))
assert.equal((await query('select data from application_data where application_id=$1', [draft]))[0].data.section1.name, 'Synthetic')
assert.equal((await query('select jsonb_array_length(get_applicant_claims()) as n'))[0].n, 1)

// The second organization's invitation can be claimed by the same account,
// but neither request may silently attach to the other organization's row.
const second = (await claim(token('b')))[0].result
assert.equal(second.prospect_id, id(12))
assert.equal(second.organization_id, id(2))
assert.equal((await query('select jsonb_array_length(get_applicant_claims()) as n'))[0].n, 2)

await query(`insert into applicant_magic_link_requests
  (id, prospect_id, organization_id, email, email_normalized, request_status, claim_token_hash, sent_at)
  values ($1,$2,$3,$4,$5,'sent',$6,now())`, [id(23), id(11), id(2), email, email, token('d')])
await expectRejected(() => claim(token('d')), 'invalid_claim')
await query(`insert into applicant_magic_link_requests
  (id, prospect_id, organization_id, email, email_normalized, request_status, claim_token_hash, sent_at)
  values ($1,$2,$3,$4,$5,'sent',$6,now() - interval '2 hours')`, [id(24), id(11), id(1), email, email, token('e')])
await expectRejected(() => claim(token('e')), 'invalid_claim')
await query(`insert into applicant_magic_link_requests
  (id, prospect_id, organization_id, email, email_normalized, request_status, claim_token_hash, sent_at)
  values ($1,$2,$3,$4,$5,'sent',$6,now())`, [id(25), id(11), id(1), email, email, token('f')])
await asUser(id(32), 'different@example.test')
await expectRejected(() => claim(token('f')), 'invalid_claim')
await asUser(id(32))
await expectRejected(() => claim(token('f')), 'invalid_claim')
assert.equal((await query("select has_function_privilege('anon','public.claim_applicant_magic_link(text)','execute') as allowed"))[0].allowed, false)
assert.equal((await query("select has_function_privilege('authenticated','public.claim_applicant_magic_link(text)','execute') as allowed"))[0].allowed, true)
assert.equal((await query("select has_function_privilege('anon','public.start_claimed_application(uuid,jsonb)','execute') as allowed"))[0].allowed, false)
assert.equal((await query("select has_function_privilege('authenticated','public.start_claimed_application(uuid,jsonb)','execute') as allowed"))[0].allowed, true)
assert.equal((await query("select count(*)::int as n from pg_policies where tablename='applications' and policyname='applications_insert_own_draft'"))[0].n, 0)

console.log('Invite-bound applicant claim migration checks passed')
