# Holmes - Platform PRD

## In-app problem reporting (2026-11-13)

Signed-in users can report a visible UI defect with two clicks: floating movable
＋ captures the visible app, then Send. A description is optional. The screenshot
preview supports cancellation or replacement upload. Private screenshots expire
after seven days; report details and status remain. Operators review reports;
users see their own. No new issue-tracking subscription is required. Capture loads
on demand, with explicit limits for native PDFs and inaccessible frames. See
`PROBLEM_REPORTS_2026-11-13.md` for the local implementation and release gates.


## Application form ownership — current clarification (2026-11-12)

Long forms are invited during requirement-linked recruitment. Every newly created
form must retain the exact invited recruitment case; completing the form does not
select or infer a requirement. When several invitations are eligible, the applicant
chooses the requirement explicitly. Applications shows submitted forms by Company
and Ship, with requirement links. Historical missing links are correction exceptions,
not an alternate entry workflow. A linked draft remains in progress until submitted.


## Recruitment workspace (2026-11-12)

Recruitment owns per-candidate/requirement task work and stage actions. Candidates owns profile/CV/attachment; requirement details link to Recruitment. Broad stages are display groups of existing case statuses. Task assignment and due dates are independent of row ownership. Signed-in actor is immutable; actual performer may be recorded separately. KPI distinguishes current workload, performer activity and original-creator sourcing cohorts.

## Candidates directory (2026-11-11)

- Add candidate is an inline basic-details form above two tabs: Unattached and Attached.
- Saving without a CV is allowed. Name and either email or international phone
  are required. CV-less records remain drafts until reviewed résumé conversion;
  they cannot be attached to a requirement.
- Attached hierarchy is Company → Ship → Candidates. A candidate appears once
  per ship, with all matching requirements and their stages in one column. The
  same person under different ships links to the same profile.
- Unattached means no active case on an open requirement. Completed/closed case
  history remains available through the Attached history selector. Counts are
  unique people, not cases or rendered rows.
- Search and filters persist through reload and profile Back navigation; company,
  ship, requirement and case-stage filters must match the same attachment.
- Role permissions apply to Add/Edit/Attach. Coordinators may read basic draft
  details without gaining access to private recruiter notes. Optional CV upload
  follows the existing intake availability gate.

## Requirements and Candidates separation (2026-11-10)

Requirements lists requirements grouped by company and ship, with matching and
an attached-candidate count linking to Candidates. Candidate lists belong on the
Candidates page; each row shows its attached requirements and their company,
ship, rank and recruitment stage. A search match alone creates no profile or case.
Reviewed Attach reuses an existing identity, asks about possible duplicates, or
creates a candidate using the already stored résumé. Existing-source attachment
is independent of new uploads and automatic intake.


## Product Summary

Holmes is the recruiter workflow automation part of an owner-operated maritime recruitment platform. The candidate portal will own candidate-maintained profiles and job discovery; Needle will power candidate job search and recruiter candidate/requirement matching. Holmes handles the requirement-to-hire workflow and the detailed post-interview form used for Excel worksheets sent to the principal.

Njordships is a customer organization (a manning company), not the operator. The product is intended to serve additional organizations without changing the Holmes product identity. A principal is an organization's client, such as a shipowner, and receives the Excel worksheet. The deployment and data-isolation model for multiple organizations is not yet decided.

The **operator** is the Holmes owner, not an organization recruiter. Organization staff use the **recruiter app** and its recruiter AI workspace; platform-owner support access is separate and audited.

## Primary User Groups

### Applicants

- authenticate through invite-only emailed magic links in the current form flow
- create and manage maritime application drafts
- complete the current 19-section application form after a passed interview, when explicitly invited
- submit applications and track progress

### Recruiter-Side Users

- authenticate with email/password
- search and review applicants
- manage pipeline/status workflows
- schedule interviews and related actions

## Recruiter Roles

### Master Recruiter

- full recruiter admin
- manages recruiter accounts and roles
- manages team access and settings
- can operate the full recruiter workflow

### Recruiter

- full operational recruiter
- can review, search, schedule, and move candidates through pipeline
- cannot manage recruiter accounts/settings

### Coordinator

- limited support role
- can view KPI Overview and Charts, but cannot generate or download reports without a separate export permission
- can view applications, statuses, scheduled events, photos, and offer letters
- cannot change applications or statuses, schedule events, upload or alter photos/offer letters, or send workflow invitations
- cannot manage recruiter accounts/settings

