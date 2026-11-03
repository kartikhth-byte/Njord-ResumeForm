# Production Baseline Audit (before applying recruitment case v1)

Read-only. Run from your Mac, where the Supabase CLI is linked to project `btbqdviuqcpauojmorvx`. Nothing here changes the database. The migration `supabase/migrations/2026110204_recruitment_case_v1.sql` must not be applied until every check below is green.

## 1. Migration history

```
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
supabase migration list --linked
```

Expect every local migration up to `2026071104_reapply_magic_link_infrastructure` to show as applied remotely, and no remote-only versions. Any gap is a blocker: the database was once rebuilt from a schema-only baseline (see `docs/tasks.md`).

## 2. Objects the new migration depends on or could collide with

Run in the Supabase dashboard SQL editor (read-only):

```sql
-- Must exist (dependencies)
select to_regprocedure('public.has_permission(uuid,text)') as has_permission,
       to_regclass('public.prospects') as prospects,
       to_regclass('public.requirements') as requirements,
       to_regclass('public.applications') as applications,
       to_regclass('public.prospect_requirements') as prospect_requirements,
       to_regclass('public.profiles') as profiles;

-- Must NOT exist yet (name collisions)
select to_regclass('public.organizations') as organizations,
       to_regclass('public.recruitment_cases') as recruitment_cases,
       to_regclass('public.recruitment_case_events') as recruitment_case_events,
       to_regprocedure('public.default_organization_id()') as default_org_fn;

-- Needle tables in the Holmes project? (review finding F5)
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('users','devices','agent_settings','candidates','candidate_events',
                     'candidate_resume_facts','download_jobs','download_job_logs',
                     'app_runtime_config','ai_file_registry','ai_feedback','njordhr_telemetry_logs');

-- Permissions the case functions rely on
select r.name as role, array_agg(p.name order by p.name) as permissions
from public.roles r
join public.role_permissions rp on rp.role_id = r.id
join public.permissions p on p.id = rp.permission_id
where p.name in ('create_prospects','edit_junction_status','withdraw_junctions','send_prospect_invites','view_requirements')
group by r.name;

-- Size of the backfill (counts only)
select status, count(*) from public.prospect_requirements group by status order by status;
```

Green when: all dependencies are non-null; all collision checks are null; the Needle query returns no rows (if it returns rows, stop and decide on F5 first); Master Recruiter and Recruiter hold the five permissions and Coordinator holds only `view_requirements`.

## 3. Deployed functions and secrets (names only)

```
supabase functions list
supabase secrets list
```

Record which email functions are deployed and whether `COMPANY_NAME` / `CONTACT_EMAIL` are set (needed after the branding change).

## 4. Outstanding security items

- Confirm the Resend API key from git history (`test-email.js`) has been rotated (`docs/tasks.md`).

## After the audit

Paste the outputs into the session. If everything is green, apply the migration to a staging/branch database first, run `supabase/tests/recruitment_case_v1.test.mjs` logic against it, then production.
