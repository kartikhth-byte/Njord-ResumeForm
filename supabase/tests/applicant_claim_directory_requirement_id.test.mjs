import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const query = async (sql, args = []) => (await db.query(sql, args)).rows
const migration = process.argv[2] || new URL('../migrations/2026111501_applicant_claim_directory_requirement_id.sql', import.meta.url)

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    create table public.organizations (id uuid primary key, name text not null);
    create table public.profiles (id uuid primary key, user_type text not null);
    create table public.prospects (id uuid primary key, organization_id uuid not null,
      applicant_user_id uuid, archived_at timestamptz, deleted_at timestamptz,
      bounce_flag boolean not null default false);
    create table public.requirements (id uuid primary key, display_id text not null,
      req_id_display text not null, status text not null,
      archived_at timestamptz, deleted_at timestamptz);
    create table public.recruitment_cases (id uuid primary key, prospect_id uuid not null,
      organization_id uuid not null, requirement_id uuid not null,
      application_id uuid, form_invited_at timestamptz, status text not null);
    create function public.case_form_invite_eligible(p_case uuid, p_prospect uuid,
      p_require_invited boolean) returns boolean language sql stable as $$
      select exists(select 1 from public.recruitment_cases
        where id = p_case and prospect_id = p_prospect
          and (not p_require_invited or form_invited_at is not null))
    $$;
    create function public.recruitment_case_post_interview(p_status text)
      returns boolean language sql immutable as $$ select p_status = 'interview_passed' $$;
  `)
  await db.exec(await fs.readFile(migration, 'utf8'))
  await db.exec(await fs.readFile(migration, 'utf8')) // Safe to replay.
  await db.exec(`
    insert into public.organizations values ('${id(1)}', 'Synthetic fleet');
    insert into public.profiles values
      ('${id(10)}', 'applicant'), ('${id(11)}', 'applicant'), ('${id(12)}', 'recruiter');
    insert into public.prospects (id, organization_id, applicant_user_id) values
      ('${id(20)}', '${id(1)}', '${id(10)}'),
      ('${id(21)}', '${id(1)}', '${id(11)}');
    insert into public.requirements (id, display_id, req_id_display, status) values
      ('${id(30)}', 'REQ-000003', '2026-Nov-005', 'open'),
      ('${id(31)}', 'REQ-000004', '2026-Nov-006', 'closed');
    insert into public.recruitment_cases (id, prospect_id, organization_id,
      requirement_id, form_invited_at, status) values
      ('${id(40)}', '${id(20)}', '${id(1)}', '${id(30)}', now(), 'interview_passed'),
      ('${id(41)}', '${id(20)}', '${id(1)}', '${id(31)}', now(), 'interview_passed'),
      ('${id(42)}', '${id(21)}', '${id(1)}', '${id(30)}', now(), 'interview_passed');
  `)
  const claimsFor = async actor => {
    await db.exec('reset role')
    await query("select set_config('test.uid', $1, false)", [actor ? id(actor) : ''])
    await db.exec('set role authenticated')
    return (await query('select public.get_applicant_claims() as claims'))[0].claims
  }
  assert.deepEqual(await claimsFor(10), [{
    prospect_id: id(20), organization_id: id(1), organization_name: 'Synthetic fleet',
    case_id: id(40), requirement_reference: 'REQ-000003',
    requirement_legacy_reference: '2026-Nov-005', application_id: null,
  }])
  assert.equal((await claimsFor(11)).length, 1)
  assert.deepEqual(await claimsFor(12), [])
  assert.deepEqual(await claimsFor(null), [])
  await db.exec('reset role; set role anon')
  await assert.rejects(query('select public.get_applicant_claims()'), /permission denied/)
  console.log('PASS applicant claims use stable REQ ID, retain legacy reference, and preserve identity/invitation scope')
} finally {
  await db.close()
}
