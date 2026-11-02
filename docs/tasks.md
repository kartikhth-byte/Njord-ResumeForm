# Pending Tasks

## Ordered Product Backlog

This is the implementation order for the agreed target flow. `docs/recruitment-flow.md` is the workflow contract; `docs/needle-integration.md` is the search/integration contract. None of these milestones is complete merely because an older prospect, application, or AI-search screen exists.

1. **Production baseline and decisions:** audit live migration objects/history and outstanding production security fixes before new schema work. Define a single seeded organization for the first case slice, with platform-owner support permissions separate from the organization's recruiter roles. Verify live state before rerunning any migration or deployment.
2. **Recruitment case v1 for the current organization:** add `organization_id` to new case/event tables, one active candidate-requirement case, event history, contact, test pass or reasoned waiver, interview outcomes, recruiter selection, offer, and documents. Migrate existing prospect/junction/application links additively; move test/interview controls off `applications.status`, remove free status skipping from the new case control, and preserve KPI/report parity. Fix invite claiming so the token identifies the intended prospect and organization rather than selecting by email alone. Full multi-organization access, principal handoff, and principal-decline outcomes are not prerequisites for this slice.
3. **Long-form and worksheet gates:** permit an explicit invite after a passed interview without requiring selection; keep email sends separate from case changes. Before enabling pre-selection invites, disclose that completing the form does not imply selection and approve retention/deletion for unselected candidates' sensitive form data. Candidate reviews reliable prefill and submits in parallel with later case steps. Permit generation/download after submission regardless of offer or documents; enforce the submitted-form minimum in the UI and worksheet service. When principal handoff is implemented, confirm the first-slice working assumption: recording a manual send is separate and requires form submission, offer acceptance, and verified documents, capturing actor, time, recipient, channel, and worksheet version. This does not prevent external email. Decide the principal-decline reason taxonomy before implementing that outcome.
4. **Multi-tenant foundation before shared access:** add organizations and memberships; backfill existing rows without changing their meaning; add organization ownership and published/private state to requirements. Implement and test RLS, storage/API scopes, and distinct audited platform-owner support privileges with two isolated test organizations before onboarding another organization or exposing shared candidate/search views.
5. **Candidate/resume identity and dedup:** define provisional Needle resume records versus candidate-owned portal profiles, resume versions, provenance/source history, claim/merge review, consent, and idempotency. Disable Needle's automatic person merge on email, phone, or name+DOB for Holmes intake; propose links for review and keep them reversible. Test exact re-upload, revised resume, shared phone, ambiguous matches, account claim, and cross-organization privacy.
6. **Candidate portal and inbound-first recruiter views:** candidate-owned profile/resume and availability; published cross-organization job listings and lightweight job interest; requirement Interested queue and Candidates Available queue with Source/provenance, freshness, consent, and direct add-to-case. Keep the existing candidate KPI tracker accessible during the UI transition.
7. **Needle discovery fallback and upgrade channel:** verify whether Needle tables/keys share the live Holmes database, then isolate Needle in its own project or schema before integration. Establish rights, organization-of-origin scope, opt-out/deletion, and candidate opt-in before exposing any imported/scraped resume in a shared directory. Run the independently maintained engine behind a versioned authenticated contract; deliver the recruiter AI tab, requirement `Match resumes`, and candidate-facing job search. Pin a tested Needle release and run contract/evaluation tests for upgrades; keep Seajobs download/local-agent tooling out.
8. **Organization onboarding and wider rollout:** expose only each manning organization's requirements and authorized case data in any organization-facing view; complete onboarding, branding/template ownership, tenant isolation, and operational runbooks before adding organizations. A principal portal is out of current scope.

## Review Risks To Track

- **Needle identity (F2):** its current automatic merge on a single email/phone signal or name+DOB must not become a Holmes person merge. Use reviewed, reversible links and test two people sharing contact details.
- **Invite claim (F3):** bind redemption to the signed invite's prospect and organization, not the newest prospect with the same email; test two organizations inviting one address.
- **Existing resume rights (F4):** do not import scraped/operator-held resumes into a cross-organization Available directory without a lawful basis, source scope, opt-in, and deletion/opt-out path.
- **Database boundary (F5):** inspect the live Supabase project for Needle tables and separate service keys/schema ownership before connecting either system.
- **Sequencing (F7):** case v1 uses a seeded `organization_id` first; complete and test multi-organization isolation before the second organization or shared portal/search access.

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

- Will organizations use separate deployments or one shared Holmes deployment? Case v1 carries `organization_id` either way; choose before the multi-organization isolation slice and onboarding.
- Which candidate profile and resume fields may each organization see before and after a direct job application? Define consent and revocation behavior before a shared directory ships.
- How long are passport, medical, bank, and next-of-kin fields retained when a candidate completes the long form but is not selected, and what deletion/export rights apply? Obtain an approved candidate-facing notice and retention policy before early invites ship.
- Confirm the first-slice manual-send attestation and `principal_declined` reason taxonomy. Should Holmes later send worksheets to principals itself? Automated delivery requires a separately approved principal-contact and messaging design.
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

Start with milestone 1 in the ordered backlog, then the single-organization recruitment case v1 in milestone 2. Carry a seeded `organization_id`; do not wait for full multi-organization access work to correct the case flow. Existing worksheet and manual QA items above can be verified separately, but they do not replace that redesign.

## Definition of Done For Major Changes

- relevant docs updated
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes when applicable
