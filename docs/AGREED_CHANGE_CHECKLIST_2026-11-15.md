# Agreed-change checklist and smoke — 2026-11-15

Scope: the current Holmes branch `codex/holmes-shared-lists-20261114`, compared
with the 2026-11-14 shared-list decisions and the owner's presentation. This is
a release checklist, not a claim that the feature is deployed. AI Search is
checked for role/navigation regression, not redesigned here.

Status key: **Local pass** = source inspection plus relevant synthetic browser
coverage; **Partial** = the agreed behavior is only present on some screens or
has a known coverage gap; **Live pending** = local tests pass but a signed-in
staging session must confirm data and permissions; **Decision retained** = an
explicit product choice from the agreed scope.

| Agreed change | Screens / evidence | Status |
| --- | --- | --- |
| Shared organization lists visible independent of assignment; another recruiter can take over a case or task | Requirements, Candidates, Recruitment, Applications; directory and takeover browser checks | **Live partial** — a staging Recruiter saw rows assigned to another recruiter and took over an unassigned synthetic case; a second login has not checked the same rows |
| Stable, type-specific IDs; row serials; one header per list; created/modified dates; notes | Four shared directories; `RequirementGroups`, `CandidateDirectoryRows`, Recruitment and Applications tables; directory smoke and isolated migration check | **Live partial** — existing staging records show `REQ-`, `CAN-`, `REC-`, and `APP-` IDs with headers/dates; new-record ID assignment and other roles remain unchecked |
| Notes append to history and respect permissions | Four directories; note save/reopen and Coordinator read-only browser checks | **Live partial** — a Recruiter saved a requirement note on another owner's synthetic row and a note on an unlinked historical application; both read back. Coordinator live denial remains unchecked |
| Show Company and Ship names in group rows without redundant prefixes | Four shared directories; grouped-row browser checks | **Local pass** |
| Candidate actions grouped under More; application link issue stays on its outlined row with hover/focus reason | Candidates and Applications; directory browser checks | **Local pass** |
| Requirement ID in selection/matching; reviewed résumé creates or links a candidate with a Candidate ID | Candidate attachment and requirement match; fleet and candidate browser checks | **Live pending** — local flow passes, server-assigned IDs need a live readback |
| Coordinator can read shared work but cannot manage companies/ships, add notes, or take over | Sidebar/routes, directory and Recruitment browser checks | **Live pending** — UI/fixture passes; live role and RLS check remains |
| AI Search keeps each permitted user's own search context and a stable Holmes rail; Operator identity is clear | AI sidebar smoke; existing role rules | **Local pass** for navigation and role UI; per-login search context was not revalidated by this smoke |
| Search long Rank and Vessel type lists | Requirement, candidate, ship editor, candidate filter, Applications filter, applicant Section 1; browser checks | **Local pass** for these entry points |
| Search Company, Ship, Requirement, and recruiter selectors when the lists grow | Candidate attachment searches requirement ID; Applications, Recruitment, candidate/requirement filters, fleet forms, Home/KPI recruiter filters and assignment controls have search before selection | **Local pass** — the selected value remains available while the options are narrowed |
| Consistent tabs, Refresh controls, light column dividers, usable wide/mobile tables, useful empty states | Shared directories, Calendar, Expiry, Operator; browser checks and earlier screenshot review | **Partial** — reviewed screens pass; no all-route visual audit or open-tab live refresh |
| Home actionable rows, KPI attribution, Calendar navigation, Expiry windows | Home/Expiry, KPI, Calendar browser checks | **Local pass** for these flows; visual detail outside the checked states remains unaudited |
| Operator evidence table; Settings team More menu; Login error beside password | Operator, Settings, and failed-login browser checks | **Local pass** |
| Remove redundant system explanations and make dates consistent | Removed duplicate instructions in requirement/fleet forms; shared date formatter now covers directories, applicant dashboard/Section 16/application view, report history, rejection history, compliance, and test mail dates | **Partial** — essential form, safety and recovery instructions remain; every applicant form section still needs visual copy review |
| Presentation's five-size type scale and semantic color rules throughout the app | One-off 11/13/15px classes now use theme sizes; report controls use semantic theme tokens | **Decision retained / partial** — the existing accessibility-reviewed theme has seven sizes and uses red for failure/destructive states. A forced global five-size remap was not adopted without screen-by-screen layout evidence |
| Keep Company → Ship grouping and manual Refresh as an explicit retry | Shared lists and release decision | **Decision retained** — returning to a shared tab revalidates, but a continuously open tab does not update in real time |
| Do not invent sea-service or last-active data | Candidate/Settings review | **Decision retained** — authoritative data is needed before adding these fields |

