# Agent Instructions

Read these files before making major changes:

1. `README.md`
2. `documentation.md`
3. `docs/prd.md`
4. `docs/tasks.md`
5. `docs/decisions.md`
6. `docs/test-plan.md`

## Project Rules

- This repo is a maritime recruitment platform with two auth modes:
  - applicants use emailed magic links only (invite-only; no self-serve login page)
  - recruiter-side users use email/password
- Recruiter roles are intentionally limited to:
  - `Master Recruiter`
  - `Recruiter`
  - `Coordinator`
- `profiles.user_type` is coarse identity type, not the full recruiter authorization model.
- Edge function changes must be reflected in docs and redeployed when needed.
- Major behavior changes should update `documentation.md` and the relevant file in `docs/`.

## Verification Rules

Before closing substantial implementation work, run:

```bash
npm run lint
npm run build
```

If the change affects key user flows or UI automation:

```bash
npm run test:smoke
```

If applicant protected-flow smoke is stale, refresh it with:

```bash
npm run test:auth:applicant
```

## Documentation Rules

- `documentation.md` is the live, short-form project memory.
- `docs/prd.md` is the full-platform product description.
- `docs/tasks.md` is the source of truth for pending work.
- `docs/decisions.md` records cross-cutting product and technical decisions.
- Legacy reference material remains in `Njord-Resumeform-Documents/`, but new updates should prefer the root/docs structure.

## Current Cautions

- `src/lib/supabase.js` includes a no-op auth lock override to avoid severe startup delays. This is intentional for now, but it has known multi-tab token-refresh trade-offs.
- Recruiter bootstrap relies on the `create-recruiter` edge function and should be tested carefully after auth or RBAC changes.
