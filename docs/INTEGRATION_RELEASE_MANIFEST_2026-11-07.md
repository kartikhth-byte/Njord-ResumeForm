# Integrated Needle / Holmes release manifest

2026-11-07. **Not promoted. Local/staging pilot acceptance and consolidated
independent code review passed, including the 0608 follow-up. KT source freeze
and production gates remain.** This supersedes earlier warm and
responsive manifests for this slice. See `INTEGRATION_COMPLETION_2026-11-06.md`
for evidence and limitations. Commands below commit local explicit files only;
they do not push or deploy. Do not stage either node_modules link, generated
build metadata, tmp/.local data, private settings or backup receipts.

## KT local commits — reviewed candidate

The guards refuse a changed base, wrong branch or pre-existing staged changes.
If any guard fails, inspect/reconcile; do not remove the guard or force push.
The two repositories remain separately maintained. Holmes is already based on
the deployed warm/KPI baseline; no later copy into ui/warm-theme is needed.

### Needle

```zsh
(
  set -e
  cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/needle-integration-completion
  [[ "$(git branch --show-current)" == "codex/needle-integration-completion" ]]
  [[ "$(git rev-parse HEAD)" == "401ec6e0d472827ca014b2f32b9b2bfac0806725" ]]
  git diff --cached --quiet
  git status --short
  git add -- \
    candidate_facts/supabase_store.py \
    docs/HOLMES_EMBED_2026-11-05.md \
    docs/NjordHR_Canonical_Backlog_2026-08-21.md \
    frontend/src/lib/embed.test.ts \
    frontend/src/lib/embed.ts \
    frontend/src/pages/SearchWorkspace.test.tsx \
    frontend/src/pages/SearchWorkspace.tsx \
    frontend/src/search/CandidateCard.tsx \
    frontend/src/search/CandidateDetail.tsx \
    frontend/src/search/StageStack.tsx \
    frontend/src/search/StageTable.tsx \
    holmes_auth.py \
    holmes_integration_api.py \
    holmes_requirement_search.py \
    holmes_resume_upload.py \
    hosted_allowlist.py \
    operator_health.py \
    supabase/migrations/024_holmes_resume_uploads.sql \
    supabase/migrations/025_operator_health_summary.sql \
    tests/fixtures/holmes_embed_server.py \
    tests/sql/holmes_upload_migrations.mjs \
    tests/test_candidate_facts_supabase_store.py \
    tests/test_holmes_integration_api.py \
    tests/test_holmes_requirement_search.py \
    tests/test_holmes_resume_upload.py \
    worker_main.py \
    workspace_integration.py \
    workspace_store.py
  git diff --cached --check
  git --no-pager diff --cached --stat
  git --no-pager diff --cached --name-status --find-renames
  git commit -m "Integrate scoped Holmes resume intake, matching and operator evidence"
)
```

### Holmes

