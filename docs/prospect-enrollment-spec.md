# Prospect / Lead Enrollment & Requirements Spec v2

**Status:** Implementation-ready draft.
**Authored:** 2026-05-14 / 2026-05-15.
**Revised:** 2026-06-03 after specialist review findings.
**Scope:** Adds a recruiter-controlled prospect stage upstream of the applicant form, customer requirements, prospect-requirement matching, funnel/KPI views, audit logging, and PDF/CSV exports.

---

## 1. Product Goals

Today applicants can self-enroll with Google OAuth and complete the 19-section maritime application form. This v2 spec changes intake to an invite-only model:

1. A recruiter receives a CV from email, agency, referral, or other external sourcing.
2. The recruiter manually screens the candidate and creates a `prospects` record.
3. The prospect moves through `open`, `contacted`, `approved`, or `rejected`.
4. Approved prospects can be invited by email.
5. The applicant requests a gated Supabase email OTP/magic-link sign-in using the email on the prospect.
6. The first successful applicant sign-in creates or resumes an application linked to the prospect.
7. Recruiters attach prospects to one or more customer requirements through `prospect_requirements`.
8. The existing application review/compliance/pipeline continues downstream.

Product goals:

- Every first-time applicant claim must originate from recruiter approval. There is no public self-enrollment.
- Recruiter attribution is based on the authenticated session, never manual name dropdown assignment.
- Recruiter, requirement, prospect, application, export, and deep-read activity are audit logged.
- KPI/reporting matches the operational workbook while using precise database definitions.
- Master Recruiters can export PDF/CSV snapshots safely.

Cutover assumption:

- Existing public applicant/application data is test data and can be wiped.
- Schema migrations are still required. "No migration" only means no data-preservation migration is required.
- Applicant rows in `auth.users` created through Google OAuth must also be handled during cutover.

---

## 2. Existing System Constraints

This repo currently uses:

- Applicants: Google OAuth.
- Recruiter-side users: email/password.
- Recruiter identities: `public.profiles` rows with `user_type = 'recruiter'`, plus `public.user_roles`.
- Recruiter roles: `Master Recruiter`, `Recruiter`, `Coordinator`.
- Applications: `public.applications`, with active-pipeline uniqueness enforced by the `prevent_multiple_active_applications` trigger keyed on `applications.user_id`.
- Application statuses from the existing pipeline:
  - `new`
  - `under_review`
  - `test_scheduled`
  - `test_passed`
  - `interview_scheduled`
  - `interview_passed`
  - `offered`
  - `offer_accepted`
  - `documents_pending`
  - `hired`
  - `rejected`
  - `withdrawn`

This spec must not introduce a parallel recruiter identity model unless explicitly approved later. All recruiter/person attribution FKs point to `public.profiles(id)` and are role-validated.

---

## 3. Data Model

### 3.1 New Tables

New primary tables:

- `prospects`
- `requirements`
- `prospect_requirements`
- `requirement_nationalities`
- `prospect_notes`
- `requirement_remarks`
- `audit_log`
- `applicant_magic_link_requests`

Existing table changes:

- Add nullable `prospect_id` to `public.applications`.
- `applications.prospect_id` references `public.prospects(id)` with `ON DELETE RESTRICT`.
- `applications.user_id` remains the applicant auth/profile identity and remains the key used by the single-active-application trigger.
- For claimed prospects, `applications.user_id = prospects.applicant_user_id`.

### 3.2 Recruiter References

All columns named `*_recruiter_id`, `actor_user_id`, or `owner_recruiter_id` reference `public.profiles(id)`.

Insert/update operations that set a recruiter reference must validate the referenced profile is recruiter-side:

```sql
exists (
  select 1
  from public.profiles p
  where p.id = referenced_user_id
    and p.user_type = 'recruiter'
)
```

This validation may be enforced with `SECURITY DEFINER` RPCs/triggers. It must not rely only on client-side checks.

### 3.3 `prospects`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | uuid | Yes | PK |
| `name` | text | Yes | Candidate display name |
| `dob` | date | Yes | Age derived in tenant timezone |
| `nationality_id` | FK | Yes | References countries master |
| `rank_applied_for_id` | FK | Yes | References rank master |
| `vessel_type_id` | FK | Yes | References vessel-type master |
| `exp_in_rank_months` | integer | Yes | Must be `>= 0` |
| `previous_employer` | text | Conditional | Required unless `is_first_time_at_sea = true` |
| `is_first_time_at_sea` | boolean | Yes | Defaults false |
| `telephone` | text | Yes | E.164 format |
| `email` | text | Yes | Original casing for display |
| `email_normalized` | text | Yes | Lower-trimmed generated/stored or trigger-maintained |
| `lead_source` | text | No | Nullable free text in v1 |
| `status` | text/enum | Yes | `open`, `contacted`, `approved`, `rejected` |
| `first_contacted_at` | timestamptz | No | Set once on first transition into `contacted`; never derived per render |
| `last_terminal_status` | text | No | Enum-like text: v1 value `rejected`; future values only by migration |
| `last_terminal_status_at` | timestamptz | No | Set when terminal status is reached |
| `archived_at` | timestamptz | No | Archive flag, not status |
| `archive_reason` | text | Conditional | Required when archived |
| `deleted_at` | timestamptz | No | Soft delete flag |
| `deleted_by_recruiter_id` | FK | No | References `profiles(id)` |
| `invited_at` | timestamptz | No | Updated on each successful send/resend |
| `claimed_at` | timestamptz | No | First successful applicant sign-in |
| `applicant_user_id` | FK | No | References `profiles(id)`; applicant type is enforced by trusted RPC/trigger, not FK syntax |
| `bounce_flag` | boolean | Yes | Defaults false |
| `created_by_recruiter_id` | FK | Yes | References recruiter profile |
| `created_at` | timestamptz | Yes | Defaults now |
| `updated_at` | timestamptz | Yes | Defaults now |
| `version` | integer | Yes | Optimistic concurrency, defaults 1 |

