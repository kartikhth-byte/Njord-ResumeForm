# Pending Tasks

## Ordered Product Backlog

This is the implementation order for the agreed target flow. `docs/recruitment-flow.md` is the workflow contract; `docs/needle-integration.md` is the search/integration contract. None of these milestones is complete merely because an older prospect, application, or AI-search screen exists.

1. **Production baseline and decisions:** audit live migration objects/history and outstanding production security fixes before new schema work. Decide organization ownership, operator access, candidate visibility/consent, and who authorizes selection/customer submission. Verify live state before rerunning any migration or deployment.
2. **Multi-tenant foundation:** add organizations and memberships; backfill the current customer without changing existing rows' meaning; add organization ownership and published/private state to requirements. Implement and test RLS, storage/API scopes, and explicit operator privileges for two isolated test organizations.
3. **Candidate/resume identity and dedup:** define provisional Needle resume records versus candidate-owned portal profiles, resume versions, provenance/source history, claim/merge review, consent, and idempotency. Test exact re-upload, revised resume, ambiguous person matches, account claim, and cross-company privacy.
4. **Correct the pre-form recruitment flow:** implement one active candidate-requirement case with entry source, event history, contact/availability, test/interview outcomes, and explicit selection. Migrate existing prospect/junction/application relationships additively; move test/interview controls off the long-form `applications` status flow. Preserve historical rows and KPI/report compatibility.
5. **Gate the long form and worksheet:** permit an explicit invite only after both test and interview pass plus selection; keep email sends separate from status changes. Candidate reviews reliable prefill, completes missing fields, and submits the long form for customer Excel generation. Verify invite claim, permission, audit, export fidelity, and rollback.
6. **Candidate portal and inbound-first recruiter views:** candidate-owned profile/resume and availability; published cross-company job listings and lightweight job interest; requirement Interested queue and Candidates Available queue with Source/provenance, freshness, consent, and direct add-to-case. Keep the existing candidate KPI tracker accessible during the UI transition.
7. **Needle discovery fallback and upgrade channel:** run the independently maintained Needle engine behind a versioned authenticated contract; deliver the operator AI tab, requirement `Match resumes`, and candidate-facing job search over published requirements. Pin a tested Needle release per environment and automate contract/evaluation tests for periodic upgrades; never auto-deploy Needle `main`. Keep Seajobs download/local-agent tooling out. Validate ranking, evidence, unknowns, cost/latency, tenant boundaries, and recruiter judgments on a reviewed corpus before cutover.
8. **Customer portal and wider rollout:** expose only each organization's requirements and authorized submissions/decisions; complete onboarding, branding/template ownership, tenant isolation, and operational runbooks before adding customers.

## Existing Production And QA Checklist (Revalidate Status)

The items below predate this roadmap. Some may already be deployed or superseded; confirm against live state and current code before acting. In particular, do not blindly push old migrations or repeat data-changing QA on production.

- Confirm `2026071101_application_status_history.sql` objects and trigger are present in live schema; historical notes say this was deployed, but the backlog was not reconciled.
- Schedule `process-expiry-warnings` to run daily (Supabase Dashboard → Edge Functions → schedules, or pg_cron); until then it only runs from the new "Send expiry warnings" button on the Expiry page — also confirm the function is deployed to the live project

