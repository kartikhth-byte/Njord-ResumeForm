# Candidates directory — 2026-11-11

## Status

Released Holmes `1a8f6caf24143f3ba84dddcf7fccb660e305c45c` to main/Vercel
after exact user approval. Migration `2026111101` applied to staging and production.
Needle, Functions, credentials, hosting and intake settings were unchanged.

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
Production smoke below separately verified the deployed handlers and Drive original.

Fresh production backup `20261111T111230Z` completed: 108 data objects / 7,615 rows;
scratch payload restore verified. Extension-compatible public DDL/data/CHECK restore
passed: 65 tables / 688 rows, exact snapshot counts. Managed-schema reconstruction,
post-data/cluster globals and Storage file bytes are outside this restore claim.
Private receipts and synthetic screenshots remain under ignored `.local/` paths.

Production approval, migration, main/Vercel promotion and live smoke are complete.
No Needle or Edge Function change is required. New intake remains off, so optional
CV upload remains unavailable. Existing reviewed source attachment is supported.

Rollback frontend to the prior candidate keeps existing profiles/cases and draft
records intact; the additive functions/guards remain safe. Removing the new CV
guards is a separate reviewed database change, not an automatic rollback.

## Production smoke — completed 2026-11-11

- Vercel production deployment `AxCPpxiAqMGi714BQVMFZFoGpihp` reports success for
  exact approved `1a8f6ca`; migration applied with candidate/case counts unchanged.
- Normal operator session created a labelled synthetic CV-less draft, corrected
  its name inline, and verified version 2 after reload. Attach stayed disabled.
- Normal Coordinator session saw the new draft without Add/Edit/Attach/Export.
- Existing reviewed synthetic CV attached to new synthetic `2026-Nov-003` through
  the deployed dialog. Candidate moved from Unattached to Attached; reload retained
  one case and one person row. Duplicate requirement selection was excluded.
- Company → Ship → Candidates displayed both requirement links in one row with
  Active and history selected. Profile navigation/Back preserved URL filters.
- Coordinator saw the attachment read-only and opened the original private Drive
  PDF, visually readable in Chrome. No new PDF or real candidate was created.
- Backend readback verified exactly one new case and one version-2 basic draft.
  Synthetic `2026-Nov-003` was then closed; candidate/case history retained.
- No emails, invitations, paid model calls or intake activation. Optional upload
  remains held, as approved. Runtime code was not changed during the smoke.

Private release and fixture receipts, screenshots and cleanup proof are retained
in `.local/candidate-directory-20261111/`. This record is a documentation-only
follow-up; the deployed application remains the exact approved `1a8f6ca`.