Required constraints:

- `check (exp_in_rank_months >= 0)`
- `check (is_first_time_at_sea or nullif(trim(previous_employer), '') is not null)`
- `check (archived_at is null or nullif(trim(archive_reason), '') is not null)`
- `check (deleted_at is null or deleted_by_recruiter_id is not null)`
- `unique (applicant_user_id) where applicant_user_id is not null and deleted_at is null`
- `check (last_terminal_status is null or last_terminal_status in ('rejected'))`
- Live email uniqueness:

```sql
create unique index prospects_email_live_uidx
on public.prospects (email_normalized)
where archived_at is null and deleted_at is null;
```

Additional lookup indexes:

- `(email_normalized)` for archived-row collision warnings.
- `(telephone)` for duplicate telephone warnings.
- `(status, archived_at, deleted_at)`.
- `(created_by_recruiter_id, created_at)`.

### 3.4 `requirements`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | uuid | Yes | PK |
| `req_id_display` | text | Yes | Unique display ID |
| `req_year_month` | text/date | Yes | Year-month bucket for generated IDs, e.g. `2026-04` |
| `req_sequence` | integer | No | Generated sequence number |
| `date_opened` | date | Yes | Defaults current date in tenant timezone |
| `date_closed` | date | No | Set when closed/cancelled |
| `vessel_name` | text | No | Free text with autosuggest |
| `vessel_type_id` | FK | Yes | Vessel-type master |
| `rank_id` | FK | Yes | Rank master |
| `positions_required` | integer | Yes | `>= 1` |
| `target_days` | integer | Yes | `>= 1`; default configurable |
| `owner_recruiter_id` | FK | Yes | References recruiter profile |
| `customer_name` | text | No | Free text in v1 |
| `status` | text/enum | Yes | `open`, `closed`, `cancelled` |
| `closure_reason` | text | Conditional | Required when cancelled |
| `created_by_recruiter_id` | FK | Yes | References recruiter profile |
| `created_at` | timestamptz | Yes | Defaults now |
| `updated_at` | timestamptz | Yes | Defaults now |
| `version` | integer | Yes | Optimistic concurrency |

Required constraints:

- `check (positions_required >= 1)`
- `check (target_days >= 1)`
- `check (status <> 'cancelled' or nullif(trim(closure_reason), '') is not null)`
- `unique (req_id_display)`
- `unique (req_year_month, req_sequence) where req_sequence is not null`

Generated ID rule:

- Use `YYYY-MMM-NNN` for generated IDs, e.g. `2026-Apr-001`, to avoid cross-year collisions.
- Generated IDs are allocated inside a transaction using a per-year-month sequence table or `pg_advisory_xact_lock`.
- `req_id_display` is the canonical public unique value. `(req_year_month, req_sequence)` is the canonical generated-ID reservation pair.
- Manual overrides set `req_sequence = null`, still pass `unique (req_id_display)`, and surface a friendly collision message before insert where possible.
- Manual `req_id_display` values are limited to 32 characters and the pattern `[A-Za-z0-9][A-Za-z0-9._-]*` to prevent accidental long/free-form labels.

### 3.5 `requirement_nationalities`

`required_nationalities` must not be stored as an array FK. Use a junction:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `requirement_id` | FK | Yes | References `requirements(id)` |
| `country_id` | FK | Yes | References countries master |

Primary key: `(requirement_id, country_id)`.

Empty rows for a requirement mean no nationality preference.

### 3.6 `prospect_requirements`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | uuid | Yes | PK |
| `prospect_id` | FK | Yes | `ON DELETE RESTRICT` |
| `requirement_id` | FK | Yes | `ON DELETE RESTRICT` |
| `status` | text/enum | Yes | Junction state |
| `submitted_at` | timestamptz | No | Transition into `submitted_to_customer` |
| `customer_decided_at` | timestamptz | No | Transition into accepted/rejected |
| `joined_at` | timestamptz | No | Transition into `joined` |
| `withdrawn_at` | timestamptz | No | Transition into `withdrawn` |
| `withdrawal_reason` | text | Conditional | Required when withdrawn |
| `assigned_by_recruiter_id` | FK | Yes | First recruiter who attached prospect |
| `last_transition_by_recruiter_id` | FK | No | Most recent human status transition |
| `created_at` | timestamptz | Yes | Defaults now |
| `updated_at` | timestamptz | Yes | Defaults now |
| `version` | integer | Yes | Optimistic concurrency |

Status values:

- `shortlisted`
- `submitted_to_customer`
- `customer_reviewing`
- `customer_accepted`
- `customer_rejected`
- `joined`
- `withdrawn`

Required constraints:

- Hard unique `(prospect_id, requirement_id)` in v1.
- `check (status <> 'withdrawn' or nullif(trim(withdrawal_reason), '') is not null)`
- Timestamps must match status transitions through the transition RPC/trigger.

If the business later wants re-shortlisting after terminal withdrawal/rejection, create a new explicit versioning policy before relaxing the unique constraint.

### 3.7 Notes and Remarks

Use separate append-only tables, not free-form columns:

`prospect_notes`:

- `id`
- `prospect_id`
- `body`
- `author_recruiter_id`
- `created_at`
- `edited_at`
- `edit_locked_at`
- `is_transition_note`
- `visibility`

`requirement_remarks` has the same structure with `requirement_id`.

Rules:

- Notes are internal only. They are never visible to applicants.
- Coordinator note visibility must be explicit. v1 decision: Coordinators can view prospect/requirement detail but cannot view notes or truncated note columns.
- Author can edit for 5 minutes. After that, only Master Recruiter can append a correction note, not edit history.
- Archive, reject, withdraw, cancel, and reopen/unarchive all require a note.

