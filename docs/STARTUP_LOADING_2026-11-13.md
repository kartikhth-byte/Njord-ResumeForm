# Holmes startup loading — 2026-11-13

Status: deployed as `9386991f879344b97d011d4ef71cb49a50c3de30`; read-only live smoke passed.
Base: `7fbf931` (application baseline `c6499bd2`). Isolated branch:
`codex/holmes-startup-20261113`.

## Diagnosis

The live entry JavaScript is 1,546,813 bytes uncompressed, approximately 436 KB
transferred in the public HTTP check. App.jsx imports all route screens eagerly,
including form/review/export functionality unrelated to the page being opened.

An authenticated Chrome reload of Companies & ships, with DevTools cache disabled,
observed DOMContentLoaded at 724 ms and load at 749 ms. Network completion was
2.68 seconds. The profile read took 828 ms, roles 345 ms, permissions 286 ms and
operator check 286 ms, running sequentially. Page directory reads also occurred;
this is a single browser observation, not a percentile or universal SLA.

The delay is partly unnecessary frontend/authorization sequencing. This evidence
does not require a database tier, region, provider or hosting change.

## Change

- React lazy/Suspense loads the requested screen and its dependencies. Router,
  auth provider and route guards remain eager; auth state survives navigation.
  Existing ErrorBoundary offers refresh if a route chunk fails to load.
- Returning recruiters with a matching-user cache start role/permission and
  operator reads alongside profile. Role permissions still depend on fresh role
  IDs. The operator check runs independently of the role/permission chain.
- The cache hint changes scheduling only. Current profile, roles and permissions
  still replace cached values under the existing session-key guard. First-time
  users resolve profile type before recruiter queries; applicant intent and known
  applicant profiles retain their existing path.
- Speculative errors resolve into a result, preventing unhandled rejections if
  profile loading fails, the user signs out, or the current identity is an applicant.
- Existing timeout/cache fallback policy, SQL/RLS queries, auth lock workaround,
  API parameters and server authorization are unchanged. No migration, Function,
  Needle, intake, provider, hosting or subscription change.

## Measurements

Production build with identical synthetic configuration, using the same local
test runner and adding 300 ms to each auth API response:

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Entry JS, uncompressed | ~1.55 MB | 420.49 KB |
| Requested JS on Companies page, uncompressed | 1,546,296 B | 447,014 B |
| Auth request span | 1,233 ms | 617 ms |
| Navigation to fresh authority and enabled Add company | 2,198 ms | 1,072 ms |

Earlier candidate measurements were 1,008–1,111 ms. These small controlled samples
demonstrate the reduced dependency chain; they are not production benchmarks.
Repeat normal-session live measurements after exact release approval.

## Verification

- Five Node tests: request overlap/dependencies, live role IDs, permission
  deduplication, missing roles, role/permission failure, operator revocation and
  preserved transient-error fallback.
- 54 distinct browser checks pass on the built candidate: seven startup checks,
  ten fleet/requirement/attachment checks, seven AI sidebar checks, six application
  invitation checks, ten application review checks and 14 public/callback checks.
- Two normal-session application-view tests skip because this isolated fixture
  checkout has no applicant storage state or recruiter credentials. Equivalent
  synthetic review/navigation coverage passes; this does not claim a fresh live
  applicant sign-in or submission.
- Initial startup test expected text "Loading..." rather than the existing
  operator spinner's accessible name "Loading". Corrected the assertion; all
  seven startup cases pass. This was a test selector error, not an auth bypass.
- Lint, production build and diff checks pass. Existing Browserslist age notice
  remains. The previous entry chunk size warning is removed by route splitting.
- Independent review found no actionable introduced issues; reviewer separately
  reran five Node tests and diff checks. Public callback tests subsequently passed.
- No paid model calls or production writes were used for this work.

Private network screenshots and test artifacts are in the ignored NjordHR
`.local/holmes-startup-20261113/` directory. UI screenshots use synthetic fixtures.

## Release

Commit explicit files, obtain exact production approval, promote to Holmes
main/Vercel and perform read-only normal-session smoke: reload, navigation,
permissions and AI shell entry. Compare authenticated startup again and record
the result. Roll back to the prior frontend commit if needed; no data rollback
is required because this release changes no database or persisted record format.

## Production closeout

The owner approved the exact release. Commit `9386991f879344b97d011d4ef71cb49a50c3de30`
was fast-forwarded to Holmes main. Vercel deployment
`5tJZmA1wYNrHynjQ2NLKou4wMZB6` reports Ready / Production for that commit.
The public crewme.si page now references `index-CLLsEWxM.js`, measured at
420,704 bytes uncompressed (72.8% smaller than the prior production entry).

Normal authenticated Chrome smoke passed Companies & ships, Requirements,
Candidates, Recruitment, Applications, AI Search with its loaded embedded project
list, the Holmes overlay menu, and the authorized Operator route. Returning to
Companies & ships and reloading retained the session and expected controls.
No records, tasks, permissions or settings were changed. No paid model calls.
Fresh applicant sign-in and a separate live Coordinator session were not repeated;
the pre-release synthetic role/callback coverage is recorded above.

With the same cache-disabled, unthrottled Chrome settings, two post-deploy reloads
reported:

| Measurement | Before | After, first | After, second |
| --- | ---: | ---: | ---: |
| DOMContentLoaded | 724 ms | 1,770 ms | 447 ms |
| Load event | 749 ms | 1,790 ms | 461 ms |
| Network finish | 2,680 ms | 3,880 ms | 2,270 ms |

The second observation's profile and roles each took 869 ms, with permission
requests of 340 ms and 31 ms; independent authorization work now overlaps. Network
completion includes page data and is not a direct measure of usable-page timing.
The first live observation was slower, so these small samples do not establish a
production percentile improvement. The bundle reduction is verified; the controlled
startup improvement remains the stronger comparison. Database/network latency
continues to contribute to live variation. Private network evidence remains in
`.local/holmes-startup-20261113/` in the Needle workspace.
