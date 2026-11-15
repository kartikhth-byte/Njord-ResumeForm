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
| Shared organization lists visible independent of assignment; another recruiter can take over a case or task | Requirements, Candidates, Recruitment, Applications; directory and takeover browser checks | **Live pending** — synthetic takeover passes, but two real users sharing staging data have not been checked |
| Stable, type-specific IDs; row serials; one header per list; created/modified dates; notes | Four shared directories; `RequirementGroups`, `CandidateDirectoryRows`, Recruitment and Applications tables; directory smoke and isolated migration check | **Live pending** — frontend passes, directory migrations are on staging, production unchanged |
| Notes append to history and respect permissions | Four directories; note save/reopen and Coordinator read-only browser checks | **Live pending** — real RLS and old-record behavior require signed-in staging checks |
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
- **Live staging pending:** matched frontend deployment, signed-in Master
  Recruiter/Recruiter/Coordinator sessions, two-user shared visibility and
  takeover, old/new ID readback, note RLS, and application-link exception.

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
staging only; the matching frontend has not had a signed-in staging smoke. Do
not promote the frontend ahead of the two production migrations.

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