---

## 4. Authentication and Identity

### 4.1 Applicant Auth Mechanism

Use Supabase email OTP or magic link behind a custom server-side gate. The app must not call `supabase.auth.signInWithOtp` directly from the public applicant page.

New edge function:

- `request-applicant-magic-link`

Responsibilities:

1. Accept email from the applicant portal.
2. Normalize email with lower-trim.
3. Apply per-email rate limiting using `applicant_magic_link_requests`.
4. Look up a live prospect by `email_normalized`.
5. If no eligible prospect exists, return the same 200 response as success.
6. If eligible, call Supabase Admin Auth to generate/send the OTP or magic link.
7. Return a uniform anti-enumeration response.

Eligibility predicate:

```sql
status = 'approved'
and archived_at is null
and deleted_at is null
and bounce_flag = false
and applicant access is not revoked
```

The Supabase project must disable public OTP signups where possible. Any unavoidable project-level auth settings must be documented before deployment.

### 4.2 Rate Limits

Per-email rate limit:

- 3 successful or attempted requests per normalized email per rolling hour.
- When the limit is exceeded, write `prospect.magic_link_locked_out` if a matching prospect exists; for unknown emails, write only aggregate/non-PII abuse telemetry if implemented.

Response:

- Always HTTP 200.
- Same body for known, unknown, ineligible, and rate-limited emails.
- Add a small fixed delay so unknown-email responses do not become measurably faster.

If 6-digit OTP code mode is chosen instead of magic links:

- Verification attempts per code are limited to 5 before a 15-minute lockout.

If link-only mode is chosen:

- Remove "verification attempts per code" language from implementation docs. It does not apply.

### 4.3 Applicant Claim

On first successful applicant session for an eligible prospect:

1. Create or update `profiles` for the applicant identity.
2. Set `prospects.applicant_user_id = auth.uid()` and `claimed_at = now()`.
3. Enforce the unique `applicant_user_id` constraint.
4. Create or resume a draft `applications` row for that user and set `applications.prospect_id`.
5. Emit audit events:
   - `prospect.claimed`
   - `application.draft_started` if a new application row is created

The claim flow must be implemented through an RPC/edge function to avoid races between two sessions.

### 4.4 Email Rebinding

Changing email after claim is a privileged rebinding operation, not a simple field edit.

For `claimed_at is null`:

- Recruiter can edit email through an RPC.
- The RPC validates uniqueness, updates `email` and `email_normalized`, clears `bounce_flag`, invalidates any unexpired OTP/magic-link request metadata for the old normalized email, and emits `email_changed`.
- If `invited_at` was already set, a new invite email may be sent after confirmation.
- Any old email link/code may still be technically valid inside Supabase if already delivered; the claim RPC must re-check current `prospects.email_normalized` and reject claims from stale email identities.
- The local `applicant_magic_link_requests` row is marked invalidated. Supabase-side token invalidation is best-effort and depends on available Admin Auth APIs; the load-bearing guarantee is the claim RPC's stale-email and prospect-eligibility re-check.

For `claimed_at is not null`:

- Only Recruiter or Master Recruiter can request the rebind.
- The UI must show a confirmation explaining session revocation and new email use.
- The server RPC must:
  1. Validate live email uniqueness.
  2. Call Supabase Admin Auth to update `auth.users.email` for `applicant_user_id`.
  3. Update `profiles.email`.
  4. Update `prospects.email` and `email_normalized`.
  5. Clear `bounce_flag`.
  6. Revoke applicant sessions globally.
  7. Emit one `email_changed` audit event with a correlation ID.

If any step fails, the transaction or operation must fail visibly and leave the old identity usable.

### 4.5 Session Revocation

Applicant sessions are normally valid for 30 days with no idle timeout. The following events revoke all applicant sessions for `prospects.applicant_user_id`:

- Prospect archived.
- Prospect soft-deleted.
- Prospect moved to `rejected` after claim.
- Claimed prospect email rebind.
- Manual Master Recruiter access revocation, if added later.

Revocation must call Supabase Admin Auth from a trusted server context. Client-side sign-out alone is insufficient.

### 4.6 Recruiter Auth

Recruiter auth remains Supabase email/password.

Idle timeout:

- v1 uses client-side inactivity tracking in recruiter layouts.
- Timeout target: 15 minutes.
- On timeout, call Supabase sign-out and route to recruiter login.
- For stronger future enforcement, reduce JWT lifetime and rely on refresh-token rotation/revocation.

---

## 5. Prospect Lifecycle

### 5.1 Prospect Statuses

Substantive statuses:

- `open`
- `contacted`
- `approved`
- `rejected`

Flags:

- `archived_at`
- `deleted_at`
- `bounce_flag`

Do not treat `archived` as a status. It is an overlay flag.

### 5.2 Allowed Prospect Transitions

All status changes must go through a transition RPC or DB trigger. Client-only validation is not enough.

| From | To | Claimed? | Required note | Side effects |
|---|---|---|---:|---|
| `open` | `contacted` | Any | No | Set `first_contacted_at` if null; audit `status_changed` |
| `open` | `rejected` | No | Yes | Set `last_terminal_status` |
| `contacted` | `approved` | No | No | Audit `status_changed` |
| `contacted` | `rejected` | No | Yes | Set `last_terminal_status` |
| `approved` | `contacted` | No | Yes | Audit demotion |
| `approved` | `rejected` | Any | Yes | Set `last_terminal_status`; revoke session if claimed |
| `rejected` | `open` | No | Yes | Reopen from rejection |
| `rejected` | `contacted` | No | Yes | Reopen and preserve rejection signal |
| Any non-deleted | archive flag set | Any | Yes | Set `archived_at`; revoke session if claimed |
| Archived | unarchive | Any | Yes | Clear `archived_at`; reset status according to note/action |

