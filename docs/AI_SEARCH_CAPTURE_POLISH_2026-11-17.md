# AI Search capture and account menu — 2026-11-17

Prepared locally on `codex/holmes-capture-20261117`, based on `d70ee7b`.
Deployed as `dd98a26daf8e751df27ee423d77e7c5cb5f916d9`, after paired Needle `d979b35f719dc71c4fcffe5d03b91e17fe739038`.

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

## Release gates (completed below)

Exact paired release approval, fresh backup/restore
checks, Needle-first promotion, Holmes promotion and read-only live capture/menu
smoke. No schema, Function, intake or paid model calls. Full-reload latency remains
separate and unresolved. This is local verification, not a live completion claim.

## Live closeout — 2026-11-17

Exact paired approval received. Fresh SQLite and both PostgreSQL backups and
isolated data-payload restore/count checks passed before Needle-first promotion.
Full managed-schema/DDL, globals and Storage-byte restoration remain unverified;
SQLite backups remain on the same volume. Production Vercel deployment
`8hgKWDAWgwUXH3DDoMt6MncfekiZ` succeeded for the approved Holmes commit.

Live ordinary Operator and Recruiter sessions pass the account popup, full
identity display, role navigation and matching review-dialog access. Desktop
Escape returns focus to Account; on the narrow Recruiter view, first Escape
closes the popup and second closes the drawer with visible trigger focus.

Compact AI Search, expanded-table modal and native Recruitment-panel screenshot
previews now preserve layout without prior clipping/overlap. All previews were
closed without Send; both matching dialogs were cancelled without adding.
Saved results show recorded availability dates or NA. Follow up/New search
mode checks pass without submitting any prompt or paid model call.

Minor remaining capture-only artifact: some disclosure arrows appear as small
numeric markers in AI Search previews. Full-reload latency remains unresolved.
Private proof files and release details are in the parent Needle repository's
`.local/ui-polish-20261117/`.
