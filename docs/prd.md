# Holmes - Platform PRD

## Product Summary

Holmes is the recruiter workflow automation part of an owner-operated maritime recruitment platform. The candidate portal will own candidate-maintained profiles and job discovery; Needle will power candidate job search and recruiter candidate/requirement matching. Holmes handles the requirement-to-hire workflow and the detailed post-selection form used for customer worksheets.

Njordships is a customer. The product is intended to serve additional customers, with customer-specific needs handled without changing the Holmes product identity. The deployment and data-isolation model for multiple customers is not yet decided.

## Primary User Groups

### Applicants

- authenticate through invite-only emailed magic links in the current form flow
- create and manage maritime application drafts
- complete the current 19-section application form after selection
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
- can view candidates and support scheduling/status workflows
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
- one canonical resume pool across Needle, direct intake, candidate-portal intake, and later customer-website intake; applications are downstream records, not a duplicate search corpus
- a pre-application recruitment pipeline for matched candidates: operator contact and availability confirmation, test pass, interview pass, then invitation to complete the Holmes application
- a future candidate portal where candidates maintain their own profile/resume, see requirements published by manning companies, and express interest/apply to jobs without completing the long worksheet form at that point
- the existing long Holmes application remains a post-selection data-collection form, prefilled where reliable from resume facts and completed by the candidate to generate the customer Excel worksheet
- recruiters see direct interest on a requirement and consented available candidates without running a search; Needle search is an additional discovery route, and all routes enter the same recruitment case
- Seajobs downloading and local-agent tooling are excluded from the Holmes integration

See `docs/needle-integration.md` for the service boundary, delivery order, and release gates. This integration is planned, not yet shipped.

The authoritative target flow is in `docs/recruitment-flow.md`: direct job interest, an available candidate, or a Needle match enters one candidate-requirement case. Contact, test, and interview occur before the long Holmes form. That form is invited only after both passes and explicit selection, and exists to complete customer worksheet data. Current prospect/application statuses do not yet implement this flow.

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
