# Production RLS And Storage Audit (2026-11-04)

## Scope And Evidence

Read-only production schema dump covered `public`, `storage`, and `auth`.
A separate bucket-metadata-only dump excluded storage objects and applicant
files. No candidate or application rows were copied. This is a catalog and
policy review, not a complete HTTP penetration test.

- All 46 `public` tables and all 8 `storage` tables in the dump have RLS on.
- All three storage buckets (`application-photos`, `offer-letters`, and
  `worksheet-templates`) have `public = false`.
- Eleven Supabase-managed `auth` tables lack RLS in this schema snapshot, but
  the dump shows no `anon` or `authenticated` table grants on them. Do not
  modify vendor-owned `auth` schema objects based on this audit alone.
- `dashboard_applications` already runs as `security_invoker`.

## Fixed On Staging And Production

### `0214`: Expiry view access

`public.v_expiring_documents` was owner-run and granted to `anon`, so its
queries could bypass the underlying application RLS. It exposes applicant
names, references, document types, and expiry dates when the legacy JSON paths
contain data. `2026110214_make_expiry_view_invoker.sql` revokes anonymous
access and makes the view run with the caller's permissions. Seven PGlite
checks reproduced the owner-view leak with synthetic rows, then verified
anonymous denial and own-row visibility. Staging and production dry runs
listed only `0214`, and schema readbacks confirmed `security_invoker=true`
with no anonymous grant. This does **not** correct the view's outdated
document-extraction paths; that separate behavior is in unapplied `0208`.

### `0215`: Embeddings and reminders

`application_embeddings` allowed any authenticated user to INSERT or UPDATE
using unconditional RLS policies. `scheduled_reminders` allowed any
authenticated user to INSERT and read every reminder. Applicants could
therefore poison recruiter search data or schedule/read recruiter reminder
rows through the API. `2026110215_guard_embeddings_and_reminders.sql` restricts
embedding writes and reminder reads to recruiter-profile users; reminder
inserts additionally require an event scheduled by the caller. Service-role
processing is unchanged. Nine PGlite checks reproduced the old applicant
access, then verified applicant denial, recruiter insert/update/read, and
foreign-event denial. Staging and production dry runs listed only `0215`;
schema readbacks confirmed the replacement policies. Live UI smoke was not
available because browser control failed before reaching the staging editor.

## Open Role Boundary

The older `docs/prd.md` says a Coordinator can view candidates and support
scheduling/status workflows. The newer prospect-enrollment role matrix makes
Coordinator read-only for prospects and requirements, with no note access.
Production policies use coarse `profiles.user_type = 'recruiter'` or
`is_recruiter(auth.uid())` in several older application paths:

- `applications` SELECT, UPDATE, and draft DELETE; `application_data` SELECT
- `application_status_history` and legacy history SELECT/INSERT
- `scheduled_events` and `event_participants` management
- applicant photo/expiry/notification reads and offer-letter storage access

Because Coordinators are recruiter-profile users, these policies can grant
more than the page-level role guards imply. Do not replace them with a guessed
permission until the owner resolves whether Coordinator is read-only for the
older application workflow or may schedule/change status. Then test all three
recruiter roles plus an applicant at the API level, including photo and offer
storage paths. This remains an authorization finding, not a signed-off area.

## Additional Follow-Up

- `application_photos` has a legacy SELECT policy named "Anyone can view
  submitted application photos by token" that checks only that a public
  token exists, not that the caller supplied it. Anonymous access to the
  underlying `applications` table is currently revoked, so this is not
  evidence of a live anonymous photo leak. Replace the misleading policy
  after testing signed review links and applicant/recruiter photo reads.
- The photo storage owner policy and photo-table UPDATE/DELETE policies do
  not require an unsubmitted draft. Review whether applicants should be able
  to replace a photo after submission; preserve intended correction flows.
- `profiles_read_self_or_recruiter` uses `view_requirements`, so a Coordinator
  with that permission can read all profile rows. Confirm whether that is
  needed for recruiter labels, then narrow it if not.
- A live rollback-only staging requirement INSERT through an authenticated
  Recruiter session is still unverified. The `0211` synthetic trigger test
  passed, but the staging browser editor was unavailable for this run.
- Full HTTP checks of anonymous Data API endpoints and signed/private storage
  URLs were not performed here. The schema and bucket settings are necessary
  evidence, not proof that every edge route or signed URL is safe.

`0208` remains unapplied; no case-v1 migration was applied to production.
