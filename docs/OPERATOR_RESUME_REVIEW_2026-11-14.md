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

Pending: managed staging, independent release review, exact production approval,
backup/restore and live normal-session smoke. No production modification performed.