Forbidden:

- `open -> approved`
- `rejected -> approved`; reopened rejected prospects must pass through a re-evaluation path before approval
- `open -> invited` as a stored status
- Any status change on a soft-deleted row
- Any transition that bypasses required notes

Implementation note:

- Reopen from rejected must not erase prior rejection history. Preserve `last_terminal_status` and `last_terminal_status_at` until a Master Recruiter explicitly clears it.

### 5.3 Derived Prospect States

Derived states for display:

- `Sourced`: `status = open`, not archived, not deleted.
- `Contacted`: `status = contacted`.
- `Approved`: `status = approved`, `invited_at is null`, `claimed_at is null`.
- `Invited`: approved, `invited_at is not null`, `claimed_at is null`, no linked application.
- `Claimed`: `claimed_at is not null` and no linked application exists yet.
- `In Draft`: linked application exists and `applications.submitted_at is null`.
- `Application Submitted`: linked application exists and `submitted_at is not null`.
- `Archived`: `archived_at is not null`.
- `Deleted`: `deleted_at is not null`; hidden from normal UI.

### 5.4 Reapply

Invite-only first claim remains mandatory.

After a prospect has already been claimed:

- A terminal application may allow future reapplication only if the prospect is not archived, not deleted, not bounced, and is currently eligible for applicant access.
- Rejected prospects cannot self-reapply until a recruiter reopens and re-approves them.
- Archived prospects cannot sign in until a recruiter unarchives them and sets an eligible status.
- The new application links to the same `prospect_id`.
- The single-active-application trigger on `applications.user_id` remains authoritative.
- If `last_terminal_status = 'rejected'`, the recruiter review UI must prominently surface the prior rejection context.

---

## 6. Requirements and Junction Workflow

### 6.1 Requirement Lifecycle

Requirement statuses:

- `open`
- `closed`
- `cancelled`

Allowed transitions:

| From | To | Required note/field | Side effects |
|---|---|---|---|
| `open` | `closed` | No | Set `date_closed` |
| `open` | `cancelled` | `closure_reason` | Set `date_closed` |
| `closed` | `open` | Yes | Clear `date_closed` |
| `cancelled` | `open` | Yes | Clear `date_closed` |

Reopening a closed/cancelled requirement does not reset existing junctions. Previously `joined`, `customer_rejected`, and `withdrawn` junctions remain terminal history; new or still-active junctions determine current open positions.

### 6.2 Junction Lifecycle

Allowed statuses:

- `shortlisted`
- `submitted_to_customer`
- `customer_reviewing`
- `customer_accepted`
- `customer_rejected`
- `joined`
- `withdrawn`

Allowed transitions:

| From | To | Required note/field | Side effects |
|---|---|---|---|
| `shortlisted` | `submitted_to_customer` | No | Set `submitted_at` |
| `submitted_to_customer` | `shortlisted` | Yes | Recall submission |
| `submitted_to_customer` | `customer_reviewing` | No | Audit |
| `customer_reviewing` | `customer_accepted` | No | Set `customer_decided_at` |
| `customer_reviewing` | `customer_rejected` | Optional | Set `customer_decided_at` |
| `customer_accepted` | `customer_rejected` | Yes | Customer reversed acceptance; set/update `customer_decided_at` |
| `customer_accepted` | `joined` | No | Set `joined_at` |
| Any non-terminal | `withdrawn` | `withdrawal_reason` | Set `withdrawn_at` |

Terminal states:

- `customer_rejected`
- `joined`
- `withdrawn`

`joined` is terminal in v1. Post-join attrition, no-show after acceptance, or early departure is out of scope for v1 and must not be modeled by silently moving `joined -> withdrawn`. If the business needs post-join attrition later, add a separate post-placement state model or a new explicit junction/version policy.

Joined vs. hired:

- `prospect_requirements.status = 'joined'` is the customer requirement placement event.
- `applications.status = 'hired'` remains the application pipeline terminal hiring state.
- In v1, moving a junction to `joined` should prompt the recruiter to also mark the linked application `hired` if not already terminal. The system must not silently update both unless implemented through a documented combined RPC.

### 6.3 Requirement-First Flow

Requirement-first flow:

1. Recruiter creates a requirement.
2. Recruiter adds a candidate from requirement detail.
3. Save runs one transaction through `create_prospect_with_requirement`.
4. Transaction inserts `prospects` and `prospect_requirements`.
5. If either insert fails, both roll back.
6. Prospect status starts at `open`.
7. Junction status starts at `shortlisted`.

Requirement nationality prefill:

- If the requirement has exactly one `requirement_nationalities` row, prefill `prospects.nationality_id` with that country.
- If the requirement has multiple nationalities, show them as eligible suggestions and require the recruiter to choose one prospect nationality explicitly.
- If the requirement has no nationality preference, leave prospect nationality blank until recruiter selection.

Funnel display rule:

- A requirement-first candidate is not shown as globally "Shortlisted" ahead of prospect lifecycle stages.
- Prospect lifecycle and requirement/customer stage are displayed as separate dimensions, or funnel counts are explicitly per-junction.

### 6.4 Pool-Building Flow

Pool flow:

1. Recruiter creates a prospect without requirement context.
2. Prospect remains in the pool.
3. Later, recruiter attaches the prospect to a requirement.
4. The attachment creates a single `prospect_requirements` row.
5. Duplicate `(prospect_id, requirement_id)` is blocked.

### 6.5 Cross-Requirement Conflicts

When a candidate is moved to `joined` on one requirement:

- Show other active junctions for that prospect.
- Split the prompt into two groups:
  - Lower-risk: `shortlisted`, `submitted_to_customer`, `customer_reviewing`.
  - High-risk: `customer_accepted`.
