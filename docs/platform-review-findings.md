# Platform Review: Findings, Decisions, First Slice

Review of `docs/platform-review-brief.md` (2026-11-02). Code baseline `ui/warm-theme` @ `4315444` (docs tip `eac99d4`); Needle inspected at `fb22a53`. No production systems, migrations or candidate data were touched.

Severity: **P1** blocks build-ready sign-off or risks a privacy/tenancy leak · **P2** causes rework or untestable work · **P3** documentation drift.

## 1. Findings

### P1

**F1. "Customer" means two different parties.**
`prd.md:7`, `decisions.md:27` use *customer* for the manning company that uses Holmes (Njordships). `recruitment-flow.md:24`, `needle-integration.md:51`, `tasks.md:14` use *customer* for the party a candidate is submitted to and the *customer worksheet* is produced for (the principal/shipowner, e.g. CMA CGM). The "customer portal" is therefore undefined: is it for the manning company or for its principal?
*Fails when:* a permission rule written as "customer sees only its own requirements" is implemented for the wrong party; a principal sees the manning company's pipeline, or a manning company is denied its own data.
*Decided 2026-11-02:* use **operator** (Holmes owner), **organization** (a manning company using Holmes) and **principal** (the organization's client, e.g. the shipowner, who receives the Excel worksheet once the offer is accepted and documents are verified; principal steps after hire are out of scope). Rename "customer portal" to "principal portal" or drop it from scope.

**F2. Needle's current identity rules auto-merge on a single signal, contradicting the Holmes contract.**
`needle/candidate_identity.py:6-11`: *same email OR same phone → same candidate*; *same name + DOB → same candidate*. `needle-integration.md:32` and `recruitment-flow.md:40` forbid silent merges on any single signal.
*Fails when:* crewing CVs commonly carry an agent's or family member's email/phone. Two seafarers sharing one phone are merged; the newer resume becomes "active" for both (docstring line 13) and one person's documents surface under another's name.
*Decision:* for Holmes, Needle may only *propose* links; the confirmed link lives in Holmes with an audit row and is reversible. *Test:* two resumes, same phone, different name/DOB → two people + one review item.

**F3. Holmes invite claim binds by email alone and will cross organizations.**
`supabase/migrations/2026060307_claim_rebind_session_revocation.sql:39-45` selects the newest `approved` prospect with that `email_normalized` (`limit 1`), with no organization scope.
*Fails when:* two organizations invite the same seafarer; the claim binds the session to whichever prospect is newest, attaching the person's draft to the wrong organization.
*Decision/test:* claim must carry the invite token's prospect id (not just email) and be organization-scoped. *Test:* same email invited by org A then org B → each claim lands only in its own org.

**F4. Importing the existing Needle corpus into a shared directory has no rights basis.**
`needle-integration.md:11,74` and `decisions.md:7` plan "one canonical resume pool" including the existing Needle corpus. That corpus was gathered by Seajobs downloading/scraping, which this plan itself excludes from Holmes (`needle-integration.md:41`). Those people never consented to a cross-company directory or to contact by other organizations.
*Fails when:* organization B contacts a seafarer whose resume was obtained for organization A; the seafarer has no account, no consent record and no way to opt out.
*Decision:* imported/scraped resumes are **operator-private and organization-scoped by origin**, never shown in the shared Available directory, and only become shareable after the person claims a portal account and opts in. Add a deletion/opt-out path before any import.

**F5. Possible shared database between Needle and Holmes.**
Needle's migrations create `public.users`, `public.devices`, `public.candidates`, `public.candidate_events` (`needle/supabase/migrations/001_initial_schema.sql`). Project notes record that the NjordHR/Needle clone was once linked to the same Supabase project as Holmes (`btbqdviuqcpauojmorvx`).
*Fails when:* both schemas share `public`; a future Holmes `candidates` table collides with Needle's, and "neither service may mutate the other's tables" (`needle-integration.md:66`) is unenforceable while both hold service-role keys to one database.
*Decision/test:* verify the live project for Needle tables; run Needle in its own project (or schema) with its own keys before any integration work.

**F6. Today's status control can jump straight past test and interview.**
`src/components/SequentialStatusControl.jsx:184-189` offers "Skip to" any status two or more steps ahead (e.g. `submitted` → `offered`). The target order requires test (or waiver) and interview before the long-form invite.
*Decided 2026-11-02:* a test may be waived; a waiver is an explicit event recorded by a recruiter with a reason — not a skip. Remove free "Skip to" from the new case control.

### P2

**F7. Tenancy is sequenced before the workflow fix it does not block.** `tasks.md:8` (multi-tenant foundation) precedes `tasks.md:10` (correct pre-form flow), while the deployment model is still open (`tasks.md:75`). With one organization, full multi-org RLS can't be meaningfully tested in production and will be redesigned if the deployment answer is "separate deployments". *Recommendation:* do the case/workflow slice first, carrying an `organization_id` (single seeded org) so tenancy is additive later.

**F8. Untestable acceptance language.** "reliable resume facts" (`brief`, `recruitment-flow.md:24`), "confirmed fields" (`recruitment-flow.md:24`), "Available candidates appear" without a freshness rule (`recruitment-flow.md:45`), "compare ranking and explanations" with no threshold (`needle-integration.md:70,88`). Each needs a measurable definition (see §2, decisions 6–8).

**F9. Worksheet generation and principal handoff need separate gates.** *Owner decision:* a recruiter may generate/download the worksheet at any time after long-form submission, including before selection, offer acceptance, or document verification. Holmes has no principal-delivery channel in this slice: after offer acceptance and document verification, a recruiter records an audited attestation that they sent the worksheet outside Holmes. This controls the record, not an external email. The current `ViewApplication` button and worksheet service check export permission/template availability but do not enforce submission status; add that minimum check without introducing an offer/document gate on generation.

**F10. No owner for requirement publication and closure.** Requirements gain `published/private` (`recruitment-flow.md:8`) but no state says who publishes, what happens to open interests/cases when a requirement is filled, cancelled or edited after interest was expressed. Add requirement states `draft → published → closed(filled|cancelled)` and the effect on open cases.

**F11. Needle contract is a scaffold.** `needle/cloud_api/app.py` exposes only `/health`, `/runtime/ready`, `/v1/ping`; search lives in the desktop `backend_server.py`, identity in local SQLite. `needle-integration.md:59,68` already says so, but `tasks.md:13` sequences Needle after the portal without listing "build the server API" as its own milestone. It is the largest unknown and should be estimated separately.

### P3

**F12. Stale or contradictory documentation.** `decisions.md:29`, `README.md:5`, `design.md:6`, brief line 11: operator wording "pending" / "uncommitted" — now committed (`0150dc1`, operator: Kartik Raghavan). `prd.md:128` and `test-plan.md:91` still reference Google OAuth, removed from the applicant UI. `tasks.md` old checklist includes items already done on this branch (branding pass, compliance changes).

## 2. The eight decisions

| # | Decision | Recommendation | Resolve now / defer |
|---|---|---|---|
| 1 | Organization model | One shared deployment and database; `organization_id` on every tenant-owned row; operator staff are a separate platform role outside organization memberships; multi-company users via a memberships table. | **Resolve now** (the column), defer multi-org RLS until a second organization signs. |
| 2 | Candidate visibility and data rights | Sourced/imported resumes private to the originating organization; shared directory only for portal candidates who opt in; interest in a requirement grants that organization access to the profile for that requirement; revocation hides the profile from new searches but keeps existing cases. Existing Needle corpus: not imported into the shared pool (F4). | Resolve the corpus rule now; defer the rest to the portal phase. |
| 3 | Recruitment state machine | **Decided 2026-11-02:** test may be waived (recruiter, with reason); recruiter makes the final selection; long form invited any time after a passed interview; offer → offer accepted → documents submitted → verified → worksheet sent to principal → hired. Holmes ends at hired. See §3. | **Resolved.** |
| 4 | Terminology | **Interest** (candidate-initiated, lightweight), **Case** (person × requirement workflow), **Application form** (long post-interview form; keep table `applications` for compatibility, relabel in UI/reports). | **Resolve now.** |
| 5 | Dedup and claims | Identity precedence: verified account > email **and** (phone or DOB) agree → *propose*; never auto-merge. Links are rows (reversible), not destructive merges. One active case per person × requirement; a reopened requirement starts a new cycle number. | Resolve the claim fix (F3) now; full dedup with the portal. |
| 6 | Publication and availability | Organization admin publishes; listing shows rank, vessel type, joining window, contract length, nationality rules — no principal name unless chosen. Availability expires after 30 days without reconfirmation. | Defer to portal phase. |
| 7 | Needle contract and delivery | Separate project; Holmes calls `POST /v1/search`, `POST /v1/match`, `GET /v1/resumes/{id}` with a short-lived token minted by a Holmes edge function carrying organization + role (never client-supplied). Pin a release tag per environment. Extraction gate: reuse the FV40 acceptance criteria already in use (field and row recall, max 0.2-point drop, zero invalid/truncated outputs). Ranking gate: precision@10 against recruiter-labelled requirement/resume pairs — threshold to be set from a first labelled set. | Defer; start the labelled benchmark now. |
| 8 | Long-form prefill | Prefill only fields with an explicit mapping and extraction status `ok`; each prefilled field shows "from your resume — confirm"; nothing submits unconfirmed. Principal-specific worksheet fields are asked in the form, not inferred. | Defer until the case slice ships. |

## 3. Recruitment case: states and permissions

**States** (one active case per person × requirement; history kept as append-only events):

`sourced` / `interested` → `contacted` → `confirmed` (interest + availability) → `test_scheduled` → `test_passed` | `test_waived` (recruiter, reason) | `test_failed` | `test_no_show` → `interview_scheduled` → `interview_passed` | `interview_failed` | `interview_no_show` → `selected` (recruiter) → `offered` → `offer_accepted` | `offer_declined` → `documents_pending` → `documents_submitted` → `documents_verified` (recruiter) → `principal_submission_recorded` (recruiter attests to an outside-Holmes send) → `hired` (end of Holmes workflow)

Long form (parallel track, not a state): a recruiter may invite it any time after `interview_passed`, with a notice that form completion does not mean selection. Once `form_submitted`, the worksheet may be generated/downloaded at any case stage; generation neither sends it nor changes the case. `principal_submission_recorded` additionally requires offer acceptance and verified documents and captures actor, time, recipient, channel, and worksheet version. Retention for unselected candidates' sensitive fields needs approval before rollout.

Terminal from any open state: `withdrawn` (reason, by candidate or recruiter), `rejected` (reason, including `principal_declined` after handoff), `closed` (requirement filled/cancelled). Principal steps after `hired` are out of scope.

**Who may do what** (✓ allowed · — denied; all actions audited; no AI, search or status change sends email). `Master Recruiter`, `Recruiter`, and `Coordinator` are the only organization recruiter roles; Holmes owner support is separate:

| Action | Holmes owner support | Master Recruiter | Recruiter | Coordinator | Candidate | Principal |
|---|---|---|---|---|---|---|
| Create case from interest / available / search | support only | ✓ | ✓ | — | via Interest | — |
| Record contact, confirmation | — | ✓ | ✓ | ✓ | — | — |
| Schedule test / interview | — | ✓ | ✓ | ✓ | — | — |
| Record test / interview result | — | ✓ | ✓ | — | — | — |
| Waive test (reason required) | — | ✓ | ✓ | — | — | — |
| Select (after interview) | — | ✓ | ✓ | — | — | — |
| Send form invite (explicit, idempotent) | — | ✓ | ✓ | — | — | — |
| Make / record offer, verify documents, mark hired | — | ✓ | ✓ | — | — | — |
| Attest to manual worksheet send to principal | — | ✓ | ✓ | — | — | — |
| Withdraw | — | ✓ | ✓ | — | own case | — |
| Read other organizations' cases | break-glass, logged | — | — | — | — | — |

## 4. Smallest build-ready first slice: "Recruitment case v1"

**In:** single organization (seeded), `organization_id` on new tables; `recruitment_cases` + append-only `recruitment_case_events`; entry only from today's routes (recruiter adds a prospect to a requirement); test, waiver, interview, selection, offer, and documents recorded on the case; legacy prospect/requirement/application rows backfilled read-only as cases with `source = legacy`; behind a feature flag with KPI read parity; claim fix (F3).
**Out:** enabled pre-selection long-form invites, candidate portal, Interest, Available queue, Needle, principal handoff/decline, principal portal, multi-org RLS, prefill, dedup beyond the claim fix. The invite gate may be implemented behind the flag but must not expose pre-selection data collection until notice and retention are approved.

**Acceptance tests**

1. Adding a prospect to a requirement twice yields one case (idempotency key); a second add records a second source event.
2. Test and interview results can be recorded with no `applications` row existing.
3. If the invite gate is implemented behind the flag, it rejects invitations before `interview_passed` and does not require selection or offer; pre-selection invites remain disabled until notice and retention are approved.
4. `interview_failed`, `interview_no_show`, `test_failed`, `test_no_show`, `withdrawn`, `rejected` cases cannot be invited, via UI or API.
5. Sending the invite twice sends one email and logs one event.
6. No status change or event sends an email except the explicit invite and existing explicit sends.
7. "Skip to" is not available on cases; a test waiver requires a recruiter and a non-empty reason, and appears in the event history.
8. Same email invited by two prospects: claim binds to the prospect named in the invite token, not the newest row.
9. Backfill: every existing prospect-requirement pair has exactly one case; every existing application links to its case; counts on Dashboard/KPI match pre-backfill values.
10. Feature flag off restores the current UI and data paths unchanged; rollback drops only the new tables.
11. Coordinator cannot record results, waive, select or invite (API-level denial, not just hidden buttons).
12. `selected` can only be recorded after `interview_passed`; selection itself sends no email.
13. `hired` is the final Holmes state; nothing after it is tracked.
14. Every case transition writes an event with actor, time, from/to and reason where required.

**Later release gates, not blockers to starting case v1:** a recruiter may generate/download the worksheet after long-form submission at any case stage, but not from a draft. A pre-selection invite shows the candidate notice and follows an approved retention/deletion rule. Recording a manual send to the principal requires form submission, offer acceptance, and `documents_verified`, and stores actor, time, recipient, channel, and worksheet version; the app does not claim to send or block external email. A principal decline before hire records a distinct reason after its taxonomy is approved.

## 5. Recommended order after the first slice

1. Fix F5 (separate Needle database) and start the labelled ranking benchmark (decision 7) in parallel — both are cheap and unblock later work.
2. Candidate portal + Interest + Available queue (decisions 2, 5, 6) — only when a second organization or a candidate-intake need is real.
3. Needle server API and AI tab (F11).
4. Multi-org RLS and organization onboarding when a second organization joins; a principal portal remains out of scope.

Keep scope pinned to what the current organization uses; the candidate portal and Needle service are each larger than the first slice. A principal portal remains out of scope.

## 6. Owner decisions (2026-11-02) and source docs that now conflict

The conflict references below describe the source docs at the published `eac99d4` baseline. They are retained as review history; the subsequent local source-document alignment changes those lines and should be checked against `docs/recruitment-flow.md` and `docs/decisions.md` rather than treated as still-open findings.

Decided order: contact → confirm → test (pass, or recruiter waiver with reason) → interview → recruiter selection → offered → offer accepted → documents submitted → documents verified → recruiter-attested manual worksheet send to principal → hired. The long form may be invited any time after a passed interview. Its worksheet may be generated/downloaded any time after form submission, regardless of the case's later stages; recording the manual send waits for offer acceptance and verified documents. Holmes ends at hired. Terms: operator (Holmes owner), organization (manning company), recruiter app (organization staff), principal (organization client).

The source docs were left unchanged for the author to update. Lines that conflict with these decisions:

- `recruitment-flow.md:10` — long form described as "post-selection"; it is post-interview and parallel.
- `recruitment-flow.md:22,33,47` — invite gated on test pass + interview pass + selection; the gate is a passed interview only.
- `recruitment-flow.md:24` — customer review/offer ordering "needs sign-off"; now decided (offer → documents → worksheet to principal → hired).
- `needle-integration.md:13,49,77` — form invited after selection; same correction as above.
- `prd.md:5,15,76,78,84`, `decisions.md:9,21`, `tasks.md:11,76`, `test-plan.md:24`, `documentation.md:15`, `platform-review-brief.md:30,32,44,56` — same gate/order wording; "customer" used for the principal.

## 7. Second-Pass Findings And Patch Disposition

**P1 — Operator/recruiter ambiguity.** The earlier docs used "operator portal/search" for organization recruiters while defining operator as the Holmes owner. The source docs now use **recruiter app/AI workspace** for organization staff and reserve **operator** for platform ownership/support. The first-slice permission matrix must keep platform support separate from the three recruiter roles; wording alone does not enforce this.

**P2 — Principal handoff is not an in-app send.** The first-slice working design is a recruiter-attested **manual send outside Holmes**, recorded as `principal_submission_recorded` after form submission, offer acceptance, and verified documents. Capture actor, time, recipient, channel, and worksheet version. This cannot prevent an external email or prove delivery. Automated principal delivery would be a separate future feature and still needs owner sign-off.

**P2 — Sensitive form data before selection.** Candidate-facing invite copy must say that form completion does not imply selection. Retention/deletion for passport, medical, bank, and next-of-kin data of unselected or rejected candidates is an unresolved launch decision in `docs/tasks.md`; do not invent a retention period.

**P2 — Principal decline.** The proposed minimal case outcome is `rejected` with reason code `principal_declined`, preserving the stage for KPI/reporting. Confirm the reason taxonomy before implementation.

**Existing security/design findings remain open.** `docs/tasks.md` now explicitly tracks Needle auto-merge (F2), email-only invite claim (F3), scraped-resume rights (F4), possible shared database (F5), and the case-before-full-tenancy sequence (F7). These are not closed merely by adding backlog entries. Legal copy review also remains separate from the fact that Terms was committed locally.

## 7. Second-pass findings (2026-11-02)

Scope: the locally aligned source docs (uncommitted working tree on `ui/warm-theme` after `7f4c02f`), re-read against the first-pass findings and current code. The case order, post-interview long-form invite, worksheet generation rule and principal-delivery gate are now stated consistently across `recruitment-flow.md`, `needle-integration.md`, `prd.md`, `decisions.md`, `tasks.md`, `test-plan.md`, `documentation.md` and the brief.

Status note (later the same day): the working-tree source docs were patched after these findings were raised. Each finding below carries its status as of that patch. Nothing here is committed or pushed.

### Blockers to first-slice sign-off

**S1 (P1, blocker). "Operator" still has two meanings.** `decisions.md:26` defines **operator** as the Holmes owner. Elsewhere it names the recruiter-facing app used by a manning organization's staff: "operator portal" (`recruitment-flow.md:26`, `needle-integration.md:41,79`, `tasks.md:13`, brief line 46), "operator search" (`needle-integration.md:11`), "operator contact and availability confirmation" (`prd.md:76`).
*Fails when:* "explicit operator privileges" (`tasks.md:8`) is implemented and either grants platform-owner powers to every organization's recruiters or withholds them from the owner.
*Decision needed:* reserve **operator** for the Holmes owner and its staff; name the organization's screens the **recruiter app** / **recruiter AI workspace**.
*Status:* **addressed in working tree** — `decisions.md:26`, `recruitment-flow.md:5`, `prd.md:9` define the terms; the earlier "operator portal/search/contact" uses now read "recruiter app" / "recruiter AI workspace". No conflicting use remains. Blocker cleared once committed.

**S2 (P1, blocker). Principal delivery cannot be enforced by Holmes.** Holmes has no principal channel (no principal portal; no principal email exists in code), and the worksheet can be downloaded as soon as the long form is submitted. The offer-accepted and documents-verified gates therefore control when a send can be *recorded*, not whether a downloaded file is emailed.
*Recommendation for the first slice (owner):* record a **recruiter-attested manual send** — the recruiter states that they sent the worksheet, with date, recipient and the generated file version; Holmes does not claim to have sent it. The gates apply to recording that action.
*Test 14 should read:* recording "worksheet sent to principal" requires a submitted form, an accepted offer and `documents_verified`; the event stores the attesting recruiter, time, recipient and worksheet version; the UI never states that Holmes delivered it.
*Status:* **decided by owner (2026-11-02): the worksheet is sent manually**; Holmes records a recruiter attestation. Previously the first-slice working assumption (`recruitment-flow.md:3,26,50`, `decisions.md:31`, `test-plan.md:24`, `tasks.md:86`). Blocker clears on sign-off; whether Holmes should ever send to the principal itself is a later decision.

### Other second-pass findings

**S3 (P2). Long forms from candidates who are not selected.** The form may now be completed before selection, so a candidate who is not selected will already have supplied passport, medical, bank and next-of-kin data.
*Decision needed:* retention period and deletion rule for long forms on cases that end `rejected`, `withdrawn` or `closed`; and invitation wording that does not imply selection.
*Status:* **recorded as open** (`recruitment-flow.md:26,51`, `tasks.md:85`); must be approved before early invites ship.

**S4 (P2). No outcome for a principal decline before hire.** If the principal declines after receiving the worksheet, the case has no matching state.
*Decision needed:* record it as `rejected` with reason `principal_declined` so KPI reporting can count it.
*Status:* **dropped by owner (2026-11-02): no principal-decline information is needed.** The `principal_declined` references in `recruitment-flow.md:26,51`, `decisions.md:32`, `test-plan.md:24` and `tasks.md:86` can be removed later; they do not affect the first slice. A case that ends without hire uses the generic terminal states.

**S5 (P2). First-pass findings not tracked in the backlog.** F2 (Needle auto-merge on email or phone), F3 (invite claim binds by email alone), F4 (rights to the scraped corpus), F5 (possible shared Supabase project with Needle) and F7 (multi-organization RLS sequenced before the case slice — `tasks.md:8` still precedes `tasks.md:10`) have no backlog entries.
*Needed:* one `tasks.md` line each, or an explicit deferral.
*Status:* **addressed** — `tasks.md:16-22` "Review Risks To Track" lists F2, F3, F4, F5 and F7 with the test each needs.

**S6 (P3). Stale identity section and open legal review.** `decisions.md:37-46` still says "Njordships is a customer" and "legal wording pending approval", superseded by the operator/organization/principal terms. The Terms operator line committed in `0150dc1` is **not** legal approval: legal review of the Terms and Privacy pages remains open (this also qualifies F12, which only noted the commit).
*Status:* **addressed** — `decisions.md:37-46` now uses the organization terms and states that full legal copy, entity/contact details and Privacy wording still need owner/legal review.

### Outcome

The recruitment workflow is consistent enough to specify the first slice. S1 is resolved in the working tree; S2 is decided (manual send, recruiter-attested) and S4 is dropped. Neither affects the first slice, which stops before principal handoff; the leftover `principal_declined` / "pending sign-off" wording in the source docs is cleanup for whenever those docs are next edited, not a blocker. First-slice sign-off needs only the doc patches committed. S3 retention is required before early long-form invites ship, not before the case slice starts. Legal review (S6) stays open independently.
