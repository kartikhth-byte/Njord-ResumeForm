# Needle Integration Into Holmes

Status: product boundary agreed; implementation pending. Source: `https://github.com/kartikhth-byte/Needle` (main inspected at `fb22a53`).

The authoritative target recruitment handoff and current Holmes gaps are in `docs/recruitment-flow.md`. This document covers the Needle/search side of that handoff.

## Product Boundary

The platform has three boundaries. The **candidate portal** owns the candidate-maintained profile and resume and gives candidates a job search across published requirements. **Needle** is the shared discovery/matching engine: candidates search jobs and recruiters search candidates or match a requirement to resumes. **Holmes** automates the recruiter workflow after discovery: requirements, candidate-requirement cases, contact, test/interview, recruiter selection, offer/documents, and an attested manual worksheet handoff to the principal. The searchable resume corpus is **not** the Holmes `applications` table. The detailed Holmes form may open after a passed interview, in parallel with later case steps; re-indexing it as another resume would duplicate a person and bias results.

Today, Needle has resume records and extracted facts; Holmes has an applicant record based on the detailed form the person fills. A resume record is not yet the future candidate-owned portal profile. The target candidate portal lets a person sign in, maintain their profile and resume, browse requirements published by manning companies, and express interest/apply to a job. Recruiters can discover and contact candidates through the Needle-powered recruiter search. Resumes may enter from Needle's existing corpus, direct uploads/database intake, candidate uploads, and later organization websites. Intake must preserve source, resume versions, and reviewed identity links without assuming every imported resume already belongs to a verified portal account.

There are two distinct actions that must not share one status model: a candidate applying to a listed job is an early expression of interest; completing the current long Holmes application is a post-interview task, parallel to selection and offer steps. After a passed interview, resume-extracted information may prefill that long form, but the candidate checks it and supplies missing fields before submission. The long form links to the candidate/resume and recruitment case; it is not another search entity. Recruiters may generate/download its worksheet any time after submission; recording an outside-Holmes send to the principal waits for offer acceptance and document verification.

The candidate portal shows requirements that manning companies choose to publish to candidates across Holmes, with only public job details. Organization-private requirements and notes, recruiter notes, and other applicants remain isolated. Candidate profile visibility to recruiters must be consent-based and distinct from the candidate's ability to browse published jobs.

## Recruiter Discovery Paths

The default Holmes workflow is **inbound first**, not search first:

1. A candidate expresses interest in a published requirement. That requirement shows the candidate in an incoming-interest queue with their profile, resume, stated availability, and any automated fit signals. The recruiter opens the person directly and progresses or declines the recruitment case; no AI query is required.
2. A candidate marks themselves available without applying to a specific requirement. Authorized recruiters see them in an available-candidates queue and can open the profile, confirm current availability/interest for a particular job, and add them to that requirement's case. Availability is a candidate-maintained signal with a timestamp, not proof of interest in every job.
3. When neither queue yields a clear option, a recruiter uses Needle search in the AI tab or `Match resumes` on a requirement to explore the wider permitted resume pool.

All three paths converge on the same candidate-requirement recruitment case and subsequent test/interview workflow. Direct inbound interest and availability must remain visible without requiring a recruiter to run Needle search. Access to available candidates follows their visibility/consent settings.

## Identity And Deduplication

Deduplication is a launch gate, not a later cleanup task. Keep source provenance even when records are linked:

- **Resume version:** exact file/content matches should reuse the existing blob/version where appropriate. A changed resume becomes a new version under the same reviewed person, not a second person. Filename alone is not an identity key.
- **Person:** a verified candidate account is the strongest link. Matching email, phone, name, DOB, or extracted facts can propose a possible link, but none alone should silently merge two people. Normalize contacts, review ambiguous matches, preserve the original records and audit the merge/link decision. Unclaimed Needle resumes remain provisional until identity is confirmed.
- **Recruitment case:** for one person and one requirement, direct job interest, an availability-queue action, and Needle search should resolve to one active case. Repeated clicks/ingestion retries must be idempotent. Keep the distinct source events on that case instead of creating duplicate pipeline rows.

