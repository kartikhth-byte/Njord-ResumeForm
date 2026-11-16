# AI Search workspace and startup — 2026-11-16

## Status and scope

Deployed and smoke-verified; see the production release record below. Needle baseline `166fcd05`, Holmes baseline
`900ccdc`. Isolated branches `codex/needle-ai-workspace-20261116` and
`codex/holmes-ai-workspace-20261116`. This slice extends the existing embedded
workspace; it preserves the parser, search engine, stored conversations and
original-PDF access. No model calls, schema, Functions, subscriptions or intake
activation are included.

## UI

- Holmes icon rail remains visible; the embedded screen inherits its theme.
- AI Search, Résumé library and operator-only Résumé Review share a header.
- Projects & chats stays visible at desktop widths of 1024px and above. Narrow
  screens use an accessible drawer with Escape and focus restoration.
- Conversation fills the available pane until the user chooses Show results.
  Existing result cards/table/split views, PDF access and resizing remain.
- Back to conversation and Follow up preserve the mounted composer/draft.
- New search resets context in the same chat through the existing reset handler;
  the header action is disabled while a search is running.
- Existing standalone Needle navigation remains available.

## Startup causes and changes

Previously, Holmes awaited the token exchange, a parent cookie check, then the
iframe downloaded all page modules and repeated the cookie check. The initial
UI patch alone improved the controlled cold measurement from 1.72s to 1.58s,
which the owner considered insufficient.

The final approach splits page modules, preloads only the requested screen,
removes the redundant parent cookie check, and downloads the static frame in
parallel with SSO. `session=wait` holds the iframe's auth query and all protected
mounts until a same-origin, exact-parent `holmes:signed-in` message arrives.
`needle:booted` and a bounded connection ID make early/late delivery replayable
without repeating authorization. Nothing uses an old cookie before release.

Cookie exchanges are serialized; only simultaneous requests for the same
identity coalesce. Later visits still authorize again. Sign-out is ordered
behind an outstanding exchange. Token/exchange work has a shared 15-second
limit; sign-out has a five-second limit. User/role changes recreate the frame.

Recovery is owned by one auth query. An earlier independent check in the login
placeholder could turn a repeated boot signal into a false unavailable state;
that duplicate check was removed. Concurrent unauthorized events share an
in-flight parent recovery. A further failed cookie check after recovery still
hits the existing 30-second bound and exposes Retry. Navigation during renewal
is checked against the originating frame and current identity, not a stale URL.

## Controlled timing (not production)

Five paired runs, alternating before/after, production builds served locally
with gzip, isolated Chromium contexts, cache disabled, 120ms latency and 5Mbps
download. Synthetic Supabase and local signed Needle fixture; no model calls.
Screen appearance is recorded by a DOM observer on the first animation frame
with the Projects heading, rather than locator polling. Project-data appearance
is recorded separately. These figures do not model live edge-function/database
latency, Railway load, or geography.

| Entry / milestone | Before | After |
| --- | ---: | ---: |
| Cold direct opening: first screen | 1.678s | 1.278s |
| AI Search click from loaded Dashboard: first screen | 1.244s | 0.828s |
| Same click: project data visible | 1.400s | 0.974s |

Initial Needle entry JS: approximately 628KB to 297KB (gzip 177KB to 93KB).
One `/auth/me` on normal startup, down from two. The click benchmark has cold
Needle assets even though Holmes is already open. Raw benchmark scripts/results
and synthetic screenshots are kept in ignored `.local/ai-workspace-20261116/`
in the parent workspace. Live measurements are recorded below.

## Verification

- Needle: 113 frontend tests across 22 files and hosted production build pass.
- Adjacent backend auth/embed/facts tests: 42 pass in the existing integration
  virtual environment. The synthetic fixture now writes the published facts
  snapshot, matching the current hosted authority instead of legacy repo rows.
