# Pending Tasks

## Ordered Product Backlog

This is the implementation order for the agreed target flow. `docs/recruitment-flow.md` is the workflow contract; `docs/needle-integration.md` is the search/integration contract. None of these milestones is complete merely because an older prospect, application, or AI-search screen exists.

1. **Production baseline and decisions:** audit live migration objects/history and outstanding production security fixes before new schema work. Define a single seeded organization for the first case slice, with platform-owner support permissions separate from the organization's recruiter roles. Verify live state before rerunning any migration or deployment.
2. **Recruitment case v1 for the current organization:** add `organization_id` to new case/event tables, one active candidate-requirement case, event history, contact, test pass or reasoned waiver, interview outcomes, recruiter selection, offer, and documents. Migrate existing prospect/junction/application links additively; move test/interview controls off `applications.status`, remove free status skipping from the new case control, and preserve KPI/report parity. Fix invite claiming so the token identifies the intended prospect and organization rather than selecting by email alone. Full multi-organization access, principal handoff, and principal-decline outcomes are not prerequisites for this slice.
   - *Progress 2026-11-04 (`ui/warm-theme`, not deployed):* slice 1 — the requirement page shows a **Recruitment cases** panel (cases for that requirement, allowed next steps, reasoned exits, one-time triage of backfilled `legacy` cases, start a case for a linked candidate, per-case event history). It calls only the case v1 (`0221`) RPCs, renders nothing where the case tables do not exist, and is read-only for Coordinators. `tests/recruitmentCase.test.mjs` checks the client transition map against the migration. Renumbered 2026-11-04: case v1 is now `2026110221` and the expiry fix `2026110222`, after the applied `0209`-`0220`. Staging migration history was repaired from `0207` to `0221` without executing SQL; cases/events stayed at 3/13, and staging dry run listed only `0222`. The branch was pushed to GitHub at `a529b28` before the next local build.
   - *Assessment/KPI slice (staging only):* `0223` records required timestamps for test/interview schedules and outcomes in append-only case event payloads, with reasons for failed/no-show results. The case panel collects and displays these details. KPI Overview reads case counts and assessment outcomes from cases/events; the chart and funnel CSV use current case stages where available, while legacy requirements/contact/application metrics remain in place. An isolated staging dry run listed only `0223`; it was applied to staging without applying the pending `0222` expiry fix. On synthetic requirement `0565f1ff-13af-4403-8360-f4124b8a26c1`, the recruiter scheduled and passed a test, scheduled and passed an interview, and reloaded to confirm the case stage and History details persisted. KPI Overview showed the case counts and pass rates; Charts showed the case-stage distribution. Failed/no-show and Coordinator write denial were covered by local SQL tests, not this browser smoke. Nothing in this slice is applied to production. Still pending: case-sourced parity for all existing KPI/report metrics, removing duplicate attached-prospect UI and legacy test/interview controls, long-form invite/principal-send actions, and F3 invite claim.
   - *Staging smoke blocker 2026-11-04:* attaching a synthetic prospect to requirement `0565f1ff-13af-4403-8360-f4124b8a26c1` initially failed at `audit_log_typed_fk_check`. `2026110220_allow_related_audit_context.sql` corrects the audit constraint, passed its local regression test, and is applied to staging only. Live constraint readback, a clean staging dry run, and the attachment retry passed. It is not applied to production.
   - *Staging rerun:* the attachment and case-panel checks A–E/G passed. F (stale-tab conflict) was inconclusive because tab 2 refreshed before submitting a stale version. L then passed after two local UI fixes: Previous employer is conditionally required before saving, and candidate names in the Unattached tracker link to detail. The synthetic candidate attached to the only eligible open requirement; a second attach offered no duplicate. A temporary staging Recruiter-to-Coordinator role switch confirmed H and M: the panel says read only, History is visible, and create/edit/close/archive/delete/attach/case-action buttons are absent. Coordinator Dashboard opens on Whole team, but its Open KPI link leads to "KPI analytics is restricted" (K fails for Coordinator). The account was restored to Recruiter and verified in the staging database. J and Master-role K remain untested; use a dedicated synthetic Master account rather than temporarily promoting the only account. No case migration or audit repair is applied to production.
   - *Do at case v1 production rollout (owner decision 2026-11-04):* the requirement page shows the same candidates twice, in "Recruitment cases" and in "Prospects attached to this requirement" (`prospect_requirements`). Once case v1 (`0221`) is live in production and recruiters move candidates through cases, replace the attached-prospects list with the cases panel and route attach/start-case through `recruitment_case_open`, so one record drives the page.
   - *Do with case v1 (decided 2026-11-05, from the manning company's KPI workbook v2):* the workbook closes a requirement only when every required position has joined, and dates the close to the last joining date. Holmes closes on a recruiter's click and dates it to the click, which skews closure %, on-time status and days to close. When joins come from cases, close the requirement automatically on the last join (dated to that join) and decide whether a manual close with open positions stays allowed. Until then the Dashboard lists "fully joined but still open" requirements and Close asks for confirmation when positions are still open.
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

- SECURITY DEFINER audit: `0209` through `0213` are applied on staging and production. `0212` closed the three remaining unscoped global-count/close-prompt reads and made role predicates self-only; `0213` stopped Coordinators receiving prospect notes via the detail RPC and filtered historical note/remark activity. All 33 callable entries remaining after `0211` were reviewed by caller path; 11 + 9 new PGlite checks and production schema readback passed. Live role-based UI smoke remains to be done, as does the wider RLS/storage audit. Preserve the current `is_recruiter_profile(uuid)` contract until multi-tenant constraints are redesigned. Do not apply the wider expiry migration (`0222`, formerly `0208`) merely as a security patch. See `docs/security-definer-audit-2026-11-03.md`.
- RLS/storage audit (2026-11-04): `0214`-`0219` are applied to staging and production; production policy readback shows zero direct calls to revoked `check_permission`. Regression checks and rollback-only role/storage probes passed. Signed-in staging Recruiter, temporary Coordinator, and temporary Master UI reads passed for applications and protected photos; Coordinator decision controls were absent. A Coordinator Calendar denial was fixed locally. Public-route smoke passed 6/6. **Open:** signed-in applicant and direct API write-denial tests, offer-letter function behavior, misleading photo-token policy, post-submit photo changes, broad profile reads, and anonymous HTTP/storage behavior. Staging recruiter INSERT smoke remains unverified. See `docs/rls-storage-audit-2026-11-04.md`.
- Security follow-up after `2026110200` (applied 2026-11-02): smoke-test recruiter login/profile reads, applicant magic-link profile creation, public catalog reads, and the service-role magic-link request path without changing real candidate data. Review remaining Data API tables, exposed functions/views, storage policies, and access logs; the 13-table fix does not prove whole-project isolation. Keep automatic exposure of new tables off. Move internal tables physically to a private schema only after updating their Edge Function/RPC references and testing those paths.
- Confirm `2026071101_application_status_history.sql` objects and trigger are present in live schema; historical notes say this was deployed, but the backlog was not reconciled.
- Schedule `process-expiry-warnings` to run daily (Supabase Dashboard → Edge Functions → schedules, or pg_cron); until then it only runs from the new "Send expiry warnings" button on the Expiry page — also confirm the function is deployed to the live project

- Audit ALL migrations from before the schema-only baseline for silently-missing objects: confirmed victims so far are the reference seeds (fixed by 2026071001), lookup RLS state (2026071002), the legacy status-history trigger/table (2026071101/2026071103), and applicant_magic_link_requests (2026071104). Compare each pre-baseline migration's objects against the live schema (`supabase db diff` or dashboard) and replay what's missing
- Read-only catalog audit on 2026-11-03 found eight missing June migration functions plus the `prospect_email_webhook_events` table and `prospects.invited_by_recruiter_id` column/index despite matching migration history. The focused `0205` repair and `0206` audit-action compatibility fix are applied to staging and production, and both migrations/tests are now on pushed `main` (`2c074dd`). Staging invite/email-correction UI paths passed; one labelled synthetic production invite was delivered according to Resend and produced an `invite_sent` audit row. Production email correction, bounce delivery, and requirement deletion have not been smoke-tested. The production and staging `public` schema-only dumps matched byte-for-byte after staging-only grant alignment, before the staging-only case migration. Keep the webhook table private and retire the email-only applicant claim helpers under F3. `supabase db diff --linked` still cannot replay history without the pre-migration `public.user_roles` baseline; reconstruct it and audit `auth`/`storage` separately. Case v1 (`0221`, applied on staging as `0207`) is now applied and database-tested on staging only; production remains unchanged. Finish recruiter UI/invite/claim/worksheet/KPI integration and review before production; see `docs/production-baseline-audit.md`.
- The production invite smoke used an owner-controlled address but its subject still says NJORD Ships. Align the deployed invite email branding with Holmes when updating the email functions; do not change the existing customer-specific wording without reviewing the tenant branding design.
- `0211` removed anonymous access to legacy `user_has_permission` and limited `has_permission` to the caller's own user ID (except service role), preserving RLS. Production also exposes `get_application_for_review` anonymously for its token-gated public review flow. Reassess these contracts when expanding RBAC; the repaired invite/bounce functions remain server-only.
- Data integrity finding 2026-07-10: the remote DB was reconstructed from a schema-only baseline at some point, so seed data inside migrations (RBAC permission grants, countries, ranks, vessel_types) was silently missing; `2026071001_reseed_reference_data.sql` re-applies all seeds idempotently. Audit any other data-bearing migrations if odd gaps appear.
- Migration hygiene RESOLVED 2026-07-10: the Tools clone had renamed `2026060308_deep_read_reports.sql` → `2026060312` (commit `714fe7e`) and applied it remotely; the same rename is now done in this repo, eliminating the duplicate `2026060308` and identifying the "unknown" remote `2026060312`. Two docs-only commits (`714fe7e`, `a9bcaf1`) and a small uncommitted `ProspectEnrollment.jsx` tweak remain only in the stale Tools clone — review/discard, then delete that clone to prevent future confusion
- SECURITY: production `RESEND_API_KEY` was replaced on 2026-11-03 with a separate sending-only Resend key. A production function sent a fake-reference test email to the owner, who confirmed receipt; Resend showed activity on the new key. The prior production secret matches the stale local `.env.local` key, which Resend now rejects as invalid. Keep the staging key active by owner decision. Before local email testing, replace or remove the stale local key; consider purging the old hardcoded key from git history.
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
- Holmes staging applicant smoke (2026-11-03) passed: draft save and photo upload persisted; synthetic application NJD-985347 submitted, appeared for the recruiter with its photo, and became read-only. A newly issued token-hash link opened the dashboard with PKCE retained; a first-time approved applicant also signed in after self-service sign-ups were disabled. The 0204 guard allowed draft creation and a rollback-only submit transition.
- Decide what happens to existing applicant accounts created via Google OAuth (can they still redeem magic links against the same profile?)
- Perform full manual applicant data-entry test after wiping applicant test data
- Manually verify applicant `View application` from the dashboard after the applicant/recruiter view split
- Manually verify recruiter bootstrap flow strictly through the UI after a controlled reset
- Manually verify recruiter reset-email flow end-to-end from received email to new password
- Verify recruiter recovery from an applicant-signed-in browser after the recovery-page routing fix; use a real recruiter mailbox, not an applicant email
- Coordinator read-only application workflow: `0216`-`0219` are live on staging and production; UI and four functions have editor checks. Rollback-only role simulation and signed-in staging Recruiter/Coordinator/Master application and protected-photo UI reads passed. Coordinator Calendar read-only access was fixed locally. Applicant path, direct API write denial, offer-letter download/function behavior, and invitation denial remain pending. Do not run the default production-writing smoke harness for this check.
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
  - main nav now surfaces Dashboard, Workspace, Requirements, Candidates, KPI, Expiry, Calendar, Search, and Settings (KPI/Settings permission-gated; Expiry hidden for Coordinator; Calendar read-only for Coordinator)
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

## Pending: Staging Smoke For The UI Audit Changes (recorded 2026-11-04)

The UI audit batches (2a, 2b, 3 and the section 2 trims, commits `ac6bd8e`..`258c1e5` on `ui/warm-theme`) passed lint, build and unit tests and were only partly checked in a local harness. None of it has been smoked on staging or pushed. Run this on staging before pushing or deploying. Details per commit: `docs/ui-audit-2026-11-04.md`, "Progress".

Recruiter, highest risk first:
- [ ] Reject from the status menu, from a failed test and from a failed interview: status saves, reason and notes show in the one-line banner, the candidate email has a neutral reason sentence (no raw code, no internal notes).
- [ ] Pass an interview: overall rating required; the candidate email no longer contains the recommendation.
- [ ] Test/interview scheduling and result emails now call the staging project's edge functions (`30a0f8d`). Staging has guarded `send-rejection-email`, `send-interview-passed`, and `send-test-retake-approved`, plus test/interview invitation functions using the configured `APPLICANT_NOTIFICATION_EMAIL` staging inbox override. An unsigned probe returns 401. On 2026-11-05, synthetic `NJD-985347` passed an interview and remained `interview_passed` after reload. Authenticated pass/rejection/retake function probes returned success. Synthetic `STAGE-DRAFT-001` then moved through scheduled test, passed test, scheduled phone interview, and failed interview in the staging UI; it persisted as `rejected` with reason `Failed interview` and the SMOKE note. The owner confirmed receipt and neutral wording of the rejection email, with no internal SMOKE note or raw reason code. Resend records the passed-interview and retake probes as delivered to the owner inbox and later opened, but the owner could not find either message in Gmail; inbox visibility is not confirmed. The retake probe used an inert `example.invalid` link, not a live retake flow. Coordinator denial remains to be checked; the frontend change is local only, not deployed to production.
- [ ] Recruiter-side staging UI sweep (2026-11-05): Applications stage counts, Closed row, compliance badges, AI/Filters panels, Dashboard, KPI Overview/Reports, Settings tabs/Team, and Expiry empty state loaded. The expiry warning button asked for confirmation and was cancelled; no warning was sent. Synthetic requirement `c4e1e197-2b85-4339-a89a-d23e2a109909` was created, edited (target days 30 to 31), closed after the open-position confirmation, then archived; Delete appeared only after closure and was not used. An open requirement's edit form offered Open/Closed, not Cancelled. In the local source, new requirement/candidate recruiter assignment is now restricted to Master Recruiter, and new phone/in-person interviews no longer receive a video-platform label. The local staging worksheet service was started at `127.0.0.1:8766`; generating the worksheet for submitted `NJD-985347` then returned HTTP 200 and downloaded a valid `.xlsx` archive. The service was stopped after the check. Template fidelity and prefilled-cell overwrite behavior remain untested. The existing phone event still displays its old Teams label. Coordinator/Master checks, a fully joined requirement, needs-action cards, Send reset email, Add/Edit member, and applicant-side checks remain open.
- [ ] Requirement closure guard (`9cf390c`): Close on a requirement with open positions asks to confirm; a fully joined open requirement shows on the Dashboard card.
- [ ] Requirement detail: "More" menu; Cancel asks for a reason and succeeds; Archive; Delete; Close; edit form has no Cancelled option for an open requirement; vessel name shows.
- [ ] Applications list: stage chips (Active, Review, Test, Interview, Offer, Closed) and counts; Closed loads hired/rejected/withdrawn; compliance badges filter; AI search and Filters panels; `?status=` links from the Dashboard.
- [ ] Dashboard: needs-action cards for a Recruiter and for the Master (whole team / one recruiter); KPI no longer shows "Needs action"; conversion in the KPI exports names the period.
- [ ] Application detail: one compliance panel (with and without a linked requirement), worksheet modal generates a file, no "undefined" in physical details.
- [ ] Settings: tabs and Team list loaded in staging; Add/Edit forms opened without submitting. The Edit form and `create-recruiter` function now enforce an 8-character replacement password locally, before any account write. `create-recruiter` was deployed to staging via the Supabase API; its status call returns HTTP 200 with zero Master Recruiters, and a short-password bootstrap probe returns HTTP 400 without creating an account. Synthetic Add/Edit and reset email remain untested. Do not change a real account for this smoke.
- [ ] Requirements and Candidates lists: Filled and Days open columns, stage dropdown, Joined column, "Added by" only for Master.
- [ ] Expiry at `/recruiter/expiry` loaded an empty state; old `/dashboard/expiry` redirected correctly. Send expiry warnings asked for confirmation and was cancelled, with no email sent. Populated Document/Days rows and a synthetic warning send remain untested.
- [ ] Coordinator: still read-only everywhere above. A separate synthetic staging Coordinator identity at `kartik.neuralnet@gmail.com` was invited and its recruiter profile/Coordinator role verified on 2026-11-05. The invite was never claimed; the account was reversibly banned until 2027-11-05 so unused access does not remain open. Browser controls and Coordinator denial of the new email functions still need a normal sign-in smoke after temporarily re-enabling this account. Do not use an admin-generated session to bypass the invite.

Applicant:
- [ ] Draft: dashboard → Continue opens the first incomplete section → Previous/Next through the form → Review lists incomplete sections as links → Submit.
- [ ] New application from a submitted one: prefilled, without declarations, signature or availability date.
- [ ] Long form: Sections 10, 13 and 19 without the removed fields; old submitted applications still show their stored values.
- [ ] Sign-in pages, `/unauthorized`, `/recruiter/setup` (locked state).
- [ ] `/unauthorized` showed "No access" and one Sign in button on staging. The local setup page now fails closed with Retry if its status call fails; a mocked browser regression covers unavailable and locked states. After deploying `create-recruiter` to staging, the live status call succeeds but reports zero Master Recruiters, so `/recruiter/setup` correctly shows Create admin account there. A locked-state live check still requires a synthetic Master Recruiter; do not bootstrap production or change a real account for this test.

## Immediate Next Slice

Start with milestone 1 in the ordered backlog, then the single-organization recruitment case v1 in milestone 2. Carry a seeded `organization_id`; do not wait for full multi-organization access work to correct the case flow. Existing worksheet and manual QA items above can be verified separately, but they do not replace that redesign.

## Definition of Done For Major Changes

- relevant docs updated
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes when applicable