The Candidates view should show a primary `Source` column and the profile/detail should retain original source, later intake/update sources, and the path into each requirement. A candidate may originate in Needle and later claim/update a profile in the portal; claiming does not erase provenance. Cross-organization identity linking and visibility require consent and tenant-safe access checks; duplicate detection must not leak another organization's private candidate data.

## Holmes Surfaces

### AI tab

Expose Needle's recruitment workspace in the recruiter app: projects, chats, runs and refinement stages; prompt and filter-only searches; resolved constraint chips; actual progress/events; ranked resume cards; the full verdict table; resume/evidence detail; feedback, notes, and review actions. The candidate portal uses the same search/matching foundation for job discovery but has a candidate-specific UI and authorization; it is not a recruiter AI workspace. Preserve Needle's distinction between deterministic eligibility verdicts, heuristic score, semantic AI fit, and unknown facts. Keep frozen run/stage snapshots and model/degradation metadata for auditability. Do not include Seajobs downloads, scraping, desktop/local-agent management, or local-folder exports.

### Requirement matching

Add `Match resumes` to a requirement detail page. Convert the saved requirement into an explicit, reviewable Needle search constraint set; show unmapped or missing fields before running. Search the same canonical resume pool and return ranked results with per-criterion evidence, unknowns, and the requirement version used. A rerun after a requirement change creates a new snapshot. Shortlisting/attaching a candidate is a deliberate recruiter action, separate from ranking. No search action changes application status or sends email.

## Recruitment Handoff

A candidate can enter a requirement's recruitment pipeline through direct job interest, a recruiter choosing an available candidate, or a recruiter adding a Needle search result. All three routes create/link the same kind of candidate-requirement recruitment case; none creates the long Holmes form. Recruiter contact confirms identity, interest, and current availability as needed. Test results or a reasoned recruiter waiver, then interview results, belong to the case. After a passed interview, a recruiter may explicitly invite the long Holmes form before or after selection; the candidate confirms or supplies its data, and extraction must not silently submit it. A recruiter may generate/download the worksheet after form submission, independently of case progress. The recruiter separately records selection, offer, offer acceptance, documents submitted and verified; only then may they attest to a manual send to the principal outside Holmes. `Hired` ends the Holmes workflow.

Do not use the current `applications` row to represent job interest, sourcing, test, or interview activity. Its status list currently includes test/interview statuses, while `prospect_requirements` models shortlist/customer-decision/join states and `prospects` requires fields that a resume may not establish. Those schemas and UI flows need an explicit migration plan before cutover; do not repurpose them by label alone. Incomplete resume leads must be storable without inventing DOB, contact details, or availability. Any organization-facing view shows only that manning organization's requirements and authorized case data, not the Holmes platform owner's full resume pool or private notes; a principal portal is out of scope.

## Service And Data Boundary

- Run Needle's Python search/extraction code server-side behind authenticated platform APIs used by recruiter and candidate search. Holmes workflow calls the same matching service for requirement matches; do not port model calls into Vite or expose model/service-role keys to the browser.
- Authenticate platform-owner support, organization recruiters, and candidates as distinct actors. Organization-specific requirements, recruitment cases, submissions, notes, projects/chats/runs, and access must be tenant-scoped; access to a shared candidate-owned profile/resume must follow explicit candidate visibility and consent rules. Never accept a client-supplied tenant ID as authority.
- Keep resume record/version IDs stable across sources and link them to a verified candidate profile when claimed or confirmed. Store provenance, source-specific external ID, content hash, extraction version/status, and consent/retention metadata. Deduplicate by reviewed identity evidence, not filename alone; do not silently merge people.
- Adapt Holmes requirement fields (`rank_id`, `vessel_type_id`, nationalities, positions, dates, remarks) to Needle's typed constraints. Do not turn an absent requirement field into a hard filter. Treat `UNKNOWN` as review-needed, not failed.
- Needle's existing `candidate_resume_facts` and workspace stores are not automatically Holmes-ready: the inspected schema has no tenant key, and the cloud API is only a scaffold. Add tenant-safe persistence and authenticated APIs before connecting production data.
- Keep AI outputs advisory. Identity merges, shortlisting, job interest, long-form invitations, and status changes remain explicit Holmes workflows with audit trails.

