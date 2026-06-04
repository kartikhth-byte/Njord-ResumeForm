# Implementation Kickoff — Prospect Enrollment v2

**Scope:** translates §3 (Data Model), §4 (Auth/Identity), §6 (Workflow), §7 (RLS), §9 (Audit Log) from `prospect-enrollment-spec.md` into a migration sequence, edge-function inventory, and PR sequencing. Section references throughout point to that spec.

---

## Migration Sequence

Migrations are grouped by dependency. Within a group, order doesn't matter; between groups, earlier groups must land first.

**Group A — Foundation**

- A1. Seed `permissions` rows for all 20 names in §7.1.
- A2. Seed `role_permissions` mappings per §7.1 role matrix.
- A3. Helper function `is_recruiter_profile(uuid) returns boolean` per §3.2 validation rule. Used by all recruiter-FK triggers.
- A4. `audit_log` table with typed FKs, `num_nonnulls` CHECK, and all indexes from §9.1 + §9.4.
- A5. `write_audit_event` SECURITY DEFINER helper function. Centralizes payload redaction per §9.3.

**Group B — Core entity tables**

- B1. `prospects` table per §3.3, including the `last_terminal_status` CHECK, partial unique index on `email_normalized`, partial unique on `applicant_user_id`, and lookup indexes.
- B2. `prospect_notes` per §3.7.
- B3. `requirements` per §3.4, including `unique(req_id_display)` and `unique(req_year_month, req_sequence) where req_sequence is not null`.
- B4. `requirement_remarks` per §3.7.
- B5. `requirement_nationalities` junction per §3.5.

**Group C — Relationship tables and external integrations**

- C1. `prospect_requirements` junction per §3.6, including the `(prospect_id, requirement_id)` unique constraint.
- C2. `applicant_magic_link_requests` per §4.2 (rate-limit tracking).
- C3. `applications.prospect_id` nullable column with `ON DELETE RESTRICT` FK to `prospects`.

**Group D — Behaviors**

- D1. Per-table `updated_at` triggers.
- D2. `prospects.first_contacted_at` trigger: set on first `open → contacted` transition.
- D3. `prospects.last_activity_at` trigger: maintained on every write RPC.
- D4. `req_id_display` generator function using `(req_year_month)` per-bucket sequence with `pg_advisory_xact_lock`.
- D5. Transition-guard triggers on `prospects.status`, `requirements.status`, `prospect_requirements.status` enforcing the allowed transitions in §5.2, §6.1, §6.2.

**Group E — RLS policies**

- E1. RLS policies for every new table, keyed on `public.has_permission(auth.uid(), '<name>')` per §7.1.
- E2. `view_prospect_notes` policy for `prospect_notes` and any list view that exposes note content.

---

## Edge-Function Inventory

Grouped by spec section. All RPCs run server-side, write audit events through `write_audit_event`, and respect optimistic concurrency via the `version` column.

**§4 — Authentication and identity**

- `request-applicant-magic-link` (§4.1) — gated applicant OTP/magic-link issuance with rate limit, anti-enumeration, and `prospect.magic_link_locked_out` audit on lockout.
- `claim-applicant-session` (§4.3) — first-sign-in RPC. Sets `applicant_user_id`, `claimed_at`, creates draft application, re-checks current `email_normalized` per §4.4.
- `edit-prospect-email-preclaim` (§4.4) — pre-claim email change with OTP metadata invalidation.
- `rebind-prospect-email-postclaim` (§4.4) — post-claim rebind with `auth.users` update, profile sync, prospect update, bounce clear, session revoke, audit. Atomic with rollback.
- `revoke-applicant-sessions` (§4.5) — invoked by archive/soft-delete/reject-after-claim/rebind paths.

**§6 — Workflow**

- `create-prospect-with-requirement` (§6.3) — atomic prospect + junction insert with nationality prefill logic.
- `attach-existing-prospect-to-requirement` (§6.4) — pool-to-requirement attach.
- `transition-prospect-status` (§5.2 / drives §6 flows) — enforces transition table, sets `first_contacted_at` / `last_terminal_status`, triggers session revoke where required.
- `archive-prospect` / `unarchive-prospect` (§5.2) — archive overlay flag, mandatory note, session revoke on archive.
- `soft-delete-prospect` (§9.1 + §7.1) — Master Recruiter only, gated on `claimed_at IS NULL`.
- `transition-requirement-status` (§6.1) — open/closed/cancelled transitions with reopen behavior preserving terminal junctions.
- `transfer-requirement-owner` (§7.1) — owner picker write path.
- `transition-junction-status` (§6.2) — full junction state machine with timestamp side effects.
- `bulk-withdraw-junctions` (§6.5) — shared `bulk_action_id` correlation, one audit event per row.
- `compute-should-prompt-close` (§6.6) — returned as field on transition/detail RPC responses.

**§9 — Audit and deep reads**

