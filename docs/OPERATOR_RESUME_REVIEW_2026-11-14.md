# Operator Résumé Review — Holmes integration

Implementation candidate, not deployed.

- Operator console has a Résumé Review tab linking to `/recruiter/ai/review`.
- The dedicated route uses OperatorRoute and the existing Needle session exchange.
- Review URL parameters (source, extraction version, filters) survive embedded
  navigation, reload and Back. Search requirement parameters retain their existing
  handling; no new cross-origin trust is introduced.
- Needle checks Operator/admin access independently on every API operation.
- No Holmes schema, edge Function or hosting change is needed.

The paired Needle implementation owns formatted PDF/Markdown/JSON views,
source-text and manual scan markers, issue causes, draft revisions, immutable
artifact snapshots, audit history and new-version publication. Its migration
`028_resume_review_workspace.sql` is required before deployment. Held migration
027, legacy provenance repair and intake activation are outside this slice.

Local evidence: 12 synthetic browser cases (new Operator entry/reload/Recruiter
rejection plus adjacent sidebar/access flows); lint and build. The frame in these
Holmes checks is synthetic. Needle separately exercises its real renderer using
synthetic artifacts and executes the actual SQL/RPC code locally.

Independent release review is complete with no remaining material findings after
Needle fixes for conversion-hold preservation, lock ordering and equal-timestamp
version selection. Needle passed 126 backend checks, 17 frontend checks, both
PGlite publication modes, real PostgreSQL concurrency, a rolled-back managed
Supabase staging rehearsal and a built-UI/API/PostgREST/PostgreSQL synthetic smoke.

There is no separate managed Needle staging service. The managed SQL rehearsal
left no persistent staging changes; integrated UI authentication/document fetching
used fixtures. Normal Operator session, Drive and hosted refresh checks remain
for the approved production pilot.

Pending: exact production approval, fresh backup/restore checks, Needle migration
028 and paired deployment, then live normal-session smoke. No production
modification performed. No Holmes migration or Function deployment is required;
027 and intake remain off.