- Holmes: eight connection/access Node tests, lint and production build pass.
- Eight integrated local browser cases pass: persistent rail/projects, theme,
  library/PDF, explicit results/draft/follow-up/reset/reload, mobile drawer,
  cookie recovery and retry, navigation during renewal, delayed SSO with an old
  admin cookie and zero protected requests, failed SSO, and dropped-cookie
  recovery with duplicate boot/late unauthorized events. Some cases cover
  multiple behaviors. Eight adjacent sidebar/role browser checks also pass.
- Independent review identified the navigation/recovery and duplicate-check
  edges; both have focused regressions. Final independent review found no
  remaining material issues, including the concurrent-401 recovery guard.
- The dependency symlink requires a temporary Vite `server.fs.allow` for local
  PDF component tests; that machine-specific config is not part of the release.

## Exact release sequence and remaining gates

1. Freeze/review the commit pair and obtain exact owner promotion approval.
2. Take fresh recoverable backups and verify current deployed baselines.
3. Deploy Needle FIRST to the existing Railway engine/worker. Confirm its
   `session=wait` gate. Old Holmes remains compatible with new Needle.
4. Promote Holmes main/Vercel second. New Holmes must not run against old Needle:
   old Needle ignores the wait parameter and would query the old cookie early.
5. Normal-session live smoke: Operator and Recruiter open/reload; project/chat
   persistence; Show results/Follow up/New search; library/PDF; mobile navigation;
   operator-only review; Coordinator denial. Check real opening/click timings.
6. If rollback is needed, roll Holmes back FIRST, then Needle. No migrations.

The preparation evidence above is local; the production evidence is recorded
below. Intake stays off. No paid parser rerun is required for this UI and
bootstrap slice; a fresh paid prompt would need its own allowance.

## Production release verification — 2026-11-16

Exact approved Needle `6ad3ab3acd5767e347b55c5579e8b592b4977933` deployed FIRST
(engine `c9bad7ef-6717-411f-8d4f-1993213736d9`, worker
`1a1b41f2-859d-4663-b25c-9e2abfb9e380`); both active. Engine health and
cache hydration passed. Holmes `eb3edf696debafde4841a075502938d7a0faad94`
then deployed to crewme.si (Vercel `92R3DAA4grmMz48AHHNtwBo6xXii`, Ready).

Fresh database backups passed isolated COPY-payload restoration and count
checks: Needle 72 tables/12,422 rows, Holmes 114 tables/8,257 rows. Full
managed-schema DDL and Storage-file restoration were not verified. Six SQLite
databases also passed online backup, archive extraction, integrity, foreign-key
and row-count checks on the existing persistent volume. The initial local
restore checker used a removed PGlite API; its isolated replacement restored
the same dumps successfully using COPY FROM /dev/blob.

Live checks passed: Operator opening and saved projects; normal Recruiter
opening, own project scope, reload, filter-only search (237 matches), explicit
Show results, Follow up selection, unsent draft preservation, New search reset,
synthetic library/PDF rendering, direct review denial for Recruiter, and narrow
projects drawer with Escape/focus return. No paid model calls. Coordinator and
Master role checks were covered locally and were not repeated live this release.
Operator review publication was not repeated for this UI/bootstrap change.

Live timing (normal browser cache/network; small sample, not a controlled SLA):

| Milestone | Before | After |
| --- | ---: | ---: |
| SSO start to first projects response | 2.769s (one Operator sample) | 0.730s Operator; 0.619s Recruiter sidebar; 0.394s Recruiter reload |
| Full page reload to first projects response | Not captured | 2.045s (one Recruiter sample) |
| Normal parent/frame auth checks | 1 + 1 | 0 + 1 |

The before SSO request itself took 1.174s versus 0.125–0.206s after; network and
server variation therefore contribute to the difference. Do not present these
figures as a controlled percentage improvement or a sub-second full app load.
The remaining full-reload delay includes Holmes startup before the AI exchange.
Private backup receipts, live timing notes and screenshots are in the parent
workspace `.local/ai-workspace-20261116/`. No schema, Function, hosting plan,
subscription or intake changes were made.
