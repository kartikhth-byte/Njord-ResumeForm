# Recruitment Flow: Target And Current Gap

Status: target product flow, not yet implemented end to end. Manual principal-send attestation and the `principal_declined` reason are first-slice working assumptions pending owner sign-off; sensitive-data retention remains open. This document describes the workflow; `docs/needle-integration.md` describes the search integration.

Here, **operator** means the Holmes owner/platform support, **organization** means a manning company using Holmes, and **principal** means that organization's client. The organization's staff work in the **recruiter app**; they are not platform operators.

## Records And Responsibilities

- **Candidate profile (future candidate portal):** candidate-owned identity, resume versions, availability, visibility/consent, and job browsing. An unclaimed Needle resume is a provisional resume record, not a verified portal profile.
- **Requirement:** a manning-company vacancy owned by one organization, with a separate published/private state. Candidates see only published job details.
- **Recruitment case:** one active candidate/person-to-requirement workflow, with entry source and history. It holds contact, test, interview, recruiter selection, offer, documents, worksheet delivery to the principal, and hiring events. It must exist without a long Holmes form and without inventing facts missing from a resume.
- **Long Holmes form:** a candidate-completed, post-interview data-collection record used to produce the Excel worksheet for the principal (the manning organization's client). It is not the candidate profile, a job-interest record, or the search corpus.

## Entry Into The Case

1. **Direct job interest:** a candidate uses the portal to express interest in a published requirement. Holmes shows that interest on the requirement immediately; no recruiter search is needed.
2. **Available candidate:** a candidate marks themselves available and visible. An authorized recruiter sees them in the Available queue, confirms interest for a particular requirement, then adds them to its case.
3. **Needle search:** a recruiter searches the permitted resume/profile pool in the AI tab or uses `Match resumes` on a requirement, reviews evidence, and explicitly adds a result to the case.

All routes resolve to one active case for that person and requirement. Preserve each entry event and original source even when deduplication links records. Availability is a timestamped, candidate-maintained signal, not proof of interest in every job.

## Case Progression

The case, **not** `applications.status`, tracks initial review/contact, confirmed interest and availability, test scheduling/result or a recruiter-recorded test waiver with reason, and interview scheduling/result. Failed, rejected, withdrawn, and no-show outcomes remain case events with reasons and audit history. After a passed interview, an authorized recruiter may explicitly invite the candidate to complete the long form; selection and an offer are not prerequisites for that invitation. No AI match or case status update sends it automatically.

The long form runs in parallel with the case after the passed interview. Before inviting it, tell the candidate that completing it does not mean they have been selected; retention of sensitive fields for an unselected candidate needs an approved policy before rollout. The candidate reviews prefilled resume facts, supplies missing information, and submits it; only confirmed fields are copied. A recruiter may generate or download the Excel worksheet any time after that submission, including before selection, offer acceptance, or document verification. Generating a worksheet does not send it to the principal or advance the case. Separately, the recruiter records selection, offer, offer acceptance, documents submitted, and documents verified. After form submission, offer acceptance, and document verification, a recruiter may record that they sent the worksheet to the principal outside Holmes. This is an audited attestation, not an email or delivery controlled by Holmes; it must identify the actor, time, principal recipient, channel, and worksheet version. A principal decline before hire closes the case as `rejected` with reason code `principal_declined`, preserving the stage for reporting. The case otherwise reaches `hired`, the end of the Holmes workflow; principal steps after hire are out of scope. Do not infer this sequence from today's `applications.status` values.

The recruiter app handles the organization's recruitment workflow. The Holmes operator has separate, audited platform-support access, not ordinary recruiter permissions. Any organization-facing view shows only that manning organization's requirements and authorized case data; a principal portal is not in the current scope. Candidate-owned profiles are shared only under explicit visibility/consent rules; organization-private notes and cases are never shared by default.

## What Exists Today

- `prospects` and `prospect_requirements` provide a pre-form link, but `prospects` requires DOB, nationality, rank, vessel type, experience, phone, and email. A resume or lightweight portal interest may not have these verified fields.
- `prospect_requirements` supports shortlist/customer-decision/join states, not the test/interview progression above.
- `applications` and its recruiter status control currently carry test/interview stages. This is the wrong record for the target pre-form process.
- In the production baseline, the invite reservation checks `prospects.status = approved`, not a passed interview on the case. Staging `0225` adds a case-specific send gate and requires an eligible recorded form invitation before starting a new draft; its signed-in positive invite smoke is still pending. Production does not have this gate.
- The current Candidates page is a prospect funnel tracker, not the future Available/Interested talent directory. The candidate portal and organization-owned publication model do not exist yet.

## Migration Rules

- Design the candidate/profile, provisional resume, organization, recruitment-case, event, and long-form links before changing statuses or production RLS. Do not turn `prospect_requirements` or `applications` into the new model by renaming labels alone.
- Backfill existing prospects/applications into explicit legacy-compatible case records with source and history; preserve existing applications, exports, and audit events. Use an additive rollout with a feature flag, read parity checks, and rollback.
- Enforce one active case per confirmed person and requirement while retaining past cycles. Unconfirmed identity matches go to review, never silent merge. Intake, apply, and add actions need idempotency keys.
- Deny cross-organization access in database policies, storage, service APIs, and background jobs. Test candidate consent changes and operator overrides explicitly.

## Acceptance Checks

- Direct interest appears on the correct requirement; Available candidates appear without search; Needle search is optional. Each path creates or reuses the same case.
- A recruiter can record test results or a reasoned test waiver, then interview outcomes before any long-form row exists. Failed, no-show, rejected, or withdrawn candidates are not invited.
- The invite action is unavailable until an interview pass is recorded, and may occur before selection. Sending is explicit, auditable, and idempotent; no case status change sends email.
- Worksheet generation requires a submitted, candidate-confirmed form but not selection, offer acceptance, or verified documents; it does not change case status or send anything to the principal. Recording a manual send to the principal additionally requires an accepted offer and verified documents and records actor, time, recipient, channel, and worksheet version. Holmes cannot prevent an external email sent outside the app. No unverified extracted value is silently submitted; `hired` ends the Holmes case. Today's export UI/service do not yet enforce the submitted-form minimum.
- A principal decline before hire is recorded as `rejected` with reason `principal_declined`, not silently folded into another rejection reason. The candidate is told before the long-form invite that completion is not selection; a retention rule for unselected candidates must be approved before this flow ships.
- Deduplication preserves source history and prevents duplicate active cases without exposing another organization's private data.
