# Matching and review first — 2026-11-07

## KT decision and scope

KT approved releasing matching/review before choosing intake-service hosting.
This amends the connected-service prerequisite in the platform release order.
It does not approve a new paid service, reopen automatic intake, or qualify the
NuExtract/v18 hookup. Production has not been changed by this follow-up.

- Requirements has **Match résumés** next to each row's identifier. It opens the
  existing modal without leaving the tracker. The detail-page action remains.
- Only eligible open, reviewed company/ship requirements with present rank,
  vessel type and a current version can start matching. Other rows explain why
  their button is disabled. The server re-reads permissions, fleet and version.
- Results still require confirmed present-rank **and** vessel-experience matches.
  Nationality is optional; missing nationality is labelled for verification,
  never inferred. Ratings describe confirmed criteria, not hiring suitability.
- Results, paging, evidence and original-page review work with Needle directly.
  No platform intake origin, private Drive credential or scheduler is required.
- New candidate, Add to Holmes (including bulk), attachments from match results,
  uploads and intake-review entry queues are held. Existing candidates, contact
  edits, cases and existing original links remain usable under their permissions.
  New requirement remains available in its creation modal.

## Flags

| Location | Setting for this release |
|---|---|
| Vercel Production build | `VITE_FEATURE_AI_SEARCH=operator` |
| Vercel Production build | `VITE_FEATURE_RESUME_INTAKE=off` (default) |
| Vercel Production server | Existing `NEEDLE_ORIGIN` remains the production Needle HTTPS origin |
| Supabase Functions | `NEEDLE_AI_SEARCH_ACCESS=operator` |
| Supabase Functions | `RESUME_INTAKE_ENABLED=false` |
| Railway worker | `NJORDHR_DRIVE_INTAKE_ENABLED=false` |

`VITE_FEATURE_RESUME_INTAKE` is public configuration, not a secret. Only `on`
enables the UI. Holmes passes `intake=disabled` to the frame and ignores Add
messages while held. Needle defaults embedded Add actions to disabled unless
Holmes explicitly passes `intake=enabled`. Standalone Verify is unaffected.
The UI flag is not a security boundary: server permissions, reviewed-identity
transactions and the server intake flag remain authoritative. Existing review
receipts are not revoked by the server flag; this is not a global database
write freeze. No legacy uploader/save bypass is restored.

## Production gate and sequence

1. Freeze and independently review the amended Holmes and Needle candidates,
   including the earlier creation-modal changes. Confirm both production heads
   still match the manifest. KT owns promotion; no force push.
2. Refresh and verify both production backups and record current Railway,
   Vercel and Function rollback versions privately before any schema write.
3. Recheck migration history/objects; apply only missing reviewed migrations:
   Holmes **2026110604–2026110617**, Needle **024–026**, in that order per repo.
   Do not cherry-pick 0609 onto the old schema or edit already-applied migrations.
   The additive registry remains dormant; the compatible frontend holds creation
   because schema relaxation and source-review guards change the old save path.
4. Recheck open requirements. The two explicitly approved test requirements were
   closed with history preserved; last production read-back found zero open.
   Never infer company/ship identities from old labels. A new eligible requirement
   needs explicit reviewed company/ship and mandatory rank/vessel values.
5. Deploy the earlier manifest's seven reviewed changed Functions:
   `needle-token`, `needle-integration`, `operator-accounts`,
   `manage-runtime-settings`, `process-expiry-warnings`,
   `gemini-embedding-proxy`, `gemini-reasoning-proxy`. Retired proxies return 410.
   Use the exact reviewed sources/shared modules and record prior versions.
   The handler-authenticated gateway settings require the exact production
   deployment approval described in the earlier manifest; do not infer approval
   of other Functions from the three-function intake approval.
6. **Defer** `resume-intake`, `resume-index-dispatch`, CPU hosting, Drive
   credentials and scheduler activation. Keep their server flag false. The
   approved three-function sources at `e04c39e` are unchanged; the old private
   connected-service script remains held and must not be forced through.
7. KT promotes Needle first, then Holmes with the above held-entry settings.
   Run operator-only deployed-domain smoke: a reviewed eligible requirement's
   row action, strict two-criterion results, paging/original pages, stale-version
   rejection, long AI-search streaming/cookie renewal, held single/bulk Add and
   uploads, existing candidate/contact/case access, Coordinator denials and
   unchanged KPI counts. No new intake is needed for this gate.
8. Record actual live outcomes and limitations before handover. Choosing hosting
   and qualifying the service reopens the manual-entry gate later; enable both
   the UI (`on`, rebuild) and server (`true`) only after that separate acceptance.
   Automatic Drive intake remains off until its separate extractor acceptance.

## Verification of this follow-up

- Node tests: eligibility incl. Draft/closed/archived/deleted/unreviewed/missing
  mandatory scope, optional nationality and default-held capability.
- Bridge tests: exact requirement/version/stage scope, original-page projection,
  normal auth, Coordinator denial and no writes/calls from disabled intake even
  with no configured service origin. Actual ordered SQL replay passes for
  versions, immutable registry, reviewed identity and preserved normal edits.
- Needle tests: default/invalid/disabled embed mode emits no Add message;
  explicit opt-in still sends bounded IDs to the exact parent origin. Adjacent
  SearchWorkspace tests and hosted `/ai/` build pass.
- CUA on actual pages/components in a synthetic-only local fixture: row-to-modal
  route stays unchanged; 26 results page correctly; missing nationality remains;
  originals page 1/2 and zoom work; Attach stays disabled; visible failure/retry,
  empty results and stale errors work; Escape restores row focus; Coordinator
  has no matching/creation action; existing candidates remain in All and New
  candidate is disabled. Native Chrome desktop and 375px pane visual checks pass.
- Prior creation-modal checks remain documented in `CREATION_MODALS_2026-11-07.md`.
  The current normal staging session expired. These new UI checks use fixtures,
  not a new live-role or deployed-domain acceptance. Broad CLI browser smoke was
  not run against production-configured checkouts. Private proof stays ignored.

## Rollback

Disable AI access in both UI and Functions if matching fails; rebuild/redeploy
UI settings. Keep both intake flags and automatic Drive intake off. Preserve
all additive tables, originals, review history and events. Prefer a forward fix:
rolling back the frontend across reviewed candidate/schema guards is not a safe
creation rollback. Never re-enable the legacy uploader to work around a hold.
