# Two-click problem reports — 2026-11-13

Status: implemented locally; production release and managed Storage/cron smoke pending.

## User flow

Authenticated recruiters, Coordinators and applicants can click the translucent,
movable **＋** to capture the visible app, then **Send**. Description is optional.
There is no category or extra confirmation. Drag position persists per user;
keyboard arrow keys also move the button. The preview can be cancelled without
uploading anything. Reporting remains available inside native app dialogs.

The preview contains an optional upload fallback and **My reports**. Support uses
**Operator → Reported problems** to view screenshots and change New / In progress /
Resolved status. Reporter identity comes from the authenticated session; status
changes retain their operator/time history. Lists show the latest 100 submitted
reports. No notifications or third-party issue service are added.

## Capture and privacy

- `html2canvas` loads only after the first capture; operator/history UI is lazy.
- Captures the visible app viewport, including accessible same-origin AI Search
  HTML frames. Browser chrome, other tabs, native PDF viewers and inaccessible
  frames are not captured. The preview explains unsupported embedded content and
  offers upload. DOM rendering is an approximation; it is not an OS screenshot.
- Masks password inputs and explicit `data-report-private` regions. Ordinary
  candidate details visible on screen remain in the preview; they are not blanket
  redacted. Report controls themselves are excluded.
- Only PNG bytes under 5 MB are stored. JPEG/WebP uploads are re-rendered to PNG,
  which removes file metadata. Query strings, hashes and record IDs are excluded
  from page metadata. No cookies, auth headers, console logs or résumé files are
  collected. App version and timestamps accompany the report.
- Storage bucket `problem-screenshots` is private. Access requires authenticated
  download and database policies: reporter or platform operator only. Client
  update/delete is denied, including in the presence of broad older policies.
- Anonymous/login/callback/reset/setup pages have no report launcher in this slice.

## Persistence and retries

Migration `2026111301_problem_reports.sql` adds report/status-history tables,
reservation/finalization/status RPCs and private bucket policies. Reservation locks
per reporter, allows 30 new reports per day and reserves one immutable UUID path.
No report is listed until upload and server-side finalization succeed. Retrying a
lost upload/finalization response reuses the reservation; finalization checks the
reserved object's MIME type and size. Replacing an image uses a new reservation.
Send is blocked while a replacement image decodes. Failed/cancelled reservations
are cleaned after one hour.

## Seven-day retention

Access expires seven days after reservation, even if the cleanup worker is down.
Report text, page/version and status history remain. Physical deletion runs every
15 minutes, up to 100 eligible objects per invocation; failures or a backlog can
delay physical deletion. The cleanup handler removes bytes via the Storage API
before marking deletion, and retries failed objects. Already downloaded browser
copies cannot be revoked. Database backups may retain report metadata according
to the existing backup policy; this feature does not add screenshot backups.

`cleanup-problem-screenshots` accepts POST with a dedicated random 32+ character
Bearer secret. Its JWT gateway is off because cron is not a user session; the
handler checks that dedicated secret. It does not accept the service key as the
public caller credential. Service-role use is internal to the handler.

Migration `2026111302_problem_report_retention.sql` requires existing pg_cron,
pg_net and Vault, plus the exact cleanup URL and token. It schedules a named job.
The SQL contains no credentials. Monitor both cron job execution and the HTTP
response in pg_net: a successful enqueue alone does not prove deletion succeeded.

## Verification

Final local run: **37/37 browser checks**, **5/5 cleanup-handler tests**, the SQL
policy suite, lint and production build pass. Independently reviewed with no
remaining actionable findings. Screenshot preview was visually inspected. The
capture library is absent from initial page requests. No paid API calls were used.


- Synthetic production-build browser checks cover two-click submission, optional
  text, actual capture pixels, same-origin frame rendering, private masking,
  unsupported PDF guidance, provider-400 upload retry, delayed replacement decode,
  native-dialog capture/focus, drag/reload, keyboard/mobile, roles and review.
- Adjacent startup and AI sidebar browser checks verify lazy loading/navigation.
- `node --test tests/problemReportCleanup.test.mjs`: five handler/retention checks.
- `supabase/tests/problem_reports.test.mjs` applies the actual schema migration
  twice in PGlite and tests authentication, owner isolation, operator rights,
  storage immutability, expiry, retries and rate limits. Run with the migrations
  directory as argv[2]. This uses synthetic auth/storage schemas, not managed
  Supabase Storage, Vault, cron or the deployed gateway.
- Lint and build are release gates. No paid model calls or real emails are needed.

## Release order / remaining gates

1. Independent review, final commit and exact production approval. Back up and
   restore-check the target database under the existing release procedure.
2. Verify extensions on the authorized target. Apply migration 1301. Verify the
   private bucket and policies without changing unrelated Storage policies.
3. Create a dedicated cleanup token privately. Configure it in the Function as
   `PROBLEM_SCREENSHOT_CLEANUP_TOKEN`; deploy `cleanup-problem-screenshots` with
   `verify_jwt=false` from this commit. Reject absent/wrong credentials in smoke.
4. Set Vault names `problem_screenshot_cleanup_token` and
   `problem_screenshot_cleanup_url` for that same project's Function. Apply 1302;
   verify the job exists exactly once and executes successfully.
5. Test a synthetic upload → finalize → reload → own/operator view, cross-user and
   anonymous denial, status update and expiry. Age only the synthetic fixture,
   invoke cleanup, verify Storage bytes disappear and report metadata remains.
   Confirm a scheduled invocation succeeds; do not count a local mock as proof.
6. Promote the approved UI to main/Vercel after backend readiness. Smoke ordinary
   pages, real embedded AI Search, an open requirement-match dialog, mobile layout
   and operator review with normal sessions. No résumé intake activation.

Rollback the UI to the prior approved commit if needed. Keep retention running
for existing screenshots; do not drop report tables/bucket or disable cleanup
while retained screenshots remain. No destructive schema rollback is planned.

Implementation references: [html2canvas limitations](https://html2canvas.hertzen.com/faq),
[Storage deletion API](https://supabase.com/docs/guides/storage/management/delete-objects).
