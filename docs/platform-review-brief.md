# Holmes, Candidate Portal, And Needle: Review Brief

Status: **review-ready product/architecture brief, not build-ready implementation spec** (2026-11-02). No new multi-tenant, candidate-portal, or Needle integration is deployed by this brief.

## Current Working Code Path

- Active Holmes working copy: `/Users/kartikraghavan/Documents/Njord-ResumeForm`.
- Review branch: `ui/warm-theme`. Commit `4315444` is the reviewed **code baseline**; later documentation commits may move the branch tip without changing that baseline.
- The earlier `/Users/kartikraghavan/Tools/Njord-ResumeForm` location is not the working copy for this review. Do not assume it has these changes.
- Needle's independently maintained source is `https://github.com/kartikhth-byte/Needle`; the source inspected for this brief was commit `fb22a53`.
- The Privacy and Terms page copy has separate uncommitted edits. Legal operator wording remains pending owner approval and is not part of this review packet.

Current Holmes implementation entry points: `src/App.jsx` defines the live routes; `src/pages/RecruiterApplications.jsx` and `src/components/SequentialStatusControl.jsx` handle today's application pipeline; `src/pages/RecruiterRequirementDetail.jsx` handles requirement detail; `src/pages/RecruiterCandidatesPage.jsx` is today's recruiter candidate view; `src/services/embeddingService.js` is current embedding/search plumbing. These are **current code paths**, not evidence that the proposed candidate portal, tenancy boundary, or Needle integration exists.

## Review Scope And Sources

Review the proposed platform boundary, target recruitment flow, ordered work, security model, and integration/update strategy. Use these documents in order:

1. `docs/recruitment-flow.md` - target flow, current gaps, migration principles, acceptance checks.
2. `docs/needle-integration.md` - search surfaces, identity/dedup, service boundary, periodic upstream upgrades.
3. `docs/tasks.md` - ordered implementation backlog; the older production/QA checklist below it needs live-state revalidation.
4. `docs/prd.md`, `docs/decisions.md`, `docs/test-plan.md` - broader product context, recorded decisions, test gates.

The reviewed Needle source is `https://github.com/kartikhth-byte/Needle` at `fb22a53`. Do not infer that its current Python resume-search API also implements candidate-facing job search or Holmes tenant authorization. Holmes's current `prospects`, `prospect_requirements`, and `applications` are partial/legacy workflow records, not proof that the target flow is complete.

## Agreed Product Model

- The candidate portal owns a candidate-maintained profile/resume, availability, and job discovery across requirements that manning companies publish.
- Needle remains independently developed. It powers recruiter candidate search, requirement-to-resume matching, and, after new work, candidate job search. Seajobs downloading and local-agent tooling are out of Holmes scope.
- Holmes automates recruiter workflows: requirements, candidate-requirement cases, contact, test/interview, customer handoff, post-selection long form, and Excel worksheet generation.
- Recruiters see direct interest on each requirement and consented available candidates without running Needle search. Needle is an additional discovery route.
- A candidate's lightweight interest in a job is **not** the current long Holmes application. The long form is invited only after test pass, interview pass, and explicit selection; reliable resume facts can prefill it, and the candidate completes missing fields.
- Every intake/search/interest route converges on one active case for a confirmed person and requirement, with provenance retained. No silent person merges, status emails, or AI-driven recruitment decisions.
- Company-private cases, notes, and customer submissions are organization-scoped. A shared candidate profile has separate consent/visibility rules; the customer portal never sees the operator's full resume pool.

## Work Inventory And Spec Maturity

| Workstream | Planned deliverable | Maturity / remaining design |
| --- | --- | --- |
| Production baseline | Reconcile live migrations, secrets, and historical QA before schema changes | Checklist exists; live state not reverified here |
| Organization foundation | Organizations, memberships, requirement ownership/publication, RLS/API/storage isolation, operator privileges | Boundary stated; schema, role/permission matrix, and migration design needed |
| Identity/resume/dedup | Provisional resumes, candidate-owned profiles, versions, source history, claim/merge review, consent | Principles and test cases stated; identity/merge and retention contracts needed |
| Recruitment case | Three entry routes; pre-form contact, availability, test/interview, selection, customer/hiring events | Target flow stated; exact states/transitions, permissions, and legacy mapping needed |
| Long form and worksheet | Invite gate, candidate-verified prefill, form submission, customer Excel output | Gate stated; field mapping and post-form customer/offer ordering needed |
| Candidate portal and inbound queues | Profile/resume upkeep, job listings/interest, Available and Interested views, Source column | Surface stated; publication, availability freshness, privacy, and UX details needed |
| Needle integration | Operator AI workspace, requirement matching, candidate job search, versioned upstream release contract | Scope stated; API schemas, hosting, capability inventory, eval thresholds, and job-search implementation needed |
| Customer portal/onboarding | Company-owned requirements and authorized submissions/decisions, customer setup | Boundary stated; exact permissions, branding/template ownership, and onboarding flow needed |
| Migration and rollout | Backfill legacy records, feature flags, dual-read checks, contract/evaluation tests, rollback | Principles stated; executable migration/rollback plans and test fixtures needed |

The ordered milestones and dependencies are in `docs/tasks.md`. This table is a completeness audit, not a claim that every item has an approved technical spec.

## Decisions Required Before Build-Ready Sign-Off

1. **Organization model:** one shared deployment/database or separate deployments; how operator staff, manning-company staff, and users with access to multiple companies are represented.
2. **Candidate visibility and data rights:** who may see an available candidate or an unclaimed Needle resume; consent, revocation, retention, and whether the existing Needle corpus can be imported into the shared directory.
3. **Recruitment state machine:** exact pre-form states, test/interview fail/no-show/withdraw paths, who records selection, and the sequence of customer review, offer, documents, and joining.
4. **Application terminology:** name the lightweight job-interest record separately from the long worksheet form in schema, UI, API, and reporting.
5. **Dedup and claims:** identity evidence/precedence, manual-review authority, merge reversal, duplicate active-case rule, and repeated cycles on a reopened requirement.
6. **Portal publication and availability:** what makes a requirement public, which data appears in job listings, how long an availability claim remains current, and whether candidate interest grants the company profile access.
7. **Needle contract and delivery:** Holmes-facing API shapes/versioning, hosting and authentication, which Needle features are retained, candidate-facing job-search design, release pinning, and benchmark success thresholds.
8. **Long-form prefill:** field-by-field mapping from resume facts to current form, confidence/verification rules, and whether customer-specific worksheet requirements alter candidate questions.

## Reviewer Instructions

Find contradictions, unsafe assumptions, missing states/actors, cross-tenant or candidate-privacy leaks, untestable acceptance criteria, and sequencing that would cause rework. Mark each finding with severity, document/line, the scenario that fails, and a concrete decision or test needed. Do not treat the historical `docs/tasks.md` checklist as verified live state. Recommend the smallest build-ready first slice; do not execute production migrations or process real candidate data during review.

Suggested review order: product/recruitment workflow, data/privacy and tenancy, Needle/API architecture, then migration and QA. A successful review resolves or explicitly defers the eight decisions above and yields a state/permission matrix plus a first-slice acceptance test set.