- Audit ALL migrations from before the schema-only baseline for silently-missing objects: confirmed victims so far are the reference seeds (fixed by 2026071001), lookup RLS state (2026071002), the legacy status-history trigger/table (2026071101/2026071103), and applicant_magic_link_requests (2026071104). Compare each pre-baseline migration's objects against the live schema (`supabase db diff` or dashboard) and replay what's missing
- Data integrity finding 2026-07-10: the remote DB was reconstructed from a schema-only baseline at some point, so seed data inside migrations (RBAC permission grants, countries, ranks, vessel_types) was silently missing; `2026071001_reseed_reference_data.sql` re-applies all seeds idempotently. Audit any other data-bearing migrations if odd gaps appear.
- Migration hygiene RESOLVED 2026-07-10: the Tools clone had renamed `2026060308_deep_read_reports.sql` → `2026060312` (commit `714fe7e`) and applied it remotely; the same rename is now done in this repo, eliminating the duplicate `2026060308` and identifying the "unknown" remote `2026060312`. Two docs-only commits (`714fe7e`, `a9bcaf1`) and a small uncommitted `ProspectEnrollment.jsx` tweak remain only in the stale Tools clone — review/discard, then delete that clone to prevent future confusion
- SECURITY: rotate the Resend API key that was hardcoded in `test-email.js` (now env-based, but the old key lives in git history and must be treated as compromised); consider purging the file from history
- Manually verify the repaired PDF export (`jspdf-autotable` v5 `applyPlugin` fix) on prospect and requirement detail pages against the live app
- Decide whether the plain `Recruiter` role should be granted `export_csv` (currently Master-only, so export buttons are hidden for recruiters on tracker/KPI pages)
- Repo cleanup commit: remove tracked junk (`{`, `Create`, `test-email.js` if unneeded), six `.backup*` files, and dead pages (`RecruiterDashboard.jsx` 1,570 lines unrouted — `RecruiterDashboardSimple.jsx` is the routed dashboard, `RecruiterApplications_old.jsx`, `ProspectEnrollment.jsx`); also drop the vestigial `:dashboardTab?` route param

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
- Delete the TEST requirement `2026-Jul-001` (TEST MV Ocean Star) created during the 2026-07-10 browser validation once no longer needed
- Verify the new applicant magic-link login end-to-end: `request-applicant-magic-link` edge function deployed to the live project, email delivery, link redemption through `/auth/callback`, and applicant dashboard access (Google login was removed from the applicant UI)
- Decide what happens to existing applicant accounts created via Google OAuth (can they still redeem magic links against the same profile?)
- Perform full manual applicant data-entry test after wiping applicant test data
- Manually verify applicant `View application` from the dashboard after the applicant/recruiter view split
- Manually verify recruiter bootstrap flow strictly through the UI after a controlled reset
- Manually verify recruiter reset-email flow end-to-end from received email to new password
- Verify `Coordinator` restricted access against intended product behavior
- Validate the recruiter export/reporting flows against the live backend
- Verify the prospect invite / bounce recovery flow against a real recruiter account

## Medium Priority

- Define how additional customers are onboarded: deployment model, customer data isolation, recruiter access, branding, email sender, and worksheet template ownership
- Review the legal pages for the roles and contact details of the Holmes operator and customer recruiting organizations before wider customer rollout
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

- Will customers use separate deployments or one shared Holmes deployment? The ordered backlog assumes organization-scoped data and authorization either way; choose before schema work.
- Who records the final selection after test and interview, and at what point is a candidate submitted to the customer? The long-form invite gate is fixed; the later customer/offer sequence needs sign-off.
- Which candidate profile and resume fields may each organization see before and after a direct job application? Define consent and revocation behavior before a shared directory ships.
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
  - main nav now surfaces Dashboard, Workspace, Requirements, Candidates, KPI, Expiry, Calendar, Search, and Settings (KPI/Settings permission-gated; Expiry/Calendar hidden for Coordinator to match route guards)
  - dashboard is a compact executive snapshot
  - Workspace now splits requirements, candidates, and candidate pipeline
  - Candidate Pipeline now uses application statuses (`under_review` through `withdrawn`) and hides the version field from the recruiter UI
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
- Crew recruitment KPI tracker pages are implemented locally:
  - `/recruiter/requirements` requirements tracker (joins, open positions, ageing, on-time status)
  - `/recruiter/candidates` candidate funnel (derived stage, days to join, active pipeline, cycle completion)
  - `/recruiter/kpi` rebuilt as the live management dashboard (closure %, conversion %, daily activity, pipeline by stage, requirement ageing, recruiter scorecard)
  - shared derivation lives in `src/utils/kpiTracker.js` with data loading in `src/hooks/useKpiTrackerData.js`
  - still needs manual validation against live recruiter data on Vercel

## Immediate Next Slice

Start with milestone 1 in the ordered backlog: reconcile the live production baseline and resolve organization ownership/visibility. Existing worksheet and manual QA items above can be verified separately, but they do not replace the pre-form flow redesign.

## Definition of Done For Major Changes

- relevant docs updated
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes when applicable