- Bulk withdraw writes one audit event per junction with a shared `bulk_action_id`.
- Recruiter can skip or handle each active junction manually.

### 6.6 Close Requirement Prompt

`open_positions` is derived:

```text
positions_required - count(joined junctions)
```

Nothing is physically decremented.

Prompt to close requirement when `candidates_joined >= positions_required` appears:

- Immediately after a junction transitions to `joined`, using the transition RPC response field `should_prompt_close_requirement`.
- On requirement detail load, using the requirement-detail RPC response field `should_prompt_close_requirement`.
- After editing `positions_required`, using the requirement-update RPC response field `should_prompt_close_requirement`.

`should_prompt_close_requirement` is computed server-side as:

```sql
requirements.status = 'open'
and count(joined junctions for requirement) >= requirements.positions_required
```

Open positions display is clamped at zero:

```text
greatest(positions_required - joined_count, 0)
```

---

## 7. Access Control and RLS

### 7.1 Permission Names

Seed permissions:

- `view_prospects`
- `create_prospects`
- `edit_prospects`
- `transition_prospects`
- `archive_prospects`
- `delete_prospects`
- `send_prospect_invites`
- `view_prospect_notes`
- `edit_prospect_notes`
- `view_requirements`
- `create_requirements`
- `edit_requirements`
- `transition_requirements`
- `edit_requirement_owner`
- `edit_junction_status`
- `withdraw_junctions`
- `view_audit_log`
- `export_csv`
- `export_pdf`
- `manage_runtime_settings`

Role mapping:

| Capability | Recruiter | Master Recruiter | Coordinator |
|---|---:|---:|---:|
| View prospects | Yes | Yes | Yes |
| View prospect notes | Yes | Yes | No |
| Create/edit prospects | Yes | Yes | No |
| Transition/archive prospects | Yes | Yes | No |
| Soft-delete prospects | No | Yes | No |
| Send invites | Yes | Yes | No |
| View requirements/junctions | Yes | Yes | Yes |
| Create/edit requirements | Yes | Yes | No |
| Change requirement owner | Yes | Yes | No |
| Edit junction status/withdraw | Yes | Yes | No |
| View cross-entity audit | No | Yes | No |
| Export CSV/PDF | No | Yes | No |

RLS policies must use existing `public.has_permission(auth.uid(), '<permission>')` style where possible.

Owner transfer UI:

- `edit_requirement_owner` permits a recruiter-owner picker on requirement forms/details.
- This picker is allowed because it transfers accountability; the "no recruiter-name dropdowns" rule only forbids manual attribution of historical actions or stage events.
- The selectable list is restricted to active recruiter-side profiles with `Master Recruiter` or `Recruiter` role. Coordinators are excluded because they cannot edit or transition requirements.

### 7.2 Deep Read Access

Deep reads are:

- Prospect detail.
- Prospect activity.
- Requirement detail.
- Requirement activity.
- PDF/CSV export.

If deep-read audit is meant to be trustworthy, direct sensitive `SELECT` access must be limited and these reads must go through `SECURITY DEFINER` RPCs that write audit events before returning data.

List views may query non-note summary fields directly. Any list view that includes notes is considered a deep read and must be audited or hidden.

---

## 8. Invite Email

### 8.1 Send Predicate

The Send Invite button and server RPC must use the same predicate:

```sql
status = 'approved'
and archived_at is null
and deleted_at is null
and bounce_flag = false
```

### 8.2 Send RPC

All sends go through a server RPC/edge function that:

1. Locks the prospect row.
2. Rechecks the predicate.
3. Decides first send vs. resend from the locked row.
4. Updates `invited_at`.
5. Queues the email.
6. Emits `invite_sent` or `invite_resent`.

If another recruiter sent an invite moments earlier, return "already sent by X at Y" and do not send a duplicate.

### 8.3 Email Content

- From: verified system sender.
- Reply-to: recruiter who clicked Send.
- Body: platform template from recruiter settings.
- Optional personal message: plain text only, max 1,000 characters, HTML escaped.
- Email contains the portal URL and instructions. It does not contain application data and does not contain a magic token.

### 8.4 Runtime Settings

Add runtime setting:

- `APPLICANT_NOTIFICATION_EMAIL`

Source of truth:

- `runtime_settings` row, with env fallback where existing runtime-settings infrastructure supports it.

Development:

- If set, all applicant invite/sign-in notification emails route only to this override inbox.

Production:

- Must be unset or configured to real applicant delivery behavior.

### 8.5 Bounce Handling

Resend webhook:

- Verifies webhook signature.
- Finds prospect by normalized recipient email and/or message metadata.
- Sets `bounce_flag = true`.
- Emits `bounce_received` with `actor_type = 'system'`.
- Blocks future sends/sign-ins until the recruiter corrects the email.

Correcting the email clears `bounce_flag` through the email-edit RPC.

---

## 9. Audit Log

### 9.1 Schema

Use typed references instead of a polymorphic FK:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | uuid | Yes | PK |
| `entity_type` | text/enum | Yes | `prospect`, `requirement`, `prospect_requirement`, `application`, `export` |
| `prospect_id` | uuid | No | FK |
| `requirement_id` | uuid | No | FK |
| `prospect_requirement_id` | uuid | No | FK |
| `application_id` | uuid | No | FK |
| `event_type` | text/enum | Yes | Namespaced event |
| `actor_type` | text/enum | Yes | `recruiter`, `applicant`, `system` |
| `actor_user_id` | uuid | No | FK to `profiles(id)` |
| `actor_role_at_event` | text | No | Snapshot for recruiter events |
| `system_actor` | text | No | Example: `resend-webhook` |
| `correlation_id` | uuid | No | Shared by composite/bulk actions |
| `payload` | jsonb | Yes | Redacted payload |
| `created_at` | timestamptz | Yes | Defaults now |