```zsh
(
  set -e
  cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-integration-completion
  [[ "$(git branch --show-current)" == "codex/holmes-integration-completion" ]]
  [[ "$(git rev-parse HEAD)" == "a1e62c1f176770541ef70bc38692183148595923" ]]
  git diff --cached --quiet
  git status --short
  git add -- \
    docs/INTEGRATION_COMPLETION_2026-11-06.md \
    docs/INTEGRATION_RELEASE_MANIFEST_2026-11-07.md \
    docs/WARM_KPI_KT_RELEASE_2026-11-06.md \
    docs/WARM_RELEASE_MANIFEST_2026-11-06.md \
    docs/needle-embed-rollout.md \
    docs/tasks.md \
    docs/test-plan.md \
    documentation.md \
    postcss.config.js \
    scripts/check-candidate-resume-fields.mjs \
    src/components/auth/AuthContext.jsx \
    src/components/auth/AuthLayout.jsx \
    src/components/dashboard/ExpiryDashboard.jsx \
    src/components/operator/OperatorOperationsSection.jsx \
    src/components/recruiter/AddToHolmesDialog.jsx \
    src/components/recruiter/CandidateForm.jsx \
    src/components/recruiter/CandidateResumePanel.jsx \
    src/components/recruiter/RecruitmentCasePanel.jsx \
    src/components/recruiter/ResumeDuplicateReview.jsx \
    src/hooks/useKpiTrackerData.js \
    src/pages/OperatorConsole.jsx \
    src/pages/RecruiterAiSearch.jsx \
    src/pages/RecruiterApplications.jsx \
    src/pages/RecruiterCandidatesPage.jsx \
    src/pages/RecruiterLogin.jsx \
    src/pages/RecruiterProspectDetail.jsx \
    src/pages/RecruiterRequirementDetail.jsx \
    src/services/needleIntegrationService.js \
    src/services/recruiterRecordService.js \
    src/services/recruitmentCaseService.js \
    src/utils/candidateResumeFields.js \
    src/utils/recruitmentCase.js \
    supabase/config.toml \
    supabase/functions/_shared/needle-access.js \
    supabase/functions/_shared/needle-signing.ts \
    supabase/functions/gemini-embedding-proxy/index.ts \
    supabase/functions/gemini-reasoning-proxy/index.ts \
    supabase/functions/manage-runtime-settings/index.ts \
    supabase/functions/needle-integration/handler.js \
    supabase/functions/needle-integration/index.ts \
    supabase/functions/needle-token/index.ts \
    supabase/functions/operator-accounts/handler.js \
    supabase/functions/operator-accounts/index.ts \
    supabase/functions/process-expiry-warnings/authorization.js \
    supabase/functions/process-expiry-warnings/index.ts \
    supabase/migrations/2026110604_candidate_resume_integration.sql \
    supabase/migrations/2026110605_principal_send_attestation.sql \
    supabase/migrations/2026110606_operator_observability.sql \
    supabase/migrations/2026110607_link_submitted_case_form.sql \
    supabase/migrations/2026110608_requirement_match_versions.sql \
    supabase/tests/candidate_resume_integration.test.mjs \
    supabase/tests/expiry-job-authorization.test.mjs \
    supabase/tests/needle-integration.test.mjs \
    supabase/tests/operator-accounts.test.mjs \
    supabase/tests/operator_principal_completion.test.mjs \
    supabase/tests/requirement_match_versions.test.mjs \
    tailwind.config.js
  git diff --cached --check
  git --no-pager diff --cached --stat
  git --no-pager diff --cached --name-status --find-renames
  git commit -m "Complete Holmes candidate resume workflow and operator controls"
)
```

## Exact database manifest

Production projects: Needle `ljmhkweutnnrdglvetjr`; Holmes
`btbqdviuqcpauojmorvx`. Staging rehearsal is Holmes `dwslhetniuzpyuspuomy`.
Preflight existing migration versions and source hashes first. Do not use an
unrestricted database push. Apply only this reviewed list after fresh complete
backups with scratch row-count verification and private SHA-256 receipts.

- `024_holmes_resume_uploads.sql` — source SHA-256 `759c5f8e2a0b10cc0a2f4b0b055770b67d1c955b1e22b458e13be5d90efdfa71`.
- `025_operator_health_summary.sql` — source SHA-256 `14c280c9ca9c3bc119a397b8ced4ff77b42ea9358c0cf537dc18082b0768abe3`.
- `2026110604_candidate_resume_integration.sql` — source SHA-256 `dafef4f36a208f98bcf35b550fb548c0f26c290499333c0512a263238eef1f84`.
- `2026110605_principal_send_attestation.sql` — source SHA-256 `1b7b9882598123e1f69a3a701ea01bb6f501459558cbc28a3951adaee5239abf`.
- `2026110606_operator_observability.sql` — source SHA-256 `b6b23016112b919dfff9fb7290759db761d52fa7d7af6e49fec024ea0c123bb5`.
- `2026110607_link_submitted_case_form.sql` — source SHA-256 `7f8cdecd899c767d976ab37a37008e82f613e043dcb4d37eadd24ca82a8962b3`.

- `2026110608_requirement_match_versions.sql` — source SHA-256 `0666ad986fa0841cc966f7ceb646ac9b87c47d2db9b52e16c9c5667a87a13362`.

## Exact Function manifest

Changed/new: `needle-token`, `needle-integration`, `operator-accounts`,
`manage-runtime-settings`, `process-expiry-warnings`,
`gemini-embedding-proxy`, `gemini-reasoning-proxy`.