## Core Product Areas

### 1. Applicant Intake

- invite-only magic-link login for the current long-form workflow
- draft creation
- form autosave
- review and submission flow
- post-submission status visibility

### 2. Recruiter Operations

- recruiter dashboard
- application workspace
- advanced search
- pipeline/status progression
- scheduling flows

### 3. Recruiter Administration

- first-time setup via `/recruiter/setup`
- team management
- role assignment
- password reset support

### 4. AI/Advanced Search

- Needle-powered AI workspace in Holmes: projects, chats, staged/refined searches, manual filters, ranked resume results, evidence, feedback, and review actions
- a requirement-level `Match resumes` action that searches the same pool and explains rankings against the saved requirement
- one canonical resume pool across Needle, direct intake, candidate-portal intake, and later organization-website intake; applications are downstream records, not a duplicate search corpus
- a pre-form recruitment case for matched candidates: recruiter contact and availability confirmation, test pass or reasoned recruiter waiver, interview pass, then an explicit invitation may be sent to complete the Holmes form while later case steps continue; the form is required before worksheet delivery
- a future candidate portal where candidates maintain their own profile/resume, see requirements published by manning companies, and express interest/apply to jobs without completing the long worksheet form at that point
- the existing long Holmes application remains a post-interview data-collection form, prefilled where reliable from resume facts and completed by the candidate. Tell the candidate that form completion does not mean selection; the retention period for unselected candidates' sensitive data must be approved before rollout. A recruiter may generate/download its worksheet any time after form submission. After offer acceptance and verified documents, an authorized recruiter may record an outside-Holmes send to the principal; Holmes does not itself deliver or prevent an external email
- recruiters see direct interest on a requirement and consented available candidates without running a search; Needle search is an additional discovery route, and all routes enter the same recruitment case
- Seajobs downloading and local-agent tooling are excluded from the Holmes integration

See `docs/needle-integration.md` for the service boundary, delivery order, and release gates. This integration is planned, not yet shipped.

The authoritative target flow is in `docs/recruitment-flow.md`: direct job interest, an available candidate, or a Needle match enters one candidate-requirement case. Contact, test pass or recruiter waiver, and a passed interview precede an explicit long-form invitation; selection is not an invite prerequisite. The case then tracks recruiter selection, offer, offer acceptance, documents submitted, documents verified, a recruiter-attested manual worksheet handoff to the principal, and `hired` as the final Holmes state. The form can run in parallel after the interview but must be submitted before the worksheet is generated. Current prospect/application statuses do not yet implement this flow.

## Applicant Form Scope

The current applicant workflow is built around a 19-section form, covering:

- availability/application details
- personal/contact details
- passport
- CDC / Seaman's Book
- visas
- education
- dependents
- certificates of competency
- GMDSS certificates
- medical/vaccination
- medical history
- languages
- physical/uniform details
- STCW and marine courses
- flag state documents
- sea service
- experience summary
- references
- bank/emergency details
- declaration/consent

## Current Product Goals

- reduce recruiter time to identify viable maritime candidates
- maintain structured candidate records with maritime-specific qualifications
- support a clean split between applicant and recruiter experiences
- make recruiter account administration safe and explicit

## Current Non-Goals

- broad social-login support for applicants
- password-based applicant accounts
- a large recruiter role matrix beyond the 3-role model

## Current Product Constraints

- auth and role behavior are tightly coupled to Supabase Auth + database RBAC
- recruiter bootstrap depends on the `create-recruiter` edge function
- applicant protected-flow smoke depends on stored Google session capture

## Current Success Signals

- `lint`, `build`, and smoke are green
- bootstrap setup works through the backend and is repaired for the UI path
- recruiter password reset is available
- recruiter/admin and applicant baseline flows are automated

## Company and ship navigation (approved 2026-11-10)

The dedicated Companies & ships page owns inline company/ship creation and
spelling corrections. Requirements are displayed Company → Ship → Requirement,
with full-width aligned rows, independent collapse and row-level résumé matching.
Requirement forms select directory records; they do not create them inline.
Current role, historical-ID, Draft and release details are recorded in
`COMPANIES_SHIPS_UI_2026-11-10.md`.