Constraint:

- Exactly one typed entity FK should be set for ordinary entity events.
- Export events may use `entity_type = 'export'` and store row set metadata in payload.

Concrete check constraint:

```sql
check (
  (
    entity_type = 'export'
    and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 0
  )
  or (
    entity_type <> 'export'
    and num_nonnulls(prospect_id, requirement_id, prospect_requirement_id, application_id) = 1
  )
)
```

### 9.2 Event Types

Prospect:

- `prospect.created`
- `prospect.field_edited`
- `prospect.status_changed`
- `prospect.note_added`
- `prospect.note_edited`
- `prospect.archived`
- `prospect.unarchived`
- `prospect.soft_deleted`
- `prospect.email_changed`
- `prospect.invite_sent`
- `prospect.invite_resent`
- `prospect.claimed`
- `prospect.bounce_received`
- `prospect.magic_link_locked_out`

Requirement:

- `requirement.created`
- `requirement.field_edited`
- `requirement.status_changed`
- `requirement.cancelled`
- `requirement.owner_changed`
- `requirement.remark_added`
- `requirement.remark_edited`

Junction:

- `prospect_requirement.created`
- `prospect_requirement.status_changed`
- `prospect_requirement.withdrawn`

Event de-duplication rules:

- Specific events replace generic events for the same logical action.
- Email edits emit `prospect.email_changed`, not both `prospect.field_edited` and `prospect.email_changed`.
- Prospect status changes emit `prospect.status_changed`, not `prospect.field_edited` for the `status` field.
- Archive/unarchive emit `prospect.archived` / `prospect.unarchived`, not a generic `prospect.status_changed`, even if payload includes a status reset.
- Requirement cancellation emits `requirement.cancelled`, not both `requirement.status_changed` and `requirement.cancelled`.
- Requirement owner transfers emit `requirement.owner_changed`, not `requirement.field_edited` for `owner_recruiter_id`.
- Junction withdrawal emits `prospect_requirement.withdrawn`, not both `prospect_requirement.status_changed` and `prospect_requirement.withdrawn`.
- Composite UI actions may emit multiple specific events only when they mutate multiple entities; those events must share `correlation_id`.

Application:

- `application.draft_started`
- `application.submitted`
- existing pipeline transitions as already implemented

Reads/exports:

- `read.detail_viewed`
- `read.activity_viewed`
- `export.pdf_exported`
- `export.csv_exported`

### 9.3 Payload Redaction

Audit payloads must not blindly store full PII forever.

Track old/new values for operational fields:

- status
- archived/deleted flags
- rank
- vessel type
- nationality
- requirement ownership
- junction status
- timestamps

Sensitive fields:

- email: store old/new normalized hashes plus masked display values.
- telephone: masked.
- dob: store changed/not changed, not full value, unless Master-only audit export explicitly requires it.
- note bodies: not duplicated into `audit_log.payload`; the note row is the source.

Regulatory hard-delete/takedown:

- Because audit retention is otherwise forever, a regulatory takedown must run an out-of-band DB/Admin procedure that either deletes or irreversibly redacts remaining PII-bearing rows across prospects, notes, remarks, applications, application data, and audit payloads.
- The procedure must leave a non-PII tombstone audit event with `actor_type = 'system'` and a takedown reference if legally allowed.

### 9.4 Indexes

Required indexes:

- `(prospect_id, event_type, created_at desc)`
- `(requirement_id, event_type, created_at desc)`
- `(prospect_requirement_id, event_type, created_at desc)`
- `(application_id, event_type, created_at desc)`
- `(actor_user_id, created_at desc, event_type)`
- `(entity_type, created_at desc)`
- `(correlation_id)`

Revisit monthly partitioning if audit volume becomes high.

---

## 10. Funnel and Dashboard Definitions

### 10.1 Timezone

All "today", date buckets, dashboard windows, SLA days, and age calculations use the tenant timezone.

Default tenant timezone for v1:

- `Asia/Kolkata`

Store timestamps in UTC. Convert at query/render boundaries.

### 10.2 Recruiter Dashboard Information Architecture

This spec is recruiter-side only. The applicant dashboard is separate and unaffected.

The existing recruiter top navigation must stay focused on major work areas, such as:

- Dashboard
- Workspace
- Search
- Calendar
- Expiry
- Settings

Do not add `Prospects`, `Requirements`, `Funnel`, `KPI`, or `Reports` as additional top-level recruiter nav items in v1.

Instead, the existing Recruiter Dashboard route/workspace becomes a tabbed dashboard hub. The current recruiter dashboard content is retained as the default tab:

| Internal Dashboard Tab | Purpose | Primary Surface | Role Visibility |
|---|---|---|---|
| `Operations` | Existing queue-first recruiter dashboard content: submissions, review workload, active pipeline, scheduling, reference search | Existing dashboard cards/queues | Same as current recruiter dashboard |
| `Prospects` | Prospect intake rollups, status counts, stale invites, bounced prospects, approval/invite workload | Rollup cards above the filterable prospect list from §11.1 | Master Recruiter, Recruiter, Coordinator read-only; notes hidden for Coordinator |
| `Requirements` | Open requirements, open positions, requirement ageing, customer/vessel/rank demand | Rollup cards above a filterable requirements list | Master Recruiter, Recruiter, Coordinator read-only |
| `Funnel` | Candidate funnel tracker and stage movement by prospect/junction | Funnel tracker table from §10.4 | Master Recruiter, Recruiter, Coordinator read-only; notes hidden for Coordinator |
| `KPI` | Workbook-style recruitment performance metrics, conversion, days to join, per-recruiter snapshot | KPI cards/charts from §10.6 and §10.7 | Master Recruiter and Recruiter; Coordinator hidden in v1 unless later approved |
| `Reports` | PDF/CSV export entry points and recent report/export activity | Export controls and recent export activity | Master Recruiter only |