The first five perform authentication/authorization inside the handlers and
need gateway JWT verification off for the configured modern signing keys.
The two retired proxies return 410 with no work or hosted-model request.
The production deployment command is a separate explicit KT approval gate;
no deployments were executed for this candidate. Reuse the pinned committed
source for each Function, including shared modules. Record prior deployed
Function versions for rollback; do not deploy from another checkout.

## Environment and release order

1. Keep automatic Drive intake `NJORDHR_DRIVE_INTAKE_ENABLED=false` on worker;
   keep `NEEDLE_AI_SEARCH_ACCESS=operator` and
   `VITE_FEATURE_AI_SEARCH=operator`. Never enable Preview forwarding.
2. Record fresh Railway engine/worker and Vercel deployment IDs, current
   remote heads, Function versions and existing switches. Freeze candidate
   writes for the coordinated schema/service/web cutover.
3. Apply only the exact migrations above after confirming foundations
   (Holmes through0603; Needle through023). Preserve legacy candidates and
   additive audit/source history. This release changes the entry contract.
4. Needle: retain existing production key/org/base-path configuration and
   persistent workspace volume. Set `NJORDHR_HOLMES_UPLOAD_FOLDER_ID` to the
   existing Njordships intake folder or an approved child within its Drive
   tree; verify engine upload OAuth and worker document-reader access. Empty
   configuration rejects uploads. No résumé conversion/model is run by upload.
5. Holmes Functions: retain private `NEEDLE_TOKEN_PRIVATE_KEY`, matching
   Needle public key and `NEEDLE_ORG_ID`; set `NEEDLE_API_ORIGIN` to the bare
   production Needle HTTPS origin. Confirm APP_URL is the production Holmes
   origin for reset redirects. Never put private keys in VITE_* settings.
6. After KT-approved exact Function/service promotion, Vercel production keeps
   `NEEDLE_ORIGIN=https://njordhr.up.railway.app`. Existing Preview denial
   overrides inherited origin. Promote only the reviewed commit hashes, with
   remote-head equality guards. No agent push to railway-m1 is authorized.
7. Operator-only production acceptance: SSO/cookie renewal/logout, streamed
   search completion, narrow/desktop layout, single/bulk Add and duplicate
   review, Match reuse/new version, scoped Coordinator PDF/no writes,
   synthetic upload/hash repeat/history/read-back, contact gate, submitted
   form link, handoff/hire, operator health/audit/denials. Authorize any live
   synthetic writes before performing them. No staging Needle exists, so the
   local synthetic service cannot close this public-gateway/Vercel gate.

## Rollback

Disable AI flags, keep intake off and freeze new candidate writes. Restore
recorded web, Functions and Railway deployments. Preserve additive tables,
profiles, uploaded originals, source links and audit history. Never reinstate
NOT NULL constraints over new nullable candidates or restore a full old dump
over newer records. Old candidate-entry and unversioned form-link RPCs are
revoked/refuse the new contract: an old web rollback has no new entry/linking
until a compatible forward fix. Do not promise a transparent schema downgrade.

## Verification commands and evidence

- Holmes `npm run lint -- --quiet` and `npm run build`: pass. Existing bundle
  size/Browserslist warnings remain. No package changes.
- Bridge/account/expiry authorization scripts and candidate field check: pass.
- Node policy/proxy/case utility suite: 15 tests pass.
- PGlite candidate migration test: pass. Principal/operator tests include
  0605,0606,0607: submitted-form ownership/draft/version/replay, principal
  evidence, role and redacted-audit gates pass. PGlite runtime lives in an
  ignored/private temporary install, not a new project dependency.
- Requirement edit/nationality version fixture 0608: pass.
- Review-correction API/requirement/upload suite: 20 tests pass, independently
  rerun; failed evaluator retries and recovered source-byte mismatch covered.
- Needle focused backend suite: 134 tests pass; final metadata/API rerun:
  23 tests pass after the exact column projection correction. These overlap;
  do not add the counts. Existing PyMuPDF deprecation notices remain.
- Needle embed/narrow-pane React tests: 3 pass; hosted `/ai/` build passes.
- Actual Holmes AuthProvider private regression: 4 tests pass.
- CLI Playwright harness not run; browser acceptance used computer-use tools.
- No real model/extractor accuracy, automatic post-extraction profile backfill,
  ordinary reset-email inbox delivery or production Drive write is proved by
  the local synthetic rehearsal. Intake/model hookup stays separately gated.