## Ongoing Needle Updates

Needle continues development in its own repository. It is the source of truth for extraction, query understanding, ranking, search sessions, and related evaluation. Holmes owns the adapter, authorization context, requirement mapping, and recruitment actions. Do not copy the Needle monolith into Holmes or edit a vendored copy: repeated upstream merges would mix engine changes with Holmes-specific workflow and make upgrades hard to review.

Expose a stable, versioned service contract for Holmes-facing operations (resume ingest/extract, recruiter candidate search, requirement matching, and candidate job search when implemented). Keep Needle engine/state changes behind that contract. An engine release can be deployed without a Holmes code merge when the contract stays compatible; a breaking contract change needs coordinated updates and a compatibility window. Neither service may directly mutate the other's workflow tables.

Pin each environment to a reviewed Needle release tag or commit and record the deployed engine version alongside search runs/results. Never follow `main` automatically in production. The inspected Needle main does not yet have a dedicated Holmes-facing versioned contract, so defining that contract and release artifact is part of integration work.

For each periodic upgrade: review changes since the pinned release; run Needle's unit/evaluation suite; deploy the candidate release to staging; run Holmes contract, permission, cross-tenant, dedup, and end-to-end search tests against it; compare ranking/explanations on the reviewed benchmark; then promote with a feature flag/canary and retain the prior release for rollback. Changes to extraction schema or stored facts need an explicit migration/backfill and dual-version read plan. Secrets and private resume corpora stay outside both Git histories.

## Delivery Order

1. Seed the current organization and carry `organization_id` through the first recruitment-case slice. Complete tenant-safe RLS/API/storage boundaries before a second organization or shared portal/search access; decide candidate visibility/consent and Needle corpus rights before import.
2. Implement stable resume/version records, reviewed person linking, intake/dedup adapters, and the private Needle extraction service needed for reliable facts. Do not pretend imported resumes are verified candidate-owned profiles.
3. Correct the candidate-requirement recruitment case and migrate legacy prospect/application links additively. Contact, availability, test, and interview live there, before the long form.
4. Gate the detailed Holmes form invitation on a passed interview after test pass or a reasoned recruiter waiver; selection is not required for the invite. Tell the candidate completion does not imply selection, and approve sensitive-data retention before rollout. Prefill only supported facts and require candidate review/completion. Allow worksheet generation after form submission at any later case stage; record a recruiter-attested manual send to the principal only after offer acceptance and document verification.
5. Build the candidate portal and inbound-first recruiter queues for direct job interest and available candidates. Both work without running an AI search.
6. Deliver Needle search as the additional discovery path: recruiter AI workspace, requirement `Match resumes`, and candidate-facing job search over published requirements. Package authenticated APIs with separate authorization, health/timeout limits, structured errors, and redacted telemetry. Preserve Needle's search workflow without Seajobs/local-agent tooling.
7. Expose only authorized organization-side requirements and case data in any organization-facing view; a principal portal is out of scope. Add organization-website intake after the core paths pass acceptance checks.

## Release Gates

- Automated cross-tenant denial tests at database, object storage, API, and UI layers.
- Search fixtures covering exact match, nonmatch, unknown evidence, stale extraction, duplicate resume versions, and out-of-scope prompt handling.
- Deduplication tests cover exact re-upload, revised resume, same person from two sources, ambiguous near-match requiring review, candidate claim, and repeated add/apply actions converging on one requirement case without exposing another tenant's data.
- Requirement mapping tests prove missing fields do not silently become hard filters; rankings display their basis and uncertainty.
- Evaluate Needle ranking and explanations on a reviewed resume/requirement benchmark with recruiter judgments. The existing Holmes AI search indexes applications, so result-for-result parity is not a valid gate. Use a feature flag and rollback path.
- Production rollout only after authenticated service deployment, secrets/retention review, and recruiter sign-off. No production migrations or live candidate processing as part of this design slice.