Shared dashboard controls:

- Date range and tenant timezone controls apply to `Funnel`, `KPI`, and `Reports`.
- `Operations`, `Prospects`, and `Requirements` may show current-state snapshot cards in addition to date-windowed metrics.
- Each tab may deep-link to detail routes, such as prospect detail, requirement detail, or application review, but these detail routes do not need their own top-level nav items.
- Recommended route shape is tab-level deep links under the existing dashboard route, for example `/recruiter/dashboard/prospects`, `/recruiter/dashboard/requirements`, `/recruiter/dashboard/funnel`, `/recruiter/dashboard/kpi`, and `/recruiter/dashboard/reports`.
- If a user lacks access to a tab, hide it by default. A disabled tab with explanatory copy is acceptable only when product wants to teach the permission boundary.

The page heading and supporting copy should adapt to the selected internal tab so each surface remains focused. Example tab titles:

- `Operations`: Queue-first recruiting operations
- `Prospects`: Prospect intake and invite pipeline
- `Requirements`: Customer requirements and open positions
- `Funnel`: Candidate funnel tracker
- `KPI`: Recruitment performance dashboard
- `Reports`: Recruitment reports and exports

Prospects and Requirements list placement:

- The `Prospects` tab is the primary prospect list page in v1. It contains prospect rollup cards, filters/search, and the filterable prospect table described in §11.1.
- The `Requirements` tab is the primary requirement list page in v1. It contains requirement rollup cards, filters/search, and the filterable requirement table.
- Prospect and requirement detail pages are separate deep routes opened from those tables; they are not top-level nav items.

Reports recent activity:

- The `Reports` tab shows recent export activity from `audit_log` events where `event_type in ('export.pdf_exported', 'export.csv_exported')`.
- Master Recruiter sees team-wide recent exports.
- If a future non-Master export permission is added, non-Master users see only their own export events unless explicitly granted broader audit visibility.
- The recent-activity query must use the same audited/read-safe RPC pattern as other deep audit reads.

### 10.3 Funnel Dimensions

Do not collapse prospect lifecycle and requirement/customer stage into one ambiguous "furthest along" value for all metrics.

Use two dimensions:

- Prospect stage: sourced, contacted, approved, invited, claimed, in draft, application submitted, application pipeline status, rejected, archived.
- Requirement stage: shortlisted, submitted to customer, customer reviewing, customer accepted, customer rejected, joined, withdrawn.

Views may show a composite label, but metrics must declare whether they count prospects or junctions.

### 10.4 Funnel Tracker Rows

Primary row grain:

- One row per `prospect_requirements` junction.

Pool prospects without a requirement:

- Show in a separate "Prospect Pool" section or with empty requirement columns.

Columns:

| Column | Source |
|---|---|
| Candidate ID | Short `prospects.id` |
| Date Contacted | `prospects.first_contacted_at` |
| Recruiter | Most recent human transition actor |
| Candidate Name | `prospects.name` |
| Req ID | `requirements.req_id_display` |
| Rank | Requirement rank and prospect rank if different |
| Vessel Type | Requirement vessel type and prospect vessel type if different |
| Prospect Stage | Derived prospect stage |
| Requirement Stage | Junction status |
| Date Joined | `prospect_requirements.joined_at` |
| Joined? | 1 if junction status is `joined` |
| Days to Join | `joined_at - first_contacted_at` |
| Active Junction? | 1 if junction is non-terminal |
| Cycle Completed? | 1 if junction/prospect is terminal |
| Notes | Hidden for Coordinator; audited deep read if shown |

### 10.5 Dashboard Controls

- Date range: start and end.
- `as_of_date`: defaults to current date in tenant timezone.
- Snapshot metrics ignore date range only when explicitly labeled snapshot/current.

### 10.6 KPI Metrics

| Metric | Grain | Definition |
|---|---|---|
| Open Requirements | Snapshot | Count requirements where `status = 'open'` as of `as_of_date` |
| Closed Requirements | Window | Count requirements moved to `closed` within window |
| Open Positions | Snapshot | Sum `positions_required - joined_count` for open requirements as of `as_of_date` |
| Joined vs Required | Window cohort | Joined junctions in window divided by positions required for requirements active during window |
| Requirement Closure % | Window cohort | Requirements closed in window divided by requirements active during window |
| Contacted on End Date | Day | Prospects moved to `contacted` on report end date |
| Joined on End Date | Day | Junctions moved to `joined` on report end date |
| Contact-to-Join Conversion % | Window | Distinct prospects joined in window divided by distinct prospects contacted in window |
| Active Pipeline Prospects | Snapshot | Distinct non-archived, non-deleted prospects with non-terminal prospect/application state |
| Active Pipeline Junctions | Snapshot | Non-terminal prospect-requirement junction count |
| Avg Days to Join | Window | Average `joined_at - first_contacted_at` for joined junctions in window |

Percentages must guard against zero denominators and display `N/A`, not `0%`, when denominator is zero.

### 10.7 Per-Recruiter Snapshot

Attribution rule:

- Human stage-transition events credit the actor who performed that transition.
- System events are counted in team/system totals, not per-recruiter metrics.

| Metric | Definition |
|---|---|
| Contacted in Window | Count prospect `status_changed` events into `contacted` by recruiter |
| Joined in Window | Count junction transitions into `joined` by recruiter |
| Conversion % | Recruiter's joined in window divided by recruiter's contacted in window |
| Active Junctions Owned/Last Touched | Non-terminal junctions where the most recent human transition actor is recruiter |

Dashboard must label the attribution model clearly.

### 10.8 Customer Grouping

