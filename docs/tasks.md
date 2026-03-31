# Pending Tasks

## High Priority

- Extend the CMA CGM writer prototype beyond Sections 1 and 2 using the real template and DB mappings
- Decide the durable integration path for client-form export:
  - backend/service endpoint
  - recruiter UI trigger
  - settings-driven template/mapping management
- Perform full manual applicant data-entry test after wiping applicant test data
- Manually verify applicant `View application` from the dashboard after the applicant/recruiter view split
- Manually verify recruiter bootstrap flow strictly through the UI after a controlled reset
- Manually verify recruiter reset-email flow end-to-end from received email to new password
- Verify `Coordinator` restricted access against intended product behavior

## Medium Priority

- Do a full branding consistency pass beyond the applicant header/dashboard
- Create a recruiter admin runbook for resets, bootstrap, role changes, and password recovery
- Create a DB operations runbook for common resets and cleanup flows
- Add automated verification around the client-form writer once the interface is stable enough
- Harden the single-active-application rule beyond the applicant dashboard UI by enforcing it at draft creation/submission in the database or an RPC/service layer, so alternate clients cannot bypass it
- Update the worksheet service `APP_URL` on Render from local/dev origins to the production frontend URL before go-live

## Lower Priority

- Revisit the Supabase auth lock override and replace it with a narrower multi-tab-safe approach
- Consolidate advanced-search legacy docs to reduce duplication across old and new document sets
- Decide whether the shared submitted-application view should remain role-aware in one component or be split into dedicated applicant/recruiter pages later

## Open Decisions

- Is a broader branding rollout required across every recruiter/public surface now, or later?
- Should `Send reset email` remain limited to `Master Recruiter` rows only, or be broadened later?
- Is the current 3-role model final, or should any extra recruiter capabilities be split further in future?
- Should the client-form writer remain Python-based behind a service boundary, or be reimplemented later in Node once mappings/settings UI are in place?
- Should uploaded client templates be normalized to `.xlsx` at upload time, or at generation time?

## Definition of Done For Major Changes

- relevant docs updated
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes when applicable
