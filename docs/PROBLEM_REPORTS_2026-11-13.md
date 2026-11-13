# Two-click problem reports — 2026-11-13

Status: approved base release `cada470324a69e3dd905eea2e8cfbb3a0caded49` deployed; backend and ordinary-page smoke passed. Capture follow-up `8cbb286fe6e27665a2bab624d6026412e8789a5f` is also deployed. Both live visual checks completed: AI Search and the native Recruitment panel now appear in capture. Some preview text remains clipped; overall capture fidelity is not fully passed.

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

## Production release and capture follow-up

The approved release is on Holmes main/Vercel and crewme.si. Migrations 1301/1302
are applied; cleanup Function version 1 is active with its dedicated secret;
`problem-screenshot-retention` is enabled every 15 minutes. No Needle, intake,
hosting-plan or subscription changes were made.

Fresh backup receipt `20261113T075446Z` covers 111 table payloads / 7,790 rows.
Payload restore checks passed. The compatible public-schema restore verified
68 tables / 784 rows; the full managed schema/post-data restore was not certified.
Storage bytes are outside this database backup.

Live verification:

- Normal authenticated capture → Send without a description → My reports →
  authenticated image viewing passed on Companies & ships.
- Operator review and Resolved status survived reload. Both synthetic reports are
  resolved; report #1 is expired, report #2 retains the ordinary seven-day expiry.
- Managed private Storage upload/finalize/download passed. Anonymous download,
  cross-user report reads and expired-object policy access were denied.
- Only the synthetic retention fixture was aged. The deployed cleanup Function
  removed its Storage bytes and preserved report metadata. Wrong secret returned
  401; the authorized invocation returned 200.
- The exact production cron command was exercised through a temporary one-minute
  schedule: cron succeeded and pg_net recorded HTTP 200 at 08:04 UTC. That smoke
  schedule was removed; the regular 15-minute schedule remains enabled.
- AI Search capture fell back to upload; an actual Recruitment panel was omitted
  from its image. The deployed follow-up restores both surfaces, verified in live
  Chrome previews on 2026-11-13. Some text clipping remains in the captured images.

Root causes and local corrections:

1. Needle's Tailwind 4 stylesheet uses CSS Color 4 values such as `oklch`, which
   html2canvas 1.x cannot parse. The iframe exception was converted to generic
   upload guidance. The correction resolves modern colors through the browser's
   canvas into sRGB, including the separate background option, in disposable
   capture clones; live page styles and authentication remain unchanged.
2. Native `showModal()` uses the browser top layer. DOM cloning loses that layer,
   so ordinary app stacking contexts covered the real Recruitment panel. The
   correction restores modal geometry and stacking in the clone, excluding the
   report dialog before mapping source/clone dialogs.
3. Earlier fixture coverage used an RGB-only frame and a plain dialog; the actual
   Recruitment test verified controls/focus without asserting its screenshot
   pixels. The new regressions compare actual panel pixels and modern-color frame
   pixels (including nested color-mix, gradients and text stroke), after image
   decoding. This closes the gap between a visible preview and correct content.

The capture correction is frontend-only. Independent follow-up review found no
remaining blockers. All 14 focused production-build browser checks, lint and build pass. The user
approved exact follow-up `8cbb286`, which was promoted to main/Vercel deployment
`4LFpsbebFRPmGqdhp5aQFKsAtn61`. Vercel succeeded; crewme.si returns HTTP 200
and serves that exact version plus the corrected capture module. Browser control
initially remained unavailable after reset and a fresh user reply. It recovered
on the subsequent turn, allowing the two authenticated visual checks to complete.
AI Search's real embedded Projects page now renders in the screenshot, and the
real synthetic Recruitment case panel is included with its CV/profile/application
actions and task area. Both previews were cancelled without uploading; the panel
was closed and recruitment data was unchanged. No paid model calls were made.
Private visual evidence is saved under `.local/problem-report-release-20261113/`
as `live-ai-capture-fixed.png` and `live-recruitment-capture-fixed.png` in the
Needle workspace. These images also reveal clipped text in some labels: the
original missing-surface defects are resolved, but text fidelity needs a further
correction and is not reported as passed.

Account investigation during the recheck: the deployed frontend still sets
`VITE_FEATURE_AI_SEARCH=operator`, explaining why a Master Recruiter sees no AI
Search entry. `canUseAiSearch` only enables normal Master Recruiter/Recruiter
access in `on` mode; the server has a corresponding access gate. The observed
`kartik.neuralnet@gmail.com` session still opens the Operator console. Its footer
prints the independent recruiter `role` without considering `isOperator`, hence
the misleading Recruiter label. No role assignments or rollout flags were changed.

## Release procedure

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
