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
| Shared organization lists visible independent of assignment; another recruiter can take over a case or task | Requirements, Candidates, Recruitment, Applications; directory and takeover browser checks | **Live pass for checked paths** — three roles read identical staging row IDs; temporary Recruiter A took over `REC-000007`, Recruiter B saw A's assignment and took over, and A saw B's assignment. The signed-in Preview showed B as owner and both handover events |
| Stable, type-specific IDs; row serials; one header per list; created/modified dates; notes | Four shared directories; `RequirementGroups`, `CandidateDirectoryRows`, Recruitment and Applications tables; directory smoke and staging allocator check | **Live partial** — all three roles read the same records and ID columns. Rolled-back staging inserts received `REQ-000012`, `CAN-000014`, `REC-000012`, and `APP-000009`; full new-record user flows remain unchecked |
| Notes append to history and respect permissions | Four directories; note save/reopen and Coordinator read-only browser checks | **Live partial** — a temporary Master Recruiter note was visible to all three roles; a Coordinator note write was rejected by staging and its notes dialog was read-only. Requirement and application note save/reopen was checked earlier with a Recruiter |
| Show Company and Ship names in group rows without redundant prefixes | Four shared directories; grouped-row browser checks | **Local pass** |
| Candidate actions grouped under More; application link issue stays on its outlined row with hover/focus reason | Candidates and Applications; directory browser checks | **Local pass** |
| Requirement ID in selection/matching; reviewed résumé creates or links a candidate with a Candidate ID | Candidate attachment and requirement match; fleet and candidate browser checks | **Live partial** — local flow and staging ID allocator pass; a complete reviewed-résumé match with candidate creation has not been exercised against staging |
| Coordinator can read shared work but cannot manage companies/ships, add notes, or take over | Sidebar/routes, directory and Recruitment browser checks | **Live pass for checked paths** — all four shared lists loaded; Companies & ships was absent from the sidebar, Take over was absent from Recruitment, the notes dialog was read-only, and staging rejected a note insert |
| AI Search keeps each permitted user's own search context and a stable Holmes rail; Operator identity is clear | AI sidebar smoke; existing role rules | **Local pass** for navigation and role UI; per-login search context was not revalidated by this smoke |
| Search long Rank and Vessel type lists | Requirement, candidate, ship editor, candidate filter, Applications filter, applicant Section 1; browser checks | **Local pass** for these entry points |
| Search Company, Ship, Requirement, and recruiter selectors when the lists grow | Candidate attachment searches requirement ID; Applications, Recruitment, candidate/requirement filters, fleet forms, Home/KPI recruiter filters and assignment controls have search before selection | **Local pass** — the selected value remains available while the options are narrowed |
| Consistent tabs, Refresh controls, light column dividers, usable wide/mobile tables, useful empty states | Shared directories, Calendar, Expiry, Operator; browser checks and earlier screenshot review | **Partial** — reviewed screens pass; no all-route visual audit or open-tab live refresh |
| Home actionable rows, KPI attribution, Calendar navigation, Expiry windows | Home/Expiry, KPI, Calendar browser checks | **Local pass** for these flows; visual detail outside the checked states remains unaudited |
| Operator evidence table; Settings team More menu; Login error beside password | Operator, Settings, and failed-login browser checks | **Local pass** |
| Remove redundant system explanations and make dates consistent | Removed duplicate instructions in requirement/fleet forms; shared date formatter covers directories, applicant dashboard, submitted application view, report history, rejection history, compliance, and test mail dates | **Partial** — essential form, safety and recovery instructions remain. Applicant sections 2–19 rendered in staging, with spot visual checks of sections 2, 10, 16, and 19; sparse draft data limits content/copy conclusions |
| Presentation's five-size type scale and semantic color rules throughout the app | One-off 11/13/15px classes now use theme sizes; report controls use semantic theme tokens | **Decision retained / partial** — the existing accessibility-reviewed theme has seven sizes and uses red for failure/destructive states. A forced global five-size remap was not adopted without screen-by-screen layout evidence |
| Keep Company → Ship grouping and manual Refresh as an explicit retry | Shared lists and release decision | **Decision retained** — returning to a shared tab revalidates, but a continuously open tab does not update in real time |
| Do not invent sea-service or last-active data | Candidate/Settings review | **Decision retained** — authoritative data is needed before adding these fields |

## Screen coverage

- **Synthetic browser exercised:** Home, KPI, Calendar, Expiry, Companies &
  ships, Requirements and requirement detail, Candidates and candidate detail,
  Recruitment, Applications and submitted application review, AI Search rail,
  Operator, Settings, Login error, and applicant form sections 1–19.
- **Still requiring realistic-data visual/copy review:** applicant sections 2–19 and
  detail states beyond the synthetic fixture. A signed-in draft rendered all 18
  remaining sections, and sections 2, 10, 16, and 19 were visually inspected.
  Many saved draft sections are empty; route rendering does not prove that every
  field and message is ideal with realistic data. A source review
  caught Section 2's duplicate section number, and synthetic detail checks found legacy
  ID readouts in candidate/application details; those are corrected locally.
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

