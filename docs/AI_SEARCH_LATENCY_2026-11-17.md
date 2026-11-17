# AI Search sign-in latency — 2026-11-17

Status: prepared locally; not deployed. No live improvement is claimed.

## Evidence

A normal-cache Chrome reload spent 3,819 ms obtaining the Needle token:
approximately 1,180 ms OPTIONS plus 2,640 ms POST. Network finish was about
4,670 ms. A prior cache-disabled sample must not be treated as a normal reload.
These are individual network observations, not interactive-paint percentiles.
Needle's paired `docs/AI_SEARCH_LATENCY_2026-11-17.md` records the search trace:
12,916 ms preview-to-stream completion, including about 6,940 ms of sequential
résumé evidence checks. The prompt was `master with container experience`.

## Change

- Extract the existing handler into an injected, directly executable module.
  `index.ts` still wires the same origin/auth/access/audit/signing dependencies.
- Overlap independent origin and validated-auth reads. Access queries follow
  successful auth; required Operator audit still succeeds before signing.
- Cache an allowed OPTIONS preflight in the browser for 300 seconds. Every POST
  still reads current allowed origins and validates identity and permissions.
  No token, user or role cache is introduced. Denied origins get no max-age.
- Emit numeric Server-Timing phases: cors, auth, access, audit (when required),
  sign and total. They contain no identity, token, source or model data.
- Token expiry stays 120 seconds and token responses remain no-store.

The source establishes a serial origin lookup before auth; it does not establish
how much of POST latency comes from each operation or network/region overhead.
The new diagnostics must be read after deployment before claiming that the
remaining delay is solved. Preflight caching helps repeat visits only.

## Verification

- 32 Node checks pass: actual handler, role matrix, audited Operator failure,
  unauthenticated/invalid requests, auth/CORS/signing failures, request overlap,
  no permission cache, real CORS runtime-origin changes, connection and proxy.
- Lint and production build pass. Deno is unavailable locally; the actual handler
  runs in Node with injected platform dependencies. Hosted Function execution is
  still a release check.
- Existing synthetic browser suite: all eight AI rail/role tests and four
  recruiter startup tests passed. Three broader startup expectations fail on
  unchanged frontend source: applicant routes expect `/dashboard` but now render
  No access, and the old requirement-card expectation no longer matches the list.
  The first run used a development server; the three failures were repeated on
  a correctly configured synthetic production build. These are recorded as suite
  limitations, not passing tests. No frontend source or browser tests were edited.
- Self-review only; no independent agent review was performed.

## Release and remaining work

Exact production approval is required for this Holmes commit and its
`needle-token` Function, keeping current authentication settings. No schema,
secrets, intake or subscription change. Main/Vercel promotion alone cannot apply
this server fix. Paired Needle promotion has its separate reserved release gate.

After deployment: verify normal Recruiter, Master and Operator sign-in, denied
Coordinator/applicant access, repeated ordinary reload timing, allowed/denied
preflights and Server-Timing. Preserve existing sessions and do not bypass audits.
The US$0.25 live search allowance is fully reserved until actual provider cost is
reconciled; no further paid call is included in read-only release smoke. A new
uncached evidence timing is needed before declaring search latency improved.