`requirements.customer_name` is nullable free text in v1, but it exists for filtering/grouping:

- Requirement list includes a `customer_name` text filter.
- Dashboard may group open/closed requirements by `customer_name`.
- No customer-level KPI should depend on stable customer identity until `customer_name` is promoted to a real `customers` table.

---

## 11. Search, Filters, and Exports

### 11.1 Prospect List

Default sort:

- `last_activity_at desc`

`last_activity_at` should be materialized on `prospects` and updated by write RPCs/triggers to avoid audit scans on every list render.

Filters:

- Status multi-select for substantive status only.
- Archive filter: active only, archived only, include archived.
- Rank.
- Vessel type.
- Nationality, joined via countries master.
- Customer name for requirement-related views.
- Added by recruiter. This is a read-only filter and is allowed despite the "no recruiter assignment dropdowns" rule.
- Creation date range.
- Bounce flag.
- Stale invite flag.
- Has active application.

Search:

- Case-insensitive substring over name, normalized email, telephone, previous employer.
- Nationality search joins `countries.name`.

### 11.2 CSV Export

Master Recruiter only.

Export audit payload includes:

- actor
- timestamp
- filters
- sort
- row count
- notes included flag
- stable hash of exported row IDs

Notes are excluded by default. Including notes requires explicit checkbox and is audited as a deep read/export.

### 11.3 PDF Reports

Reports:

- Requirements Tracker PDF.
- Candidates Funnel Tracker PDF.
- KPI Dashboard PDF for the `KPI` internal dashboard tab.
- Prospect snapshot PDF.
- Requirement snapshot PDF.

Rules:

- Master Recruiter only.
- Server-side generation.
- Uses the same query layer as list/dashboard views.
- Header includes title, generated-at timestamp, generated-by, filters/date range, and tenant timezone.
- PDF snapshot uses fixed `as_of_date` so ageing values do not drift after generation.

Implementation default:

- HTML-to-PDF via a server-side renderer is preferred, consistent with hosted export infrastructure.

---

## 12. Compliance Layering

Generic statutory compliance:

- Existing `applicationCompliance.js`.
- Runs on submitted applications regardless of requirement.

Requirement-specific compliance:

- Computed for `(application, requirement)`.
- Uses requirement rank, requirement vessel type, requirement nationality preferences, and customer-specific inputs.
- If prospect fields differ from requirement fields, requirement-specific compliance uses the requirement values.
- Any prospect/requirement fields used by compliance must be audit-tracked.

Display:

- Show generic compliance and requirement-specific overlay side by side.
- A candidate can be green generally and red for a specific requirement.

---

## 13. Cutover Plan

Cutover tasks:

1. Confirm all existing applicant/application public data is disposable test data.
2. Export backup before destructive cleanup.
3. Delete applicant test data from public tables.
4. Clean applicant `auth.users` rows created by Google OAuth through Supabase Admin API.
5. Remove applicant Google OAuth UI and code paths:
   - applicant Google sign-in buttons
   - applicant login intent handling tied to Google OAuth
   - applicant protected-flow smoke fixtures that require stored Google sessions
6. Keep recruiter email/password auth intact.
7. Add schema migrations for all new tables/columns/indexes/triggers.
8. Seed permissions and role-permission mappings.
9. Add gated applicant magic-link request edge function.
10. Add invite/bounce/rebind/session-revocation edge functions or RPCs.
11. Build the `Operations`, `Prospects`, `Requirements`, `Funnel`, `KPI`, and `Reports` internal tabs within the existing Recruiter Dashboard route, plus prospect and requirement detail pages.
12. Update docs:
   - `README.md`
   - `documentation.md`
   - `docs/prd.md`
   - `docs/decisions.md`
   - `docs/test-plan.md`
13. Replace applicant auth smoke setup with OTP/magic-link harness.
14. Run full manual QA and smoke.

---

## 14. Definition of Done

Automated:

- `npm run lint` passes.
- `npm run build` passes.
- `npm run test:smoke` passes.
- Applicant auth smoke covers invite-only magic-link request.
- Prospect state machine tests cover allowed/forbidden transitions.
- Junction state machine tests cover allowed/forbidden transitions.
- RLS tests cover Recruiter, Master Recruiter, and Coordinator.
- Regression test for single-active-application with `prospect_id` linked applications.

Manual QA:

- Requirement-first flow end to end.
- Pool-building flow end to end.
- Invite send/resend, bounce flag, email correction.
- Claimed applicant email rebind and session revoke.
- Archive/reject access revoke.
- Rejected prospect reopen and prior rejection surfacing.
- Dashboard metrics against a representative fixture dataset.
- PDF report visual fidelity against the source workbook.

Deployment:

- Supabase migrations applied.
- Edge functions deployed.
- Runtime settings configured.
- Frontend deployed.
- Production invite/email overrides verified.

---

## 15. Out of Scope for v1

- Automated stale-invite follow-up emails.
- Applicant self-service email rebind.
- Structured lead-source master list.
- First-class customer entity.
- WhatsApp integration.
- Hard-delete UI.
- Bulk prospect-list archive/delete.
- Saved filter views.
- Scheduled report emails.

---

## 16. Open Decisions Before Build

Resolve before implementation starts:

1. OTP code vs. email magic-link mode. The rate-limit and verification-attempt rules differ.
2. Whether Coordinators can ever view notes. v2 currently says no.
3. Whether moving junction to `joined` should automatically move application to `hired`, or only prompt.
4. Whether `last_activity_at` and joined counts are materialized by triggers from day one. `first_contacted_at` is required in schema.
5. Exact PDF renderer and deployment target.
6. Exact tenant timezone setting location. v2 default is `Asia/Kolkata`.
7. Whether soft-deleted prospects with audit history need a Master-only restore view.
