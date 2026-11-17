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
capture clone. Private masking runs after styles are restored. Source DOM and
private values remain untouched.

The account menu previously lived inside the sidebar's clipped scroll container.
It now renders in a fixed body portal above the account button, with horizontal
viewport bounds, wrapping name/email, outside-click dismissal and Escape focus
restoration. Sidebar scrolling remains intact.

## Verification

- 21 problem-report browser checks: submit/retry, private masking, native and
  embedded dialogs, modern colors, text baselines, clipping/transform regression,
  closed disclosure suppression, private content inside modals, desktop/mobile
  account menu bounds and focus, Coordinator/applicant/operator paths.
- 10 paired production-build browser checks: Needle integration, normal Recruiter
  navigation, auth/retry, PDF, detail → Match Resume, Follow up/New search/reload,
  mobile, compact/expanded captures. Screenshots visually inspected.
- ESLint and production build pass. Existing chunk-size warnings remain.
- Final diff self-reviewed; no independent promotion review yet.

## Remaining release work

Independent promotion review, exact paired release approval, fresh backup/restore
checks, Needle-first promotion, Holmes promotion and read-only live capture/menu
smoke. No schema, Function, intake or paid model calls. Full-reload latency remains
separate and unresolved. This is local verification, not a live completion claim.
