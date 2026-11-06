# Holmes operator-only Needle pilot

## Current completion candidate — 2026-11-07

Production has advanced to Holmes `a1e62c1` and Needle `401ec6e0`. For the new
candidate-field/Add/Match/upload/operator slice, use
`INTEGRATION_COMPLETION_2026-11-06.md`. Its migration and Function manifest,
source status, acceptance gaps and degraded-entry rollback boundary supersede
the original embed preparation instructions below. The new slice is not
promoted. Keep intake off, AI operator-only and Preview forwarding denied.

## Responsive follow-up — 2026-11-06 (local candidate)

The pilot is live on Holmes `ea97b2a` and Needle `b82cc1ed`; the original
preparation text below is historical. The current follow-up is
`codex/holmes-embed-responsive`, paired with Needle's
`codex/needle-embed-responsive`. It is independent of the broader warm-theme
and recruitment-case rollout and needs no database migration or function deploy.

The AI page gets a compact wrapping Holmes header. Needle's companion change
turns the embedded search sidebar into a drawer below 768 pixels. The regression
suite measures the entire outer page and iframe at 311, 375 and 640 pixels,
checks search-menu navigation and Escape dismissal, and retains desktop,
PDF-delivery, scope and session-renewal/logout coverage. All test data is synthetic.

After review, KT commits the explicit files, deploys the Needle candidate to
Railway, then deploys this Holmes candidate. Recheck the exact narrow pane and
desktop in production. Rollback: previous Railway versions and previous Vercel
deployment; no database rollback. Keep access `operator` and Drive intake false.
Live Coordinator denial (no account available), same-candidate Preview denial
and standard-Chrome inline PDF rendering remain separate acceptance checks.

Date: 2026-11-05. Prepared locally; **nothing deployed or pushed**.
KT confirmed there is no staging Needle. The first deployed test will therefore
be production with AI access restricted to KT's platform-operator account.

## Candidates and source history

- Holmes `codex/holmes-operator-pilot`, worktree
  `/Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-operator-pilot`.
  Base: verified production `main@f79b634f2907ce8fe5ac533d8a89945800f5d6e9`.
- Needle `codex/needle-operator-pilot`, worktree
  `/Users/kartikraghavan/Tools/NjordHR/.local/worktrees/needle-operator-pilot`.
  Base: verified live `railway-m1@32051f9c73702c7faed10e40f2112ef7b7dd9e7e`.
- Earlier slices: Holmes `feature/needle-in-holmes@7b96b1b`, Needle
  `feature/holmes-embed@5d31e6d6`. The new candidates reconcile these with the
  conversion/source-repair/operator-queue work, preserving shared checkouts.
- The production pilot preserves the existing production navigation/theme.
  It does not deploy the full `ui/warm-theme` branch, case v1, candidate-schema
  changes, Add to Holmes or the future candidate portal.

The full coordinated procedure is in Needle's
`docs/HOLMES_EMBED_2026-11-05.md`. Follow it for database assignments, Railway
settings, live checks and rollback. That procedure replaces the older rollout
instructions for the feature branches and the old conflicting Needle 021 RLS.

## What is prepared

- Operator flag (`platform_operators`, RPC self-read), console with Health,
  Platform settings and AI links. Settings → Integrations moves to the operator
  console; Team and Worksheet templates retain their existing production UI.
- AI links: review queue, facts approval, settings and evaluations. The queue
  has source PDF/page links and matching conversion text. Recruiters cannot
  read the Holmes operator queue; it does not grant approval to a recruiter.
- Ed25519 `needle-token` function, `/ai` session exchange and same-origin frame,
  route/history sync, expiry/one renewal/Retry and logout. Platform operators
  need no recruiter role to open AI. Coordinators cannot mint search tokens.
- `/ai` middleware reads `NEEDLE_ORIGIN` per environment. A Vercel Preview is
  **always denied**, even if Production's origin setting was inherited. There
  is no staging Needle exception in this pilot.
- Needle runs one configured organization and rejects other signed org claims.
  Workspace roots and resume pool memberships are explicitly assigned before
  enabling the pilot. This is not an accepted multi-customer deployment.
- Secret-key-aware shared Supabase clients for the two functions being deployed.
  Token requests use `auth.getUser` and fail closed if authorization queries fail.
  `needle-token` has gateway `verify_jwt=false` because its own verified-user
  check supports modern asymmetric Supabase signing keys. It is not anonymous
  authorization: no valid user JWT means no token.

## KT commit commands (no push or deployment)

```zsh
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/needle-operator-pilot
zsh scripts/commit_holmes_operator_pilot.zsh
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-operator-pilot
zsh scripts/commit_holmes_operator_pilot.zsh
```

Each helper checks the branch/base, stages explicit reviewed files, checks the
cached diff and prints a short stat. Private keys, config.ini, `.local` and other
checkouts' pending work are excluded. Do not use the old broad-branch promotion.

## Production rollout gates (KT)

