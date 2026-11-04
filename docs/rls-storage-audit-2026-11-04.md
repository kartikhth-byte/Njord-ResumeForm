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

## Coordinator Role Boundary

The owner chose read-only Coordinator access for applications, statuses,
scheduling, photos, and offer letters. `0216` adds restrictive write policies
to the older coarse recruiter-profile policies for applications, scheduled
events/participants/history/reminders, embeddings, legacy status history, and
offer-letter storage. `0217` removes any drifted Coordinator grant of
`edit_junction_status`; Recruiter and Master Recruiter retain that permission.
`0218` also closes the old owned-draft and photo write paths for a
recruiter-profile Coordinator while preserving applicant ownership writes.
The Applications and application-detail pages hide decision controls for
Coordinators. Four scheduling/invitation functions now check the editor
permission before service-role writes or emails.

All three migrations were applied to staging and production after exact dry
runs; schema-only readbacks showed 33 new restrictive policies. Nine isolated
role-policy checks, the RBAC re-run check, and seven photo/draft checks passed.
Live signed-in API/UI tests for all three recruiter roles
and an applicant, including photo/offer-letter behavior, remain open because
the browser/HTTP probe was unavailable. No candidate status or email was
changed for this test.

Follow-up staging smoke on 2026-11-04 found a separate regression from `0211`:
eight older `scheduled_events` and `user_roles` policies still called the
now-revoked `check_permission` helper directly. A Coordinator event read failed
with `permission denied for function check_permission`. Migration `0219`
switches those policies to the self-scoped `has_permission` wrapper without
regranting the old helper. Seven PGlite checks passed. The exact SQL was
applied through the SQL editor and recorded in migration history on both
staging and production. Production readback found zero direct policy calls,
and `anon`/`authenticated` still cannot execute `check_permission`.

Rollback-only staging probes after `0219` passed: Coordinator could read four
applications, four photo objects, and one offer-letter object but updated zero
application/photo/offer rows; Recruiter and simulated Master Recruiter each
updated one application row; an applicant updated their own draft. The
simulated role assignment was rolled back and the original Recruiter role was
confirmed unchanged. Staging has no real Coordinator or Master account, so
signed-in browser/API checks for those roles, plus actual photo download and
offer-letter function behavior, were open at that point. A later signed-in
staging browser smoke used the existing recruiter account and temporary
Coordinator/Master assignments. Recruiter, Coordinator, and Master could
open synthetic application lists and detail; protected photos rendered for
all three. Coordinator saw no status or handled-by controls and no worksheet
action, while Master retained decision and worksheet controls. The
Coordinator Calendar route initially denied access despite read-only event
policies; the route, page, dashboard, and sidebar gates were corrected locally.
The corrected Calendar loaded in staging with no edit actions (there were zero
events, so event visibility itself is not proven). No status, invitation,
worksheet, or email action was triggered. The staging SQL editor confirmed
the account was restored to Recruiter and the last-Master trigger was enabled;
a fresh Calendar navigation also showed Recruiter in the browser. Use
dedicated role accounts for further UI checks. The safe
public-route Playwright subset passed 6/6; the default write-capable smoke
suite was not run.

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