## Screen coverage

- **Synthetic browser exercised:** Home, KPI, Calendar, Expiry, Companies &
  ships, Requirements and requirement detail, Candidates and candidate detail,
  Recruitment, Applications and submitted application review, AI Search rail,
  Operator, Settings, Login error, and applicant form sections 1–19.
- **Still requiring signed-in visual/copy review:** applicant sections 2–19 and
  detail states beyond the synthetic fixture. The route checks prove rendering,
  not that every field and message is ideal with realistic data.
- **Live staging partial:** the current branch ran locally against Holmes staging
  at `http://127.0.0.1:3000` with a normal Recruiter session. Master Recruiter
  and Coordinator sessions, two-user readback, Coordinator note/takeover denial,
  new-record ID assignment, and a deployed staging frontend remain pending.

## Smoke result

Using a local Vite server with fake Supabase, `VITE_FEATURE_AI_SEARCH=on`,
`VITE_APP_VERSION=defect-report-test`, and both synthetic smoke flags: **96/96
agreed-change browser cases pass**. A further **18/18 applicant section 2–19
route checks** and **1/1 requirement-detail check** pass, for **115 distinct
browser cases**. The three adjacent Node suites pass **38/38**. Lint, production
build, and `git diff --check` pass. Initial test assertions about retaining a
selected filter and a transient duplicate row were corrected; a detail fixture
was adjusted to return a single record for its `.maybeSingle()` query.

This smoke uses intercepted external requests. It proves the local UI behavior
under fixtures, not live shared-data visibility, RLS, migration backfill, email,
or a production release. The two directory migrations are applied on Holmes
staging only. A subsequent normal Recruiter session exercised the matching
frontend locally against staging; it does not prove cross-role permissions or a
deployed staging origin. Do not promote the frontend ahead of the two production
migrations.

## Live staging check — 2026-11-15

- A normal Recruiter login loaded the four shared lists. Requirements showed
  three open rows including rows owned by another recruiter, with stable IDs,
  serials, headers, created/modified dates, and a note cell. Candidates,
  Recruitment, and Applications showed the corresponding `CAN-`, `REC-`, and
  `APP-` IDs. The Recruitment requirement selector included `REQ-` IDs.
- The Recruiter saved a synthetic note on another recruiter's `REQ-000003` and
  saw it in the row after save. A note on historical submitted application
  `APP-000003`, whose recruitment link is missing, saved and reopened in note
  history. The link problem remained an outlined row with a short reason.
- The Recruiter took over synthetic unassigned case `REC-000005`; the row then
  showed that Recruiter as assigned. This is one-account takeover, not a
  two-account handoff check. Anonymous requests returned zero Requirements rows
  and permission denial for `directory_notes`.
- The attempted alternate login returned `User is banned`. The successful
  account menu showed `Recruiter`; the owner reported no working second staging
  login. Historical notes identify a separate synthetic staging Coordinator
  account using `kartik.neuralnet@gmail.com` and say its password setup was
  unfinished. The same email belongs to the production Holmes Operator account;
  these are distinct identities in different Supabase projects.
  Cross-user visibility, Master controls, Coordinator read-only/RLS, and
  new-record ID readback therefore remain open.
- The live dashboard exposed a missed ID inconsistency: its “Req ID” link still
  showed the legacy reference. Home, KPI report rows, and Requirements CSV now
  prefer `display_id`, with legacy fallback for older fixtures. Focused synthetic
  KPI/Home browser checks pass **9/9**, KPI Node checks **27/27**, lint and build
  pass. This follow-up change has not had a second signed-in staging readback.

## Release gate

1. Put this branch's matching frontend on a staging-targeted origin and run
   the live role/data checks above. Keep unrelated pending migrations deferred.
2. Complete the remaining signed-in applicant/detail visual and copy review.
   Keep the existing semantic colors and seven-size theme unless specific
   screenshots show a better, accessible mapping.
3. Before production schema changes, follow the Holmes release gate: exact
   approval, fresh production backup, and isolated restore/count verification.
   Apply only `2026111401` and `2026111402`, then promote the matching frontend
   and perform production smoke.
