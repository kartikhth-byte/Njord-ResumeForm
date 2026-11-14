# Shared recruiter directories — 2026-11-14

## Scope and source

Implemented in the Holmes repository from current `origin/main` at `c8857a3`,
on `codex/holmes-shared-lists-20261114`. The NjordHR/Needle repository and its
working tree were not changed. This is a local implementation, not a production
release. The supported product remains the current single-organization Holmes
deployment. Recruiter assignment and takeover continue through the existing
Recruitment workspace; list visibility does not depend on assignment.

## Behavior

- Requirements, Candidates, Recruitment, and Applications use one visible column
  header per table. Rows include a current-view serial number, type-specific ID,
  creation and modification dates where available, and notes. Light separators
  distinguish columns. Empty lists retain their headers.
- Public IDs are server-assigned, immutable labels: `REQ-000001`, `CAN-000001`,
  `CAN-D-000001` for pre-CV drafts, `REC-000001`, and `APP-000001`. Existing UUIDs
  remain the internal keys. The existing requirement reference and application
  form reference remain visible where useful. Requirement selection and matching
  show the new requirement ID; reviewed résumé attachment creates/links a
  candidate through the existing identity review flow and gets a `CAN` ID.
- Requirement and candidate notes use existing audited remarks/note RPCs.
  Application, recruitment-case, and pre-CV draft notes use `directory_notes`
  with subject-specific read/write policies. Coordinator can read but cannot
  add notes. Notes append to history; they do not replace a previous note.
- Company/ship group rows show the names without repeating “Company” or “Ship”.
  Candidate secondary actions are in More. Historical applications lacking a
  verified recruitment link stay in the main table, outlined with short
  hover/focus guidance. Extra introductory and count explanation text is removed.
- Coordinator navigation omits Companies & ships and its direct route is denied.
  AI Search keeps a narrow Holmes icon rail on desktop; the phone menu opens over
  the page. The saved ordinary sidebar width preference is preserved.

## Verification

- SQL migration applied successfully in an isolated PGlite instance using
  `supabase/tests/directory_ids_and_notes.sql`: existing/new IDs, immutability,
  recruiter and Coordinator note visibility, and Coordinator insert denial.
- Synthetic browser suites: AI sidebar, fleet/Requirements, Candidates,
  Recruitment, and Applications, including application note save/reopen and
  Coordinator read-only access. External requests were intercepted.
- Node directory/KPI/workspace tests, lint, and production build passed locally.

## Release order

1. Review and apply `supabase/migrations/2026111401_directory_ids_and_notes.sql`
   to the Holmes database. It backfills IDs and creates the note table/policies.
2. Deploy the matching frontend commit. The new selects and list RPC expect the
   migration; deploying the frontend first would break these lists.
3. Verify representative old and new records, cross-role visibility, note
   permissions, Coordinator navigation, AI Search navigation and one takeover in
   the normal release smoke. Do not treat local synthetic checks as live DB proof.
