# AI Search compact workspace and existing-résumé matching — 2026-11-16

## Status

Prepared locally and independently reviewed; not deployed. Baselines are the
released Needle `6ad3ab3a` / Holmes `eb3edf6` pair, plus their documentation-only
closeout commits. Branches: `codex/needle-search-polish-20261116` and
`codex/holmes-search-polish-20261116`.

## Owner-approved scope

- Keep the Holmes icon rail and persistent desktop Projects & chats.
- Put AI Search, Résumé library and Operator-only Résumé Review above the tree.
  Remove the two full-width header rows and duplicated project/chat breadcrumb;
  the conversation header shows the chat title once. Narrow screens retain the
  keyboard-accessible navigation drawer.
- Put Show results, Follow up, New search and Copy outline icons beneath search
  responses; answers without a table omit Show results. Tooltips work on hover
  and focus. Copy includes visible search qualification warnings and reports
  clipboard failure. New search clears context/filters and focuses the composer
  in the same chat; history remains. Reset/follow-up are disabled while busy.
- Show the searchable-résumé count beside library navigation; the accessible
  expandable notice and tooltip expose excluded-document/staleness warnings.
  Do not guess whether excluded documents are processing or awaiting review.
- Existing résumé matching is independent of upload/automatic intake. Rename
  user-facing Add to Holmes controls to Match Resume / Match Resumes. The
  library sends the selected original version; search sends exact source IDs
  and selected stage. The internal message name remains backward-compatible.
- Holmes supplies a distinct `match=enabled` capability only when AI Search is
  allowed and both create_prospects/edit_junction_status permissions are present.
  Parent checks the exact origin/frame and permissions again. Server prepare
  and review_existing routes retain source verification, actor/org evidence,
  duplicate choices, expiry and requirement-version checks. No API guard is
  bypassed. New uploads remain separately held.
- Matching requires a requirement and explicit original/identity review before
  Add to requirement. Existing candidate profiles are reused where appropriate.
  Requirement-based Match Resume retains its existing list, evidence/PDF review,
  empty results, duplicate checks and attachment semantics. This slice does not
  change mandatory rank/vessel matching or make all other criteria mandatory.

## Full reload investigation

The first attempt (lazy attachment form plus route prefetch) had no meaningful
measured cold-load improvement. The waterfall still showed a route-module and
Suspense wait before SSO/frame mount. Final code keeps the small AI Search shell
in the entry bundle, while the candidate attachment form and dependencies load
only when matching is opened. The entry bundle increases by roughly 5KB gzip;
protected data still waits for authentication, and no auth result is cached.
Unused shell project/chat subscriptions also disappear with the breadcrumb.

Five paired runs, alternating order, isolated browser contexts, production builds,
gzip, disabled browser cache, 120ms latency and 5Mbps download. Synthetic Supabase
responses and the same local signed Needle fixture; no model calls. Appearance
is recorded on an animation frame, not by locator polling. Local HTTP behaviour,
synthetic auth latency and fixture size are not production geography/provider
performance. These are preparation measurements, not a promised live timing.

| Cold reload milestone | Previous release | Candidate |
| --- | ---: | ---: |
| Projects screen appears | 1.325s | 1.042s |
| Project data visible | 1.486s | 1.207s |
| Saved-chat composer visible | 1.388s | 1.172s |
| Saved result narration and Show results available | 2.634s | 1.590s |

Raw scripts/results and screenshots: ignored parent workspace
`.local/search-polish-20261116/`. This is frontend startup work; database
capacity, region, hosting subscriptions and model/parser execution are unchanged.

## Verification

- Needle hosted build and 117 frontend checks across 23 files pass.
- Holmes lint/build and 13 Node checks (bridge, connection, access, matching,
  intake) pass.
- 34 synthetic browser cases pass, including grouped requirements and reviewed
  attachment. The 17 affected AI workspace/sidebar cases were rerun successfully
  on the final code: original PDF, library/search matching with intake off,
  required requirement/review, copy/focus tooltips, reset/reload, mobile drawer,
  delayed/failed SSO, stale cookies, bounded recovery and role visibility.
- Final independent source review: no material findings. Its minor busy-reset
  observation was fixed and regression-tested. Synthetic screenshots inspected.
- Shared dependency symlink requires a local-only Vite fs.allow test config for
  the PDF-worker import; excluded from commit. First test attempt hit this
  tooling constraint, then the full suite passed with that config.
- No paid model calls, production data changes, emails or intake activation.

## Release and rollback

Requires exact paired production approval and fresh recoverable backups under
existing release policy. Needle first, Holmes second. An old parent lacks the
new matching capability, so matching stays disabled until the pair is deployed.
Rollback Holmes first, then Needle. No database migration or Function deployment.
Live smoke must check normal Recruiter/Operator opening, responsive navigation,
existing résumé review/attachment using only synthetic test records, unchanged
intake hold and live reload timings. Do not call local smoke production smoke.
