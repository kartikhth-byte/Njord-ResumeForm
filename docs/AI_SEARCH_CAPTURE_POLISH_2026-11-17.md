# AI Search capture and account menu — 2026-11-17

Prepared locally on `codex/holmes-capture-20261117`, based on `d70ee7b`.
Not deployed. Paired Needle changes: `codex/needle-ui-polish-20261117`.

## Corrections

Native modal screenshot clones lose the browser top layer. In the embedded
results table this exposed ancestor clipping and applied its centering transform
again to already transformed geometry. Capture now preserves computed styles,
places modal clones/backdrops at body level, and uses the live bounds without
reapplying transforms. It ignores html2canvas's inserted pseudo-element nodes
when aligning style snapshots. Closed disclosure content is removed from the
capture clone. Private masking runs after styles are restored. Private ancestry is retained
when dialogs move and private frame pixels are never read. Frame replacement
precedes dialog reparenting to retain image order. Source DOM and
private values remain untouched.

The account menu previously lived inside the sidebar's clipped scroll container.
It now renders in a fixed body portal above the account button, with horizontal
viewport bounds, wrapping name/email, outside-click dismissal and Escape focus
restoration. On mobile, the first Escape closes the account popup and the
second closes the drawer, restoring its trigger. Sidebar scrolling remains intact.

## Verification

- 23 problem-report browser checks: submit/retry, private masking, native and
  embedded dialogs, modern colors, text baselines, clipping/transform regression,
  closed disclosure suppression, private content inside modals, private modal ancestors and iframe masking, desktop/mobile
  account menu bounds and focus, Coordinator/applicant/operator paths.
- 10 paired production-build browser checks: Needle integration, normal Recruiter
  navigation, auth/retry, PDF, detail → Match Resume, Follow up/New search/reload,
  mobile, compact/expanded captures. Screenshots visually inspected.
- ESLint and production build pass. Existing chunk-size warnings remain.
- Independent release review found loss of privacy markers on modal ancestors
  and replaced iframes, possible frame reordering, and mobile Escape focusing
  a hidden control. All fixed and re-reviewed with no remaining blockers.
  Reviewer independently verified Chromium pixels for masking and two-frame order.
- All 23 report checks rerun after corrections; lint/build and the actual paired
  production-build capture case rerun successfully. Prior nine adjacent paired
  checks still pass. Needle retains 129 frontend / 44 Python passing checks.
- Needle reviewed revision: `d979b35f719dc71c4fcffe5d03b91e17fe739038`.
  Holmes release must include the review fixes after `8f246f7`; the original
  commit alone is not approved by the review.

## Remaining release work

Exact paired release approval, fresh backup/restore
checks, Needle-first promotion, Holmes promotion and read-only live capture/menu
smoke. No schema, Function, intake or paid model calls. Full-reload latency remains
separate and unresolved. This is local verification, not a live completion claim.