## Staging readiness and detail follow-up — 2026-11-15

- The Vercel branch preview for `b02a581` is Ready. Its preexisting
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variables are scoped to
  **All Environments**. Branch-only overrides for `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` were added for
  `codex/holmes-shared-lists-20261114`. After owner authenticator verification,
  redeployment `ExEptuW8Nkmv9y6pa46goqDjPJYH` became Ready. Its built bundle
  initializes Supabase with the staging project URL. Production settings were
  not changed.
- The staging Auth project has separate, confirmed, unbanned accounts for
  `kartikathome+holmes-master@gmail.com` (Master Recruiter) and
  `kartikathome+holmes-coordinator@gmail.com` (Coordinator). A read-only join of
  `auth.users`, `profiles`, `user_roles`, and `roles` confirmed the roles. The
  owner would need to set working passwords to use those particular accounts;
  no credential was changed here. The later temporary-account smoke used new
  accounts instead. Staging auth allows `http://localhost:3001/**`, and the
  matching local Vite frontend is available there for sign-in.
- The detail audit aligned the candidate detail's requirement links, attachment
  selector, linked applications, and export with stable IDs. The application
  review's case selector and compliance heading, matching selector, candidate
  export, KPI tracker, and requirement snapshot now prefer `display_id` with
  legacy fallback. Applicant Section 2 now uses the same title style as the
  other sections without repeating its section number. Focused synthetic
  candidate/application browser checks pass **5/5** after correcting a test
  assertion about native `<option>` visibility; KPI Node checks pass **28/28**,
  lint and build pass. Live role/data checks remain open.

## Temporary-account cross-role smoke — 2026-11-15

- With the owner's authorization, three temporary accounts were created in
  Holmes staging for Master Recruiter, Recruiter, and Coordinator. Each signed
  in through the current branch's local frontend against staging. All four
  shared pages rendered ID column headers without access errors for each role.
- API readback returned identical IDs across the three roles: 8 requirements,
  11 candidates, 10 recruitment cases, and 7 applications. Every returned row
  had a display ID. A Master Recruiter note on a recruitment case was visible
  to all three roles. The test note was deleted after verification.
- A separate temporary Coordinator session had no Companies & ships sidebar
  entry or Recruitment Take over control; its notes dialog had no add form, and
  staging rejected a direct note insert. All temporary Auth accounts were
  verified deleted. No existing staging account was changed.
- The browser check uses `http://127.0.0.1:3001` with staging credentials.
  It does not yet verify a two-account takeover, server assignment of IDs to
  newly created records, or the protected Vercel Preview in a signed-in
  browser session.

## Two-account, ID, Preview, and applicant follow-up — 2026-11-15

- Two new temporary staging Recruiter accounts performed a real A-to-B takeover
  of synthetic case `REC-000007`. A claimed version 1; B read A's assignment,
  claimed version 2, and A read B's assignment. The signed-in branch Vercel
  Preview showed B as owner, both history entries, and matching `REC-`, `REQ-`,
  and `CAN-` links in case and candidate detail. The submitted application
  review showed its `APP-` ID, requirement link, findings, and form sections.
- Temporary accounts and their two history rows were deleted; the case was
  restored to unassigned. A final staging query confirmed zero temporary
  assignment/history rows and all four affected triggers enabled. The Preview
  browser session was signed out. No existing staging account was changed.
- Staging ID allocation was checked with transaction-scoped inserts followed by
  rollback: `REQ-000012`, `CAN-000014`, `REC-000012`, and `APP-000009` were
  assigned. The candidate and case fixtures lacked a reviewed CV, so only their
  résumé-entry guards were disabled inside the rolled-back transaction. The
  application fixture reused an existing synthetic user, so its duplicate-active
  application guard was likewise disabled inside rollback. This proves allocator
  behavior, not the complete reviewed-résumé or invitation/submission flows.
- A signed-in synthetic applicant draft opened sections 2–19 on the matching
  local branch frontend against staging without route or access errors (18/18).
  Spot screenshots of sections 2, 10, 16, and 19 showed intact form layout.
  The draft contains mostly blank fields, so populated content/copy review is
  still limited. No application was submitted or saved during this pass.
- The signed-in Preview exposed raw ISO dates in recruiter application detail
  while list dates were formatted. The detail now formats date-only strings in
  its header and field rows with the shared directory formatter, including the
  Yellow Fever dates. Focused submitted-review browser smoke passes **10/10**.
  The fix is on this branch and needs a fresh Preview deployment to appear there.

## Release gate

1. Run a complete reviewed-résumé match and application submission with new
   records on staging, if the release requires end-to-end proof beyond the ID
   allocator checks. The signed-in branch Preview and two-account takeover now
   pass. Keep unrelated pending migrations deferred.
2. Review populated applicant sections and uncommon detail states with realistic
   synthetic data. Keep the existing semantic colors and seven-size theme
   unless specific screenshots show a better, accessible mapping.
3. Before production schema changes, follow the Holmes release gate: exact
   approval, fresh production backup, and isolated restore/count verification.
   Apply only `2026111401` and `2026111402`, then promote the matching frontend
   and perform production smoke.
