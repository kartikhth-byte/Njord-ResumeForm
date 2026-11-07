# Requirement résumé matching modal

Local follow-up to Holmes `ae5f45a` and Needle `f31a705f`. Not promoted.
This changes the requirement workflow; standalone AI Search remains unchanged.

## KT decisions

- Match résumés opens a modal over the requirement. No secondary **Open in AI
  Search** action, redirect, or embedded search application in this modal.
- **Present rank and vessel-type experience are mandatory.** Both must be
  confirmed matches. Missing, uncertain or mismatched rank/ship stays outside
  these results. Missing/unmapped requirement vessel type fails loudly.
- Other criteria are optional. A missing or different nationality does not
  remove an otherwise matching résumé. No name/address/phone citizenship guess.
- Rows show candidate, confirmed-criteria fraction and explicit uncertainty,
  Review and Attach. The fraction is not a probability or a star rating.

## Implementation

Needle retains one owned search per requirement, with frozen stages per version.
The requirement-specific projection checks current organization membership,
confirmed rank/ship and saved-stage ownership before returning a 25-row page.
Pagination and original review read the saved stage without starting new work.
Optional FAIL/UNKNOWN remains visible and labelled; general AI Search scoring
and unknown handling are not changed.

Holmes authenticates the normal caller and rechecks open/reviewed company/ship,
role/access and current requirement version on matching, paging and original
preview. Source hashes are server scoped. Private Drive references and pending
facts are not browser payloads. Linked identities/cases use caller RLS, not a
service-role identity guess.

Review shows criterion evidence and every original page, with page navigation
and zoom. Server-rendered PNGs avoid dependence on a browser PDF plugin; the
private original remains unchanged. Preview bounds: 10 MiB PDF, unlocked,
1–100 pages, one page per request, maximum 1600 × 2200 raster. Errors are shown
explicitly; no legacy text/model fallback. Responses are private/no-store.

Attach opens the existing platform source/identity review within the same modal.
Its requirement is locked to the source requirement/version. New people still
require human identity review, existing people retain confirmed fields, and
duplicate/source guards remain in the transaction. Existing cases are displayed;
an existing case on this requirement disables another attachment from the row.
Saving updates the row and refreshes requirement cases when the modal closes.

## Verification

- 101 focused/adjacent Needle tests pass: mandatory rank/ship, optional missing
  and mismatched nationality, membership/actor/version/stage isolation, pagination,
  originals/preview page bounds, workspace persistence/ownership, auth and hosted
  allowlist. No models or production data used.
- Holmes Node tests cover assessment labels, exact requirement attachments,
  bridge role/open/version guards and safe metadata/PDF/preview projection;
  adjacent platform/case tests and bridge/outbox tests pass.
- Normal staging Master session: original requirement URL stays unchanged;
  confirmed row and nationality-missing row appear; already-attached row disabled;
  both synthetic source pages render; reviewed identity attaches to the locked
  requirement. Staging read-back proves one source link, exactly one case on
  that requirement, and nationality still null. Original synthetic requirement
  snapshot and proof/screenshots are private.
- Visual layout checked at 1280 × 900 and 311 × 780. Native modal owns focus,
  background is inert, Escape closes it; review scrolls into view on narrow
  screens. Rows/actions fit within the modal.
- CLI browser smoke is not used under this session's CUA-only browser rules;
  the browser evidence above is the actual normal-session CUA smoke. It uses
  real Holmes staging Auth/RLS/platform intake and synthetic loopback Needle
  facts/assessment, not a production matching-quality evaluation.

## Rollout and rollback

No additional schema migration, secret, GPU or automatic-intake change is needed
for this follow-up. It depends on the parent platform-intake migrations/service
and their production gates; see `PLATFORM_RESUME_INTAKE_RELEASE_2026-11-07.md`.

Consolidated review and a refreshed source freeze are required before KT promotes.
Deploy compatible Needle first, then the updated `needle-integration` Function
and Holmes frontend. `/match` keeps its owned `path` for older callers during
rollout; the new modal does not display or navigate to it. The new frontend must
not go live against an old bridge that returns only a navigation path.

Repeat deployed HTTPS/CORS/role/original/attachment smoke operator-only. Keep
`NJORDHR_DRIVE_INTAKE_ENABLED=false`; this does not connect NuExtract/v18.
UI rollback may retain the compatible API and existing registry/cases. Never
delete originals/cases or reopen legacy upload to roll back this presentation.
