# Holmes, Candidate Portal, And Needle: Review Brief

Status: **reviewed product/architecture brief, not build-ready implementation spec** (2026-11-02). Owner decisions on case order and terminology are in `docs/decisions.md`; findings and proposed first-slice tests are in `docs/platform-review-findings.md`. No new multi-tenant, candidate-portal, or Needle integration is deployed by this brief.

## Current Working Code Path

- Active Holmes working copy: `/Users/kartikraghavan/Documents/Njord-ResumeForm`.
- Review branch: `ui/warm-theme`. Commit `4315444` is the reviewed **code baseline**; later documentation commits may move the branch tip without changing that baseline.
- The earlier `/Users/kartikraghavan/Tools/Njord-ResumeForm` location is not the working copy for this review. Do not assume it has these changes.
- Needle's independently maintained source is `https://github.com/kartikhth-byte/Needle`; the source inspected for this brief was commit `fb22a53`.
- Privacy and Terms page copy changed in a separate local commit (`0150dc1`) after the published documentation baseline; legal review remains separate from this product specification.

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
- Holmes automates the organization's recruiter workflow: requirements, candidate-requirement cases, contact, test/interview, selection, offer/documents, a parallel post-interview long form, an attested manual worksheet send to the principal, and hiring through `hired`. The Holmes operator is the platform owner, not every recruiter app user.
- Recruiters see direct interest on each requirement and consented available candidates without running Needle search. Needle is an additional discovery route.
- A candidate's lightweight interest in a job is **not** the current long Holmes application. An authorized recruiter may explicitly invite the long form after a passed interview (following test pass or a reasoned waiver), before or after selection. The candidate must be told that completing it does not mean selection; retention of sensitive fields for unselected candidates needs approval. Reliable resume facts can prefill it, and the candidate completes missing fields. A recruiter may generate/download the worksheet any time after form submission; recording a manual send to the principal separately requires offer acceptance and document verification.
- Every intake/search/interest route converges on one active case for a confirmed person and requirement, with provenance retained. No silent person merges, status emails, or AI-driven recruitment decisions.
- Organization-private cases and notes are organization-scoped. A shared candidate profile has separate consent/visibility rules; any organization-facing view sees only authorized data, and a principal portal is out of current scope.

## Work Inventory And Spec Maturity

| Workstream | Planned deliverable | Maturity / remaining design |
| --- | --- | --- |
| Production baseline | Reconcile live migrations, secrets, and historical QA before schema changes | Checklist exists; live state not reverified here |
| Organization foundation | Organizations, memberships, requirement ownership/publication, RLS/API/storage isolation, separate platform-owner support privileges | Boundary stated; schema, role/permission matrix, and migration design needed |
| Identity/resume/dedup | Provisional resumes, candidate-owned profiles, versions, source history, claim/merge review, consent | Principles and test cases stated; identity/merge and retention contracts needed |
| Recruitment case | Three entry routes; pre-form contact, availability, test/interview, selection, offer/documents, manual principal handoff record, `hired` | Owner order recorded; transition enforcement, permissions, and legacy mapping needed |
| Long form and worksheet | Post-interview invite, candidate-verified prefill, post-submission generation, later attested manual send | Generation rule decided; manual-send semantics pending owner sign-off, plus field mapping and submitted-form enforcement |
| Candidate portal and inbound queues | Profile/resume upkeep, job listings/interest, Available and Interested views, Source column | Surface stated; publication, availability freshness, privacy, and UX details needed |
| Needle integration | Recruiter AI workspace, requirement matching, candidate job search, versioned upstream release contract | Scope stated; API schemas, hosting, capability inventory, eval thresholds, and job-search implementation needed |
| Organization onboarding | Organization-owned requirements and authorized case views, organization setup | Boundary stated; exact permissions, branding/template ownership, and onboarding flow needed; principal portal out of scope |
| Migration and rollout | Backfill legacy records, feature flags, dual-read checks, contract/evaluation tests, rollback | Principles stated; executable migration/rollback plans and test fixtures needed |

The ordered milestones and dependencies are in `docs/tasks.md`. This table is a completeness audit, not a claim that every item has an approved technical spec.

## Remaining Decisions Before Build-Ready Sign-Off

The owner has resolved the case order, recruiter selection, post-interview form invitation, worksheet gate, and operator/organization/principal terminology in `docs/decisions.md`. The remaining design questions are:

1. **Organization model:** one shared deployment/database or separate deployments; how operator staff, manning-company staff, and users with access to multiple companies are represented.
2. **Candidate visibility and data rights:** who may see an available candidate or an unclaimed Needle resume; consent, revocation, retention, and whether the existing Needle corpus can be imported into the shared directory.
3. **Dedup and claims:** identity evidence/precedence, manual-review authority, merge reversal, duplicate active-case rule, and repeated cycles on a reopened requirement.
4. **Portal publication and availability:** what makes a requirement public, which data appears in job listings, how long an availability claim remains current, and whether candidate interest grants the organization profile access.
5. **Needle contract and delivery:** Holmes-facing API shapes/versioning, hosting and authentication, which Needle features are retained, candidate-facing job-search design, release pinning, and benchmark success thresholds.
6. **Long-form prefill:** field-by-field mapping from resume facts to current form, confidence/verification rules, and whether principal-specific worksheet requirements alter candidate questions.

## Reviewer Instructions

Find contradictions, unsafe assumptions, missing states/actors, cross-tenant or candidate-privacy leaks, untestable acceptance criteria, and sequencing that would cause rework. Mark each finding with severity, document/line, the scenario that fails, and a concrete decision or test needed. Do not treat the historical `docs/tasks.md` checklist as verified live state. Recommend the smallest build-ready first slice; do not execute production migrations or process real candidate data during review.

Suggested review order: product/recruitment workflow, data/privacy and tenancy, Needle/API architecture, then migration and QA. A successful review resolves or explicitly defers the remaining decisions above and yields a state/permission matrix plus a first-slice acceptance test set.
