#!/bin/zsh
# KT-reviewed local commit only. No network, deployment or broad staging.
set -eu
set -o pipefail
cd "${0:A:h:h}"
[[ "$(git branch --show-current)" == "codex/holmes-operator-pilot" ]] || { print -u2 "Wrong branch; stop."; exit 1; }
[[ "$(git rev-parse HEAD)" == "f79b634f2907ce8fe5ac533d8a89945800f5d6e9" ]] || { print -u2 "Baseline changed; review before committing."; exit 1; }
files=(
  docs/needle-embed-rollout.md
  docs/needle-in-holmes-design.md
  docs/tasks.md
  docs/test-plan.md
  documentation.md
  middleware.js
  package-lock.json
  package.json
  scripts/commit_holmes_operator_pilot.zsh
  src/App.jsx
  src/components/auth/AuthContext.jsx
  src/components/auth/OperatorRoute.jsx
  src/components/operator/OperatorHealthSection.jsx
  src/components/recruiter/RecruiterTopbar.jsx
  src/components/recruiter/RecruiterWorkspaceNav.jsx
  src/lib/needle.js
  src/lib/supabase.js
  src/lib/supabaseKey.js
  src/pages/OperatorConsole.jsx
  src/pages/RecruiterAiSearch.jsx
  src/pages/RecruiterSettings.jsx
  supabase/config.toml
  supabase/functions/_shared/api-keys.ts
  supabase/functions/_shared/needle-access.js
  supabase/functions/_shared/runtime-settings.ts
  supabase/functions/manage-runtime-settings/index.ts
  supabase/functions/needle-token/index.ts
  supabase/migrations/2026110501_platform_operators.sql
  supabase/migrations/2026110502_rename_default_organization.sql
  tests/needleAccess.test.mjs
  tests/needleMiddleware.test.mjs
  tests/smoke/needle-embed.spec.js
  vercel.json
  vite.config.js
)
git status --short
git diff --check -- "${files[@]}"
git --no-pager diff --stat -- "${files[@]}"
git --no-pager diff --name-status --find-renames -- "${files[@]}"
git add -- "${files[@]}"
git diff --cached --check -- "${files[@]}"
git --no-pager diff --cached --stat -- "${files[@]}"
git commit --only -m "Prepare operator-only Holmes embed from production baseline" -- "${files[@]}"
