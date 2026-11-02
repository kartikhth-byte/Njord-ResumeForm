# Recruitment Flow: Target And Current Gap

Status: target product flow, not yet implemented end to end. This document describes the workflow; `docs/needle-integration.md` describes the search integration.

## Records And Responsibilities

- **Candidate profile (future candidate portal):** candidate-owned identity, resume versions, availability, visibility/consent, and job browsing. An unclaimed Needle resume is a provisional resume record, not a verified portal profile.
- **Requirement:** a manning-company vacancy owned by one organization, with a separate published/private state. Candidates see only published job details.
- **Recruitment case:** one active candidate/person-to-requirement workflow, with entry source and history. It holds contact, test, interview, selection, customer decision, and later hiring events. It must exist without a long Holmes form and without inventing facts missing from a resume.
- **Long Holmes form:** a candidate-completed, post-selection data-collection record used to produce the customer Excel worksheet. It is not the candidate profile, a job-interest record, or the search corpus.

## Entry Into The Case

1. **Direct job interest:** a candidate uses the portal to express interest in a published requirement. Holmes shows that interest on the requirement immediately; no recruiter search is needed.
2. **Available candidate:** a candidate marks themselves available and visible. An authorized recruiter sees them in the Available queue, confirms interest for a particular requirement, then adds them to its case.
3. **Needle search:** a recruiter searches the permitted resume/profile pool in the AI tab or uses `Match resumes` on a requirement, reviews evidence, and explicitly adds a result to the case.

All routes resolve to one active case for that person and requirement. Preserve each entry event and original source even when deduplication links records. Availability is a timestamped, candidate-maintained signal, not proof of interest in every job.

## Case Progression

The case, **not** `applications.status`, tracks initial review/contact, confirmed interest and availability, test scheduling/result, and interview scheduling/result. Failed, rejected, withdrawn, and no-show outcomes remain case events with reasons and audit history. Passing both test and interview is necessary but not sufficient for an automatic email: an authorized recruiter makes the selection decision and explicitly sends the long-form invitation. No AI match or status update sends it automatically.

The invited candidate reviews prefilled resume facts, supplies missing information, and submits the long form. Only confirmed fields are copied; uncertain/unknown facts are left for the candidate. Holmes uses the completed form for the relevant customer worksheet. Customer submission, offer, documents, and joining remain recruiter/customer workflow events on the case. Exact customer-review and offer ordering after the form needs product sign-off; it must not be inferred from today's application status sequence.

The customer portal shows only its own requirements and authorized candidate submissions/decisions. The operator portal handles the full recruitment workflow. Candidate-owned profiles are shared only under explicit visibility/consent rules; company-private notes and cases are never shared by default.

## What Exists Today

- `prospects` and `prospect_requirements` provide a pre-form link, but `prospects` requires DOB, nationality, rank, vessel type, experience, phone, and email. A resume or lightweight portal interest may not have these verified fields.
- `prospect_requirements` supports shortlist/customer-decision/join states, not the test/interview progression above.
- `applications` and its recruiter status control currently carry test/interview stages. This is the wrong record for the target pre-form process.
- The invite reservation checks `prospects.status = approved`, not passed test plus passed interview and explicit selection. Claiming the invite creates/reuses a `new` application draft.
- The current Candidates page is a prospect funnel tracker, not the future Available/Interested talent directory. The candidate portal and organization-owned publication model do not exist yet.

## Migration Rules

- Design the candidate/profile, provisional resume, organization, recruitment-case, event, and long-form links before changing statuses or production RLS. Do not turn `prospect_requirements` or `applications` into the new model by renaming labels alone.
- Backfill existing prospects/applications into explicit legacy-compatible case records with source and history; preserve existing applications, exports, and audit events. Use an additive rollout with a feature flag, read parity checks, and rollback.
- Enforce one active case per confirmed person and requirement while retaining past cycles. Unconfirmed identity matches go to review, never silent merge. Intake, apply, and add actions need idempotency keys.
- Deny cross-organization access in database policies, storage, service APIs, and background jobs. Test candidate consent changes and operator overrides explicitly.

## Acceptance Checks

- Direct interest appears on the correct requirement; Available candidates appear without search; Needle search is optional. Each path creates or reuses the same case.
- A recruiter can record test and interview outcomes before any long-form row exists. Failed or withdrawn candidates are not invited.
- The invite action is unavailable until both passes and selection are recorded. Sending is explicit, auditable, and idempotent.
- Candidate-confirmed form data generates the correct customer worksheet; no unverified extracted value is silently submitted.
- Deduplication preserves source history and prevents duplicate active cases without exposing another organization's private data.