1. Complete the final promotion review required by Needle’s `AGENTS.md`, then verify fresh, complete backups of both production Supabase databases, with scratch
   restore/count evidence. Record Railway/Vercel/edge-function rollback versions.
2. Apply **only** Holmes `2026110501_platform_operators.sql` and
   `2026110502_rename_default_organization.sql`. The latter independently creates
   the minimal seeded organization if absent; no case-v1 migration is needed.
   Do not apply other pending migrations through an unrestricted `db push`.
3. Add KT's verified Auth user to the operator table before deploying the
   settings authorization change. Example, after replacing the email locally:

   ```sql
   insert into public.platform_operators (user_id, note)
   select id, 'KT platform operator' from auth.users
   where lower(email) = lower('<KT work email>')
   on conflict (user_id) do nothing;
   ```

   Confirm exactly the intended account. No customer role creates this flag.
4. Needle migrations: 020 conversion inputs, 021 operator queue, **022** runtime
   RLS (renumbered), 023 pool membership. Assign the current Njordships document
   roster with the count-checked procedure in its runbook; tag workspace roots
   from the new Needle container after deployment and before the Holmes client
   flag is enabled. Keep the workspace write maintenance window in effect.
   Membership does not approve facts, delete old rows or change source PDFs.
5. Generate/store the signing pair privately. The private PEM goes to Holmes's
   `NEEDLE_TOKEN_PRIVATE_KEY`; the public PEM goes to Railway engine
   `NJORDHR_HOLMES_PUBLIC_KEY`. Set both `NEEDLE_ORG_ID` and
   `NJORDHR_HOLMES_ORG_ID` explicitly to
   `00000000-0000-4000-8000-0000000000a1` after confirming the seed.
6. Deploy only `needle-token` and `manage-runtime-settings` plus their checked
   shared helpers. Set `NEEDLE_AI_SEARCH_ACCESS=operator`. Do not deploy all edge
   functions or unrelated staging changes. Set Railway's persistent session
   secret, `/ai` build/runtime base, admin-only direct login and hosted review.
7. KT promotes Needle to `railway-m1`. Engine and worker must be Active; worker
   intake stays `NJORDHR_DRIVE_INTAKE_ENABLED=false`. Complete the workspace-tag
   helper/backup/count check from the new container before ending maintenance.
   New conversion is routed,
   Gemini converter unreachable; this rollout does not switch an extractor.
8. KT deploys this Holmes candidate with Production `NEEDLE_ORIGIN` set to
   `https://njordhr.up.railway.app` and `VITE_FEATURE_AI_SEARCH=operator`.
   Preview keeps the flag off and no origin; code also denies Preview forwarding.
9. Real live gate: Operator Health Up; sign-in/cookie under Holmes's domain;
   actual prompt search streams to completion; filter-only search; repository;
   candidate facts/formatted resume/PDF; operator review; Back/refresh; expiry,
   Retry; logout. Verify the secure `njordhr_ai_session` cookie at Path=/ai.
10. Negative gate: ordinary recruiters and Coordinators cannot mint tokens;
    preview `/ai/auth/me` is 404 with no rewrite; wrong org/unsigned tokens fail;
    foreign source IDs are 404 before PDF or markdown access. Record deployment
    IDs and evidence. **Report before any access flag is changed to `on`.**

Keep the one-process/one-replica Needle deployment: one-use JWT replay storage
is currently per process. Changing that topology needs shared replay storage.

## Rollback

Set `NEEDLE_AI_SEARCH_ACCESS=off`, deploy the frontend flag off, and keep Drive
intake false. Restore the previous Vercel and Railway deployments and environment
settings, including the public base path. Restore the previous settings function
if reverting its permission contract. If immediate engine-session revocation is
needed, rotate the pilot's Flask session secret. Keep the additive tables and
RLS; do not drop tables or disable security. Pool assignment can be deactivated
by its private batch ID; workspace tags have a private verified backup/receipt.
No candidate or approved fact was created by the embed rollout.

## Local verification versus live acceptance

Synthetic local browser tests exercise the real Holmes UI and Needle routes,
including streaming, scoped repository/PDF access, queue, Back/refresh,
renewal/Retry and logout. SQL scratch tests cover new migrations, service-role
access, browser denial, memberships, operator self-read and escalation denial.
Builds/lint and focused backend/frontend tests pass; evidence is recorded in
Needle's private `.local/holmes-integration/` folder.

**Still unverified:** actual Vercel forwarding/long-stream behavior and secure
cookie persistence, deployed Supabase functions, production assignments/counts
and a real corpus search. These require KT's operator-only promotion.

After the pilot: candidate-field relaxation (staging first), Add to Holmes with
reviewed duplicates/provenance, Match resumes and required resume upload. Intake
reopening separately requires NuExtract3 acceptance/hookup, OCR placement and
conversion-quality gates. Per-customer provisioning and full tenant acceptance
remain mandatory before a second customer; the pilot is explicitly Njordships.
