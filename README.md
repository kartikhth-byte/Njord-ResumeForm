# Njord Holmes

Maritime recruitment platform for applicant intake, recruiter operations, and recruiter administration.

This repository contains the active application code for:
- applicant onboarding and application submission
- recruiter dashboards, search, and workflow operations
- recruiter bootstrap, team management, and role-based access
- staged client-form export/generation work for downstream recruiter workflows

## Core Product Model

### Applicant

- signs in with Google OAuth
- completes a 19-section maritime application form
- saves drafts and submits applications

### Recruiter-Side Users

- sign in with email/password
- use one of three recruiter roles:
  - `Master Recruiter`
  - `Recruiter`
  - `Coordinator`

## Tech Stack

- React + Vite
- Tailwind CSS
- Supabase Auth + Postgres + Edge Functions
- Playwright for smoke automation

## Project Structure

- `AGENTS.md`
  Repo instructions for coding agents
- `documentation.md`
  Live short-form project memory and current status
- `docs/`
  Current source of truth for product, tasks, decisions, test plan, and implementation guidance
- `Njord-Resumeform-Documents/`
  Legacy/reference project documents
- `src/`
  Frontend application code
- `supabase/`
  Edge functions and migrations
- `tests/`
  Playwright smoke and supporting test helpers

## Important Docs

Start here for current project state:

1. [`documentation.md`](./documentation.md)
2. [`docs/prd.md`](./docs/prd.md)
3. [`docs/tasks.md`](./docs/tasks.md)
4. [`docs/decisions.md`](./docs/decisions.md)
5. [`docs/test-plan.md`](./docs/test-plan.md)

## Key Commands

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Verify code quality:

```bash
npm run lint
npm run build
```

Run smoke automation:

```bash
npm run test:smoke
```

Refresh applicant stored Google session for Playwright when needed:

```bash
npm run test:auth:applicant
```

Run the current CMA CGM writer prototype for Sections 1 and 2:

```bash
npm run prototype:cma-cgm -- --template '/Users/kartikraghavan/Downloads/CMA CGM form 1.numbers' --public-token '<public-token>' --output '<output.xlsx>'
```

## Auth Notes

### Applicant auth

- Google OAuth through Supabase
- callback route:
  - `/auth/callback`

### Recruiter auth

- email/password through Supabase
- password reset route:
  - `/recruiter/reset-password`

## Recruiter Bootstrap

First-time recruiter setup is handled through:

- `/recruiter/setup`

This flow depends on the `create-recruiter` edge function. If that function changes, redeploy it:

```bash
supabase functions deploy create-recruiter
```

## Current Verification Baseline

Current expected baseline before closing substantial work:

```bash
npm run lint
npm run build
npm run test:smoke
```

Current review snapshot on 2026-03-30:
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes (`75 passed, 2 skipped`)

Recent functional changes in this snapshot:
- duplicate emergency-contact section was removed from the applicant flow
- declaration was renumbered to real `section19` and now routes at `/application/form/section/19`
- applicant dashboard `View application` now opens an applicant-facing read-only summary instead of exposing recruiter review actions
- Section 14 was normalized to the new course mapping model and existing data was migrated
- a CMA CGM Sections 1 and 2 export prototype now exists under `scripts/client_forms/cma_cgm_writer.py`

## Known Caution

To eliminate a severe signed-in startup delay, the Supabase auth lock was overridden in `src/lib/supabase.js`. This is intentional for now, but it has known multi-tab refresh-token trade-offs and should be revisited later.
