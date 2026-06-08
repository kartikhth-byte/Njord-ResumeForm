# Pending Tasks

## High Priority

- Validate and deploy the remaining prospect-enrollment backend slice:
  - invite request / bounce handling
  - deep-read / export reporting RPCs
  - live cutover and rollout validation
- Verify the second customer worksheet template against the shared mapping path and confirm branding/template fidelity
- Complete workbook-quality validation for customer worksheet exports:
  - formatting fidelity
  - overwrite behavior on prefilled template data
  - populated-value verification against the source application
- Commit or intentionally discard the current local compliance changes so the repo state is clean before the next feature branch starts
- Perform full manual applicant data-entry test after wiping applicant test data
- Manually verify applicant `View application` from the dashboard after the applicant/recruiter view split
- Manually verify recruiter bootstrap flow strictly through the UI after a controlled reset
- Manually verify recruiter reset-email flow end-to-end from received email to new password
- Verify `Coordinator` restricted access against intended product behavior
- Validate the recruiter export/reporting flows against the live backend
- Verify the prospect invite / bounce recovery flow against a real recruiter account

## Medium Priority

- Do a full branding consistency pass beyond the applicant header/dashboard
- Create a recruiter admin runbook for resets, bootstrap, role changes, and password recovery
- Create a DB operations runbook for common resets and cleanup flows
- Add automated verification around the client-form writer once the interface is stable enough
- Update the worksheet service `APP_URL` on Render from local/dev origins to the production frontend URL before go-live
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

## Implemented Locally But Not Yet Closed Out

- Applicant and recruiter login flows are split in the current local codebase
- Single-active-application enforcement is implemented in the DB and deployed to Supabase project `btbqdviuqcpauojmorvx`
- Edge-function wildcard CORS has been replaced by a shared `APP_URL` allowlist helper and deployed to Supabase project `btbqdviuqcpauojmorvx`
- Prospect schema foundation is implemented locally:
  - `countries`, `ranks`, and `vessel_types` lookup tables are seeded from the shared UI option lists
  - `prospects` includes the live email uniqueness, applicant uniqueness, first-contact, and activity tracking columns
  - `prospect_notes` is in place with recruiter-only visibility policies
- Requirements schema foundation is implemented locally:
  - `requirements` has generated display IDs, recruiter ownership checks, and lifecycle transitions
  - `requirement_nationalities` stores requirement country preferences as a junction table
  - `requirement_remarks` mirrors the internal note structure for requirement detail flows
- Junction/workflow foundation is implemented locally:
  - `prospect_requirements` stores the shortlist-to-join workflow
  - `applications.prospect_id` links applications back to the originating prospect
- Prospect-enrollment write RPC layer is implemented locally:
  - `add_prospect_note`, `edit_prospect_note`
  - `add_requirement_remark`, `edit_requirement_remark`
  - `create_prospect_with_requirement`, `attach_existing_prospect_to_requirement`
  - `transition_requirement_status`, `transfer_requirement_owner`
  - `transition_junction_status`, `bulk_withdraw_junctions`, `compute_should_prompt_close`
  - SQL review fixes landed locally for idempotent seeds, master-only visibility filtering, reopen cleanup, and signature/validation cleanup
  - workflow hardening landed locally for trigger-based prospect versioning, immutable junction assigners, and optional optimistic versions on bulk withdraw
- Recruiter prospect enrollment workspace is implemented locally:
  - prospect/requirement creation and attachment forms
  - note and remark entry forms
  - requirement and junction transition controls
  - recruiter nav entry and workspace route
- Recruiter shell redesign is implemented locally:
  - main nav now surfaces Dashboard, Workspace, KPI, Expiry, Calendar, Search, and Settings
  - dashboard is a compact executive snapshot
  - Workspace now splits requirements, candidates, and candidate pipeline
  - KPI is a dedicated reporting page
  - the legacy prospect route now redirects to the new workspace entry point
- Prospect-enrollment reporting and invite phase is implemented locally:
  - send invite RPC and bounce webhook
  - prospect / requirement deep-read RPCs
  - export buttons and recent-export reporting surfaces
  - requirement-specific compliance overlay on the submitted application view
- Recruiter-side application compliance review panel is implemented on `ViewApplication`
- Compliance phase 1 is implemented:
  - passport, CDC, visas, CoC, GMDSS, medical fitness, vaccinations, STCW/security courses, flag-state endorsements, and sea-service gap checks
- Compliance phase 2 is implemented:
  - ratings-specific watchkeeping / able-seafarer evidence checks
  - tanker / gas / passenger / IGF applicability checks from preferred vessel type plus sea-service history
- Recruiter applications list now has:
  - compliance status badges
  - compliance filtering
  - compact red / amber / green rollups

## Recommended Start-Here Order

1. Cleanly commit the current local compliance/docs changes
2. Do worksheet export validation against the second customer template
3. Run the manual applicant/recruiter QA flows
4. Decide whether compliance should also persist a snapshot for dashboard/search/submission-time use

## Definition of Done For Major Changes

- relevant docs updated
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes when applicable
