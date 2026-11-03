# Production Baseline Audit (before applying recruitment case v1)

Read-only. Run from your Mac, where the Supabase CLI is linked to project `btbqdviuqcpauojmorvx`. Nothing here changes the database. The migration `supabase/migrations/2026110207_recruitment_case_v1.sql` must not be applied until every check below is green.

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

## Read-only production audit, 2026-11-03

Project `btbqdviuqcpauojmorvx` was checked through the linked CLI and the production SQL editor. At the initial audit, migration history matched local files through `2026110204`. Recruitment-case v1 and the expiry-view fix are now `2026110207` and `2026110208`, still unapplied. This was a catalog/seed check, **not** a complete schema diff. With Docker running, a schema-only dump of `public` succeeded at `/private/tmp/holmes-prod-public-schema-20261103.sql` and confirmed that the active objects listed below were absent at the time. No candidate rows were dumped.

- Case-v1 dependencies exist, its organization/case names are free, and none of the checked Needle tables are present. The required case permissions match the three recruiter roles. `prospect_requirements` has zero rows to backfill.
- Historical RBAC and worksheet tables, 10/10 checked March-May functions, 7/7 triggers, 13/13 policies, 11/11 columns, and both worksheet customer seed rows are present. The worksheet template bucket is private; the four configuration tables have RLS enabled.
- Across the June-July migration declarations, 13/14 checked tables, 39/47 function names, 13/13 triggers, 19/19 policies, 40/41 indexes, and 14/15 selected later columns are present. The missing objects come from three June migrations:
  - `2026060307`: `current_request_email`, `claim_applicant_session`, and `edit_prospect_email_preclaim` are absent. The current callback does not call them; do not restore the email-only claim function without resolving invite-claim finding F3.
  - `2026060308`: `current_recruiter_role_name` is absent. The live `prepare_requirement_row()` function still calls it when a requirement is deleted.
  - `2026060309`: `prospects.invited_by_recruiter_id`, its index, `prospect_email_webhook_events`, and all four RPCs (`reserve_prospect_invite`, `release_prospect_invite_reservation`, `update_prospect_email_and_clear_bounce`, `record_prospect_email_bounce`) are absent. The deployed invite and bounce Edge Functions and the prospect-detail email correction still call those RPCs.
- The reference tables contain 57 countries, 113 ranks, and 103 vessel types; 30 permissions and 57 role-permission rows exist. All 209 course items across 53 Section 14 rows have the normalized keys. The new application-status history trigger is enabled and the old trigger is absent.
- The lookup tables have RLS enabled **intentionally** by `2026110200`, superseding `2026071002`; public read policies preserve catalog visibility. `COMPANY_NAME` and `CONTACT_EMAIL` remain unset by choice while there is no customer. They are optional email-branding settings, not a case-v1 schema blocker.

**Diff limitation:** `supabase db diff --linked --schema public` was attempted after Docker started, but its local shadow database could not replay the first historical migration: `2026031701_align_rbac_to_user_roles.sql` expects `public.user_roles`, which is supplied by a pre-migration baseline absent from the replay. This failure says nothing about whether production matches the later migrations. Build a replayable local baseline or compare catalog objects against the production schema dump before calling the full audit complete. Do not mark old migrations reverted or reapply them to production to make the diff pass.

**Gate:** The focused repair is now applied and rechecked, but do not apply recruitment-case v1 or replay the old migrations. Keep the webhook-events table inaccessible to `anon` and `authenticated`; retire the unused 0307 email-only claim helpers under the F3 invite-token design. Resolve the remaining schema comparison against a replayable baseline before the case migration. The cause of the missing objects has not been established; matching migration history alone does not prove how they disappeared.

### Focused repair `2026110205` (staging and production applied)

`supabase/migrations/2026110205_repair_invite_bounce_rpcs.sql` restores only `current_recruiter_role_name`, the four invite/bounce RPCs, `prospects.invited_by_recruiter_id` with its index, and `prospect_email_webhook_events`. Function bodies are byte-identical to `2026060308`/`2026060309`. The 0307 email-only claim helpers stay retired. A precheck aborts the transaction before any change if a dependency (`has_permission`, `get_user_role`, `master_recruiter_role_name`, 12-arg `write_audit_event`, `user_roles`, `roles`, `profiles`, required `prospects` columns) is missing.

Grants are explicit because Supabase default privileges grant new functions and tables to `anon` and `authenticated`; the original `revoke ... from public` did not remove those. In a PGlite model, the original 0309 left `reserve_prospect_invite` executable by `anon` and the webhook table readable by `authenticated`. The actual staging catalog instead lacked all five functions, the webhook table, and the inviter column/index before `0205`; it did not exhibit that particular exposure. After the repair:

| Object | anon | authenticated | service_role |
|---|---|---|---|
| `current_recruiter_role_name(uuid)` | no | execute (needed by the invoker trigger `prepare_requirement_row`) | execute |
| `reserve_prospect_invite`, `release_prospect_invite_reservation`, `record_prospect_email_bounce` | no | no | execute |
| `update_prospect_email_and_clear_bounce` | no | execute (checks `auth.uid()` + `edit_prospects`) | execute |
| `prospect_email_webhook_events` (RLS on, no policies) | none | none | select/insert/update/delete |

Test: `supabase/tests/repair_invite_bounce_rpcs.test.mjs` (22 passing checks: precheck rollback, production-like apply, grants, behaviour of all five functions, re-run, modelled apply over the originals).

### Audit action compatibility `2026110206` (staging and production applied)

Staging exposed a second dependency missed by the in-memory 0205 test: legacy `audit_log.action` is `NOT NULL`, but `write_audit_event()` and the invite Edge Function's direct audit inserts omit it. Before this fix, rollback-only staging calls to `record_prospect_email_bounce` and `update_prospect_email_and_clear_bounce` failed with SQLSTATE `23502`, `null value in column "action" of relation "audit_log" violates not-null constraint`. The same table/function definitions are in the production schema dump. `2026110206_fill_audit_log_action.sql` adds a BEFORE INSERT trigger that derives `action` from `event_type` only when `action` is absent; legacy explicit actions remain unchanged and rows with neither field still fail. Its six PGlite checks pass.

Both `0205` and `0206` were first applied to Holmes staging. Live staging checks passed for the five-function grant matrix, webhook-table RLS and privileges, invite reservation, bounce recording, email correction, the Edge Function's direct audit-insert shape, and a plain Recruiter's same-day requirement soft-delete. The database probes ran inside explicit transactions followed by rollback. The local app on port 3000 was confirmed to target staging; staging `APP_URL` was corrected from port 3001 to 3000, and `send-prospect-invite` was deployed there. From the signed-in staging recruiter UI, an approved synthetic prospect received an invite and showed `Link Sent`; correcting its plus-address and resending succeeded. The audit log showed `invite_sent`, `prospect.email_updated`, and `invite_sent`, each with non-null `action`. Staging's mail-routing override points to the owner's test inbox; receipt was not independently checked in this pass.

From an isolated worktree containing only the repair migrations, the production dry run listed exactly `0205` and `0206`. Both applied successfully; a subsequent dry run reported up to date. The live production catalog now shows all five functions with the expected role grants, the private webhook-events table with RLS on, the inviter column/index, and the audit-action trigger. The production invite and bounce Edge Functions remain active. No production candidate email, correction, bounce, or requirement deletion was initiated as a smoke test in this pass.

Next: complete a controlled production path smoke when appropriate, then resolve the schema-diff baseline before `2026110207` (recruitment-case v1). `2026110208` (expiry view) remains unapplied.
