# Candidates directory — 2026-11-11

## Status

Reviewed implementation based on Holmes `0d278e0` (production app `b573bd8f`).
Migration `2026111101` is applied to staging only. No
production schema, service, data, credentials or intake settings changed.

## Behavior

Inline Add/Edit; name and email or international phone. Optional CV uses the
existing intake workflow when enabled. CV-less people are visible as Unattached
with CV missing; no case can be created until a résumé is linked and available.
Attached uses Company → Ship → Candidates. Multiple requirements on a ship share
one candidate row with separate requirement/stage links. Across ships, links
open the same profile. Active/history and URL filters preserve navigation.
CSV includes each matching requirement and stage instead of only the primary.

## Verification

- Lint and production build pass (existing Browserslist/chunk warnings).
- 40 focused and adjacent Node tests pass.
- 25 synthetic Chromium tests pass across Candidates, fleet and KPI flows.
- Desktop/mobile visual checks; follow-up layout checks cover the mobile search field.
- Isolated PGlite migration chain passes, including actual case/junction guards,
  stale draft edits, note preservation, organization scope and Coordinator/anon denial.
- Independent release review found three compatibility issues, now fixed and
  re-reviewed: contextual All candidates for legacy KPI links, archived-profile
  exclusion from In process, and private-note preservation when adding a CV to
  an existing draft. The default directory still has two tabs.
- No paid model calls. Only explicitly labelled synthetic staging records changed.

## Release gates and limitations

Normal staging Master and Coordinator sessions passed after applying the additive
migration: basic create/edit/reload, CV-missing attachment denial, existing reviewed
CV attachment, two requirements in one candidate row, duplicate exclusion, profile
Back and Coordinator read-only controls. The synthetic PDF opened and both pages
were readable in Chrome. A newly created synthetic requirement (`2026-Nov-007`)
was closed after attachment; candidate and case history were retained.

Staging used real Holmes authentication/database/handlers with the existing local
synthetic Needle facts/PDF bridge. This does not certify production Drive access.
The previous production source release is unchanged; deployed smoke remains a gate.

Fresh production backup `20261111T111230Z` completed: 108 data objects / 7,615 rows;
scratch payload restore verified. Extension-compatible public DDL/data/CHECK restore
passed: 65 tables / 688 rows, exact snapshot counts. Managed-schema reconstruction,
post-data/cluster globals and Storage file bytes are outside this restore claim.
Private receipts and synthetic screenshots remain under ignored `.local/` paths.

Pending: exact production approval for this frontend commit and migration
`2026111101_candidate_directory.sql`, then main/Vercel promotion and live smoke.
No Needle or Edge Function change is required. New intake remains off, so optional
CV upload remains unavailable. Existing reviewed source attachment is supported.

Rollback frontend to the prior candidate keeps existing profiles/cases and draft
records intact; the additive functions/guards remain safe. Removing the new CV
guards is a separate reviewed database change, not an automatic rollback.
