# Pending Tasks

## High Priority

- Validate the hosted worksheet export path end to end for all supported customer templates:
  - template upload
  - recruiter download flow
  - formatting fidelity
  - overwrite behavior on prefilled template data
- Verify the second customer worksheet template against the shared mapping path and confirm branding/template fidelity
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
- Do a broad edge-function CORS sweep before go-live so wildcard origins are replaced with an `APP_URL`-based allowlist/shared helper
- Add a small worksheet-service operations runbook:
  - deploy/redeploy steps
  - required env vars
  - template upload expectations (`.xlsx` only)
  - common worksheet troubleshooting steps

## Lower Priority

- Revisit the Supabase auth lock override and replace it with a narrower multi-tab-safe approach
- Consolidate advanced-search legacy docs to reduce duplication across old and new document sets
- Decide whether the shared submitted-application view should remain role-aware in one component or be split into dedicated applicant/recruiter pages later

## Open Decisions

- Is a broader branding rollout required across every recruiter/public surface now, or later?
- Should `Send reset email` remain limited to `Master Recruiter` rows only, or be broadened later?
- Is the current 3-role model final, or should any extra recruiter capabilities be split further in future?
- Should the client-form writer remain Python-based behind a service boundary, or be reimplemented later in Node once mappings/settings UI are in place?
- Should the app ever support in-product template normalization again, or should normalized `.xlsx` upload remain the permanent workflow?

## Definition of Done For Major Changes

- relevant docs updated
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes when applicable