- `get-prospect-detail` (§7.2) — writes `read.detail_viewed` before returning data.
- `get-prospect-activity` (§7.2) — writes `read.activity_viewed`.
- `get-requirement-detail` (§7.2) — analogous.
- `get-requirement-activity` (§7.2) — analogous.
- `get-cross-entity-audit` (§7.1 + §9) — Master Recruiter only.
- `get-recent-exports` (§10.2 Reports tab) — audited deep-read RPC powering the Reports tab "recent activity" panel. Queries `audit_log` filtered to `event_type in ('export.pdf_exported', 'export.csv_exported')`. Master Recruiter sees team-wide; future non-Master export holders see only their own events.

**§3 — Notes/remarks helpers**

- `add-prospect-note` (§3.7) — author-bound, mandatory on transitions that require it.
- `edit-prospect-note` (§3.7) — author-only, 5-minute window, sets `edit_locked_at`.
- `add-requirement-remark` / `edit-requirement-remark` — analogous; emit `requirement.remark_added` / `requirement.remark_edited`.

---

## PR Sequencing

Each PR is sized for one reviewer-pass and respects upstream dependencies. Where PRs are independent they can be developed in parallel by different team members.

| # | PR title | Migrations | Edge functions | Depends on |
|---|---|---|---|---|
| 1 | Permissions + audit foundation | A1–A5 | `write_audit_event` | — |
| 2 | Prospect schema + notes | B1, B2, D1, D2, E1 (prospects, notes) | `add-prospect-note`, `edit-prospect-note` | 1 |
| 3 | Requirement schema + remarks | B3, B4, B5, D4, E1 (requirements, remarks, nationalities) | `add-requirement-remark`, `edit-requirement-remark` | 1 |
| 4 | Junction schema + applications link | C1, C3, E1 (junction) | — | 2, 3 |
| 5 | Magic-link infrastructure | C2 | `request-applicant-magic-link` | 2 |
| 6 | Applicant claim flow | — | `claim-applicant-session` | 4, 5 |
| 7 | Email rebind + session revocation | — | `edit-prospect-email-preclaim`, `rebind-prospect-email-postclaim`, `revoke-applicant-sessions` | 6 |
| 8 | Prospect transitions | D3, D5 (prospect triggers) | `transition-prospect-status`, `archive-prospect`, `unarchive-prospect`, `soft-delete-prospect` | 2, 6 |
| 9 | Requirement transitions | D5 (requirement triggers) | `transition-requirement-status`, `transfer-requirement-owner` | 3 |
| 10 | Junction workflow + close-prompt | D5 (junction triggers) | `create-prospect-with-requirement`, `attach-existing-prospect-to-requirement`, `transition-junction-status`, `bulk-withdraw-junctions`, `compute-should-prompt-close` | 4, 8, 9 |
| 11 | Deep-read RPCs | E2 | `get-prospect-detail`, `get-prospect-activity`, `get-requirement-detail`, `get-requirement-activity`, `get-cross-entity-audit`, `get-recent-exports` | 2, 3, 4 |

**Parallelization opportunities:** after PR 1 lands, PRs 2 and 3 can be developed in parallel. PRs 5 and 8 can be developed in parallel once their respective prerequisites land. PR 11 can begin in parallel with the transition PRs (8–10) since it only depends on schema. Critical path is 1 → 2 → 4 → 6 → 7 → (8, 10) ≈ 6 sequential PRs.

---

## Per-PR Acceptance Criteria

Each PR must include:

- Migration files with `up`/`down` semantics where Supabase tooling supports it.
- Edge-function code with tests covering at least: happy path, role-denied path, optimistic-concurrency conflict, and one explicit transition-rejection case from §5.2/§6.1/§6.2.
- RLS test fixture covering Recruiter, Master Recruiter, Coordinator for the tables touched.
- One audit-log assertion per write RPC: event type, actor, payload redaction, presence of `correlation_id` for composite operations.
- Updated entries in `docs/test-plan.md` describing the manual QA flow newly enabled by the PR.

---

## Out of This Doc

Not covered here (intentionally — outside §3/§4/§6/§7/§9 scope):

- §8 Send Invite RPC and bounce webhook — separate kickoff once invite UX is locked.
- §10 Funnel/Dashboard query layer — separate kickoff; depends on PRs 2, 3, 4, 8, 9, 10 being merged.
- §11 PDF/CSV export pipeline — depends on PR 11 (deep-read pattern) plus dashboard query layer.
- §12 Compliance overlay — depends on existing `applicationCompliance.js`; touched only at integration time.
- §13 Cutover steps — runs after all backend PRs land.
- Frontend pages (prospect list, requirement detail, funnel, dashboard) — sequenced after the backend RPCs they consume are stable.

---

## Suggested Next Step

Open PR 1 with the permissions seed, role mappings, audit_log table, and the `write_audit_event` helper. This is the smallest reviewable unit and unblocks all parallel work downstream. Estimate: ~2 days for a senior engineer, plus tests.
