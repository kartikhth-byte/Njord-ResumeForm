# Implementation Notes

## Current Patterns To Preserve

- use the auth context as the shared source for session/profile/role/permissions loading
- use permission-aware checks for recruiter/admin actions
- keep bootstrap/setup logic centralized in the `create-recruiter` edge function
- prefer updating docs when behavior or workflows change

## Sensitive Areas

- `src/components/auth/AuthContext.jsx`
- `src/lib/supabase.js`
- `src/pages/RecruiterSetup.jsx`
- `src/pages/RecruiterTeam.jsx`
- `supabase/functions/create-recruiter/index.ts`

## Required Checks After Sensitive Changes

- lint/build
- smoke if user-facing flows changed
- redeploy changed edge functions when backend logic is edited

## Documentation Expectation

If you change:
- auth
- role model
- setup/bootstrap
- password reset
- smoke automation
- branding

then update:
- `documentation.md`
- `docs/tasks.md`
- and the most relevant focused doc in `docs/`
