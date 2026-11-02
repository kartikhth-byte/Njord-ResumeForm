# Platform Review: Findings, Decisions, First Slice

Review of `docs/platform-review-brief.md` (2026-11-02). Code baseline `ui/warm-theme` @ `4315444` (docs tip `eac99d4`); Needle inspected at `fb22a53`. No production systems, migrations or candidate data were touched.

Severity: **P1** blocks build-ready sign-off or risks a privacy/tenancy leak · **P2** causes rework or untestable work · **P3** documentation drift.

## 1. Findings

### P1

**F1. "Customer" means two different parties.**
`prd.md:7`, `decisions.md:27` use *customer* for the manning company that uses Holmes (Njordships). `recruitment-flow.md:24`, `needle-integration.md:51`, `tasks.md:14` use *customer* for the party a candidate is submitted to and the *customer worksheet* is produced for (the principal/shipowner, e.g. CMA CGM). The "customer portal" is therefore undefined: is it for the manning company or for its principal?
*Fails when:* a permission rule written as "customer sees only its own requirements" is implemented for the wrong party; a principal sees the manning company's pipeline, or a manning company is denied its own data.
*Decided 2026-11-02:* use **operator** (Holmes owner), **organization** (a manning company using Holmes) and **principal** (the organization's client, e.g. the shipowner, who receives the Excel worksheet after selection). Rename "customer portal" to "principal portal" or drop it from scope.

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
`src/components/SequentialStatusControl.jsx:184-189` offers "Skip to" any status two or more steps ahead (e.g. `submitted` → `offered`). The target gate (`recruitment-flow.md:47`) requires a test pass, an interview pass and selection before the long form.
*Decided 2026-11-02:* a test may be waived; a waiver is an explicit event recorded by a recruiter with a reason — not a skip. Remove free "Skip to" from the new case control.

### P2

**F7. Tenancy is sequenced before the workflow fix it does not block.** `tasks.md:8` (multi-tenant foundation) precedes `tasks.md:10` (correct pre-form flow), while the deployment model is still open (`tasks.md:75`). With one organization, full multi-org RLS can't be meaningfully tested in production and will be redesigned if the deployment answer is "separate deployments". *Recommendation:* do the case/workflow slice first, carrying an `organization_id` (single seeded org) so tenancy is additive later.

**F8. Untestable acceptance language.** "reliable resume facts" (`brief`, `recruitment-flow.md:24`), "confirmed fields" (`recruitment-flow.md:24`), "Available candidates appear" without a freshness rule (`recruitment-flow.md:45`), "compare ranking and explanations" with no threshold (`needle-integration.md:70,88`). Each needs a measurable definition (see §2, decisions 6–8).

**F9. Worksheet timing contradicts current behaviour.** Target: worksheet comes from the completed post-selection form (`recruitment-flow.md:10,24`). Current ViewApplication lets recruiters generate a worksheet "at any application stage". Decide whether early worksheets remain allowed (draft-stamped) or are blocked.

**F10. No owner for requirement publication and closure.** Requirements gain `published/private` (`recruitment-flow.md:8`) but no state says who publishes, what happens to open interests/cases when a requirement is filled, cancelled or edited after interest was expressed. Add requirement states `draft → published → closed(filled|cancelled)` and the effect on open cases.

**F11. Needle contract is a scaffold.** `needle/cloud_api/app.py` exposes only `/health`, `/runtime/ready`, `/v1/ping`; search lives in the desktop `backend_server.py`, identity in local SQLite. `needle-integration.md:59,68` already says so, but `tasks.md:13` sequences Needle after the portal without listing "build the server API" as its own milestone. It is the largest unknown and should be estimated separately.

### P3

**F12. Stale or contradictory documentation.** `decisions.md:29`, `README.md:5`, `design.md:6`, brief line 11: operator wording "pending" / "uncommitted" — now committed (`0150dc1`, operator: Kartik Raghavan). `prd.md:128` and `test-plan.md:91` still reference Google OAuth, removed from the applicant UI. `tasks.md` old checklist includes items already done on this branch (branding pass, compliance changes).

## 2. The eight decisions

| # | Decision | Recommendation | Resolve now / defer |
|---|---|---|---|
| 1 | Organization model | One shared deployment and database; `organization_id` on every tenant-owned row; operator staff are a separate platform role outside organization memberships; multi-company users via a memberships table. | **Resolve now** (the column), defer multi-org RLS until a second organization signs. |
| 2 | Candidate visibility and data rights | Sourced/imported resumes private to the originating organization; shared directory only for portal candidates who opt in; interest in a requirement grants that organization access to the profile for that requirement; revocation hides the profile from new searches but keeps existing cases. Existing Needle corpus: not imported into the shared pool (F4). | Resolve the corpus rule now; defer the rest to the portal phase. |
| 3 | Recruitment state machine | **Decided 2026-11-02:** test may be waived (recorded, with reason); the recruiter makes the final selection after the interview; the long form follows selection. The Excel worksheet from the long form goes to the principal after selection. See §3. | **Resolved.** |
| 4 | Terminology | **Interest** (candidate-initiated, lightweight), **Case** (person × requirement workflow), **Application form** (long post-selection form; keep table `applications` for compatibility, relabel in UI/reports). | **Resolve now.** |
| 5 | Dedup and claims | Identity precedence: verified account > email **and** (phone or DOB) agree → *propose*; never auto-merge. Links are rows (reversible), not destructive merges. One active case per person × requirement; a reopened requirement starts a new cycle number. | Resolve the claim fix (F3) now; full dedup with the portal. |
| 6 | Publication and availability | Organization admin publishes; listing shows rank, vessel type, joining window, contract length, nationality rules — no principal name unless chosen. Availability expires after 30 days without reconfirmation. | Defer to portal phase. |
| 7 | Needle contract and delivery | Separate project; Holmes calls `POST /v1/search`, `POST /v1/match`, `GET /v1/resumes/{id}` with a short-lived token minted by a Holmes edge function carrying organization + role (never client-supplied). Pin a release tag per environment. Extraction gate: reuse the FV40 acceptance criteria already in use (field and row recall, max 0.2-point drop, zero invalid/truncated outputs). Ranking gate: precision@10 against recruiter-labelled requirement/resume pairs — threshold to be set from a first labelled set. | Defer; start the labelled benchmark now. |
| 8 | Long-form prefill | Prefill only fields with an explicit mapping and extraction status `ok`; each prefilled field shows "from your resume — confirm"; nothing submits unconfirmed. Principal-specific worksheet fields are asked in the form, not inferred. | Defer until the case slice ships. |

## 3. Recruitment case: states and permissions

**States** (one active case per person × requirement; history kept as append-only events):

`sourced` / `interested` → `contacted` → `confirmed` (interest + availability) → `test_scheduled` → `test_passed` | `test_waived` (reason) | `test_failed` | `test_no_show` → `interview_scheduled` → `interview_passed` | `interview_failed` | `interview_no_show` → `selected` (recruiter) → `form_invited` (explicit) → `form_submitted` → `submitted_to_principal` (worksheet sent) → `principal_accepted` | `principal_rejected` → `offered` → `offer_accepted` | `offer_declined` → `documents_pending` → `joined`

Terminal from any open state: `withdrawn` (reason, by candidate or recruiter), `rejected` (reason), `closed` (requirement filled/cancelled). Decided 2026-11-02: test waiver allowed; recruiter selects after the interview; long form after selection; Excel worksheet to the principal after the form.

**Who may do what** (✓ allowed · — denied; all actions audited; no AI, search or status change sends email):

| Action | Operator | Org admin | Recruiter | Coordinator | Candidate | Principal |
|---|---|---|---|---|---|---|
| Create case from interest / available / search | support only | ✓ | ✓ | — | via Interest | — |
| Record contact, confirmation | — | ✓ | ✓ | ✓ | — | — |
| Schedule test / interview | — | ✓ | ✓ | ✓ | — | — |
| Record test / interview result | — | ✓ | ✓ | — | — | — |
| Waive test (reason required) | — | ✓ | ✓ | — | — | — |
| Select (after interview) | — | ✓ | ✓ | — | — | — |
| Send form invite (explicit, idempotent) | — | ✓ | ✓ | — | — | — |
| Submit to principal / record principal decision | — | ✓ | ✓ | — | — | own requirements only |
| Withdraw | — | ✓ | ✓ | — | own case | — |
| Read other organizations' cases | break-glass, logged | — | — | — | — | — |

## 4. Smallest build-ready first slice: "Recruitment case v1"

**In:** single organization (seeded), `organization_id` on new tables; `recruitment_cases` + append-only `recruitment_case_events`; entry only from today's routes (recruiter adds a prospect to a requirement); test/interview/selection recorded on the case; long-form invite gated on the case; legacy prospect/requirement/application rows backfilled read-only as cases with `source = legacy`; behind a feature flag with KPI read parity; claim fix (F3).
**Out:** candidate portal, Interest, Available queue, Needle, principal portal, multi-org RLS, prefill, dedup beyond the claim fix.

**Acceptance tests**

1. Adding a prospect to a requirement twice yields one case (idempotency key); a second add records a second source event.
2. Test and interview results can be recorded with no `applications` row existing.
3. Invite action is hidden/rejected until `test_passed` (or `test_waived`), `interview_passed` and `selected` are all present.
4. `test_failed`, `interview_failed`, `*_no_show`, `withdrawn`, `rejected` cases cannot be invited, via UI or API.
5. Sending the invite twice sends one email and logs one event.
6. No status change or event sends an email except the explicit invite and existing explicit sends.
7. "Skip to" is not available on cases; a test waiver requires a recruiter and a non-empty reason, and appears in the event history.
8. Same email invited by two prospects: claim binds to the prospect named in the invite token, not the newest row.
9. Backfill: every existing prospect-requirement pair has exactly one case; every existing application links to its case; counts on Dashboard/KPI match pre-backfill values.
10. Feature flag off restores the current UI and data paths unchanged; rollback drops only the new tables.
11. Coordinator cannot record results, waive, select or invite (API-level denial, not just hidden buttons).
13. `selected` can only be recorded after `interview_passed`; selection itself sends no email.
12. Every case transition writes an event with actor, time, from/to and reason where required.

## 5. Recommended order after the first slice

1. Fix F5 (separate Needle database) and start the labelled ranking benchmark (decision 7) in parallel — both are cheap and unblock later work.
2. Candidate portal + Interest + Available queue (decisions 2, 5, 6) — only when a second organization or a candidate-intake need is real.
3. Needle server API and AI tab (F11).
4. Multi-org RLS and principal portal when the second organization onboards.

Keep scope pinned to what the current customer uses; the portal, Needle service and principal portal are each larger than the first slice.
