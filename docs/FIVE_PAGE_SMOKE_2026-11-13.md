# Five-page smoke — 2026-11-13

## Release and outcome

Approved applicant UI release `c6499bd2f58083583e53823d8f835906be83e4cb`
was promoted to main. Primary Vercel deployment `7746949878` succeeded.
Production smoke used the normal operator session and labelled synthetic records.
No schema, Function, Needle deployment or intake activation was performed.

The main requirement-to-candidate-to-recruitment flow passed. AI Search is **not
all clear**: duration refinement and a company-history question failed below.

## Coverage

| Area | Live evidence | Additional synthetic coverage |
| --- | --- | --- |
| Companies & ships | Add/edit company and ship, vessel type, directory search, reload | Collapse/grouping, validation, read-only roles, mobile layout |
| Requirements | Add Draft; matching disabled until Open; edit/open, details, Back, matching, pagination, résumé review, identity confirmation, attachment | Match errors, filter/grouping, role restrictions and empty states |
| Candidates | Add basic details without CV, edit/reload, search, disabled attachment without CV; attached grouping and exact requirement link after reload | CV states, attach guards, identity paths, profile and responsive layout |
| Recruitment | Exact-case drawer, take over, attention filter, start contact task, mark contacted, confirm interest, completed task/performer after reload; scheduling form and required-field guard; profile/application/Back links; close synthetic case | Assignment/handover, KPI credit preservation, task persistence, role denial and mobile layout |
| AI Search | Fresh search; explicit Show results; result pagination; refinement filters; new-search reset; no-match output; count answer and reload; Repository search/preview; Review queue/detail; full-space shell | Sidebar keyboard/mobile/embedded interactions |

### Requirement matching

Synthetic requirement `2026-Nov-005` requested Chief Officer / Bulk Carrier.
The live matcher returned **125**, with both required criteria confirmed. Page 2
contained the existing synthetic seafarer. Original résumé review rendered page
1 of 1. Identity review reused that candidate, attached it once, then showed
Already attached. Candidates grouped it under the correct company and ship;
reload preserved the exact requirement link. A new candidate without a CV could
not be attached.

### AI Search outcomes

- Fresh prompt: `Find Chief Officers with bulk carrier experience` → **125**.
  Results appeared only after Show results. Candidate details hydrated afterward.
- Refine + age tray 35–50 + `At least 12 months in present rank` → rejected,
  claiming the rank was unspecified despite visible Chief Officer selection.
- Explicit wording `Chief Officers with at least 12 months of sea service as
  Chief Officer` → rejected, asking whether duration meant total sea service,
  time in rank or vessel experience. One retry reproduced this clarification.
- Explicitly empty prompt with age tray 35–50 and retained rank/ship → **98**.
  The earlier retry was not a tray-only result; the failed prompt had remained
  in composer state. Only this explicit-empty run establishes tray-only success.
- Ask `How many candidates are in these results?` → **125 candidates**.
  The answer and Continue this thread persisted after reload.
- Continue after reload: `Which companies have these candidates worked for?`
  → `I could not verify every part of that answer. Please ask for one result at
  a time.` This single-question failure needs server trace/root-cause review.
- New search cleared old criteria. `Find Masters with gas tanker experience`
  plus tray age 16–17 → no matches, no new Show results action. Older successful
  answers retained their own result buttons as expected.
- Repository name search found the synthetic résumé. Its preview accurately
  reported missing formatted text and offered the original PDF download.
- Review queue and a pending-facts detail opened read-only; no extraction was
  approved, rejected, corrected or published.

These are observed failures, not a claim that the model/tool schema is their
root cause. Inspect the deployed parser/controller request, context merge,
validation and answer-verification traces before proposing a repair.

## Automated checks

Command used the synthetic-only Vite server on port 5237, Supabase invalid host
and AI Search enabled. Suites: fleet-directory, candidate-directory,
recruitment-workspace and ai-sidebar, with Playwright dependencies disabled.
Initial result: **33/34**. The failing test incorrectly forbade Recruiter
matching even when AI Search was enabled. The corrected assertion follows the
existing permission contract; the targeted Recruiter and Coordinator rerun
passed **2/2**. Thus all 34 cases are covered across the run and retest, not a
fresh final full-suite run. No application permission change was made.

## Cleanup and limits

- New company/ship and no-CV candidate remain clearly labelled synthetic.
- This smoke's recruitment case and requirement are Closed; history retained.
  Native browser confirmation stalled automation. Read-only database verification
  confirmed the requirement was already closed; the guarded cleanup script stopped
  before any write because its expected Open precondition was false.
- No emails, calendar invitations, real hiring decisions or new CV intake.
  Scheduling submission, archive/delete and external delivery were not repeated.
- Normal live operator checks passed. The preserved Chrome Coordinator tab was
  inaccessible to automation; Coordinator restrictions passed synthetic tests.
- Existing blob-PDF rendering has the owner's visual confirmation. No blocked
  blob-inspection workaround was attempted. Requirement review rendered its
  embedded original normally.
- Applicant draft-specific validation and expired-link recovery have the prior
  44 regression checks; this turn did not change the applicant session to replay
  those actions in production. Submitted application viewing/Back passed live.
- User approved a separate US$1 live-model allowance. Conservatively reserve
  the full dollar until provider charges are reconciled; actual cost is unverified.
- Private screenshots and synthetic IDs are retained under the ignored
  `.local/five-page-smoke-20261113/` task directory in the Needle workspace.
