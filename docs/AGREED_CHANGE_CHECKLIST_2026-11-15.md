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
| Requirement ID in selection/matching; reviewed résumé creates or links a candidate with a Candidate ID | Candidate attachment and requirement match; fleet and candidate browser checks | **Live partial** — local flow and staging ID allocator pass; the complete match/case/application path passed in a rolled-back staging transaction with synthetic source evidence. Persistent applicant claim, draft, autosave, and submission now pass; an ordinary browser résumé match remains unchecked because staging has no suitable unattached original |
| Coordinator can read shared work but cannot manage companies/ships, add notes, or take over | Sidebar/routes, directory and Recruitment browser checks | **Live pass for checked paths** — all four shared lists loaded; Companies & ships was absent from the sidebar, Take over was absent from Recruitment, the notes dialog was read-only, and staging rejected a note insert |
| AI Search keeps each permitted user's own search context and a stable Holmes rail; Operator identity is clear | AI sidebar smoke; existing role rules | **Local pass** for navigation and role UI; per-login search context was not revalidated by this smoke |
| Search long Rank and Vessel type lists | Requirement, candidate, ship editor, candidate filter, Applications filter, applicant Section 1; browser checks | **Local pass** for these entry points |
| Search Company, Ship, Requirement, and recruiter selectors when the lists grow | Candidate attachment searches requirement ID; Applications, Recruitment, candidate/requirement filters, fleet forms, Home/KPI recruiter filters and assignment controls have search before selection | **Local pass** — the selected value remains available while the options are narrowed |
| Consistent tabs, Refresh controls, light column dividers, usable wide/mobile tables, useful empty states | Shared directories, Calendar, Expiry, Operator; browser checks and earlier screenshot review | **Partial** — reviewed screens pass; no all-route visual audit or open-tab live refresh |
| Home actionable rows, KPI attribution, Calendar navigation, Expiry windows | Home/Expiry, KPI, Calendar browser checks | **Local pass** for these flows; visual detail outside the checked states remains unaudited |
| Operator evidence table; Settings team More menu; Login error beside password | Operator, Settings, and failed-login browser checks | **Local pass** |
| Remove redundant system explanations and make dates consistent | Removed duplicate instructions in requirement/fleet forms; shared date formatter covers directories, applicant dashboard, submitted application view, report history, rejection history, compliance, and test mail dates | **Partial** — essential form, safety and recovery instructions remain. A synthetic staging draft populated the mandatory sections while all 19 routes rendered; spot screenshots were reviewed for sections 5, 16, and 19. A complete app-wide copy audit remains open |
| Presentation's five-size type scale and semantic color rules throughout the app | One-off 11/13/15px classes now use theme sizes; report controls use semantic theme tokens | **Decision retained / partial** — the existing accessibility-reviewed theme has seven sizes and uses red for failure/destructive states. A forced global five-size remap was not adopted without screen-by-screen layout evidence |
| Keep Company → Ship grouping and manual Refresh as an explicit retry | Shared lists and release decision | **Decision retained** — returning to a shared tab revalidates, but a continuously open tab does not update in real time |
| Do not invent sea-service or last-active data | Candidate/Settings review | **Decision retained** — authoritative data is needed before adding these fields |

## Screen coverage

- **Synthetic browser exercised:** Home, KPI, Calendar, Expiry, Companies &
  ships, Requirements and requirement detail, Candidates and candidate detail,
  Recruitment, Applications and submitted application review, AI Search rail,
  Operator, Settings, Login error, and applicant form sections 1–19.
- **Still requiring realistic-data visual/copy review:** uncommon applicant and
  detail states beyond the synthetic fixture. A signed-in draft with populated
  mandatory sections rendered all 19 routes, with additional screenshots
  reviewed for sections 5, 16, and 19. Route rendering does not prove that every
  field and message is ideal with production data. A source review
  caught Section 2's duplicate section number, and synthetic detail checks found legacy
  ID readouts in candidate/application details; those are corrected locally.
- **Live staging partial:** later sections below record three-role shared-list
  readback, two-user takeover, Coordinator write denial, rolled-back new-record
  IDs, the signed-in branch Preview, and a persistent applicant claim/draft/
  submission. Ordinary browser résumé match, external invitation/email delivery,
  and uncommon populated detail states remain open.

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
  The fix was pushed as `61f04a4`; both Vercel deployment checks completed
  successfully. The new build has synthetic browser coverage but has not had a
  second signed-in Preview date readback.

## Rolled-back end-to-end and populated-form follow-up — 2026-11-15

- Before the follow-up below, staging had seven résumé registry rows: three ready sources with
  originals, all already attached. The available open requirement with a
  reviewed location therefore cannot supply a new unattached original for an
  ordinary browser match. Migration history has `2026111401` and `2026111402`
  but lacks `2026111202` and `2026111203`; the exact-case application-start
  function from `1202` is absent. These older migrations were deliberately
  deferred during the isolated directory rollout.
- A transaction loaded `1202` and `1203` temporarily, created synthetic
  résumé evidence and an invitation, called the reviewed-résumé match, created
  a recruitment case, started the exact-case application, and submitted it.
  The returned IDs were `CAN-000017`, `REC-000015`, and `APP-000010`, with the
  application linked to its case. The transaction rolled back. A read-only
  check confirmed zero temporary candidate, profile, and source rows and that
  the exact-case function remains absent. Sequence numbers can advance after
  rollback. This does not verify external original-PDF bytes or mail delivery.
- Existing synthetic draft `APP-000004` was temporarily filled and its original
  data restored after review. The applicant form rendered all 19 routes with
  the mandatory sections populated. Screenshots of sections 5, 16, and 19
  showed intact layout.
  The fixture initially left Section 13 incomplete and used four Section 16
  values absent from the current option lists, causing the editor to show a
  placeholder. The fixture now supplies uniform sizes and current options;
  validation passes all 13 mandatory sections. Two of three saved sea-service
  rows on staging also contain unsupported option values, so the shared form
  select now displays an explicit saved-value option until the user chooses a
  current value. Six focused applicant browser checks, 19 adjacent validation
  checks, lint, and build pass.
- At that point, persistent browser match, invitation, draft creation, and
  submission remained unchecked. The isolated directory release did not
  silently apply the deferred `1202` and `1203` migrations.

## Persistent staging applicant smoke — 2026-11-15

- With the owner's approval, applied exactly `2026111202` and `2026111203` to
  Holmes staging in one transaction. A prior transaction dry run rolled back;
  the committed readback confirmed both migration versions, the exact-case
  application-start function, grants and triggers. The unrelated pending
  migrations and production were untouched.
- Used an existing synthetic candidate and case, one temporary applicant Auth
  account, and a non-emailed invitation token. The browser redeemed the claim,
  started a draft for that exact case, saved an edited field across reload, and
  submitted `APP-000011` linked to `REC-000006`. The completed synthetic draft
  satisfied the mandatory-section checks. The browser intercepted the
  application email request, so no external message was sent.
- At that point, the applicant dashboard displayed the legacy requirement reference
  `2026-Nov-005` where the shared lists display `REQ-000003`. The
  `get_applicant_claims()` function added by `1203` returned `req_id_display`;
  the subsequent migration below corrects this while retaining the legacy
  reference where useful.
- Deleted only the temporary application, claim, profile, Auth account, and
  case event; restored the synthetic case and candidate fields. Final staging
  readback found zero smoke application/claims/Auth users, the original case
  status/version/event count, all three guards enabled, and unchanged totals
  of 11 candidates, 10 cases, and 7 applications. The migration functions and
  registry rows remain applied. This smoke does not prove original-PDF bytes,
  ordinary browser résumé matching, or external email delivery.

## Applicant requirement ID follow-up — 2026-11-15

- New migration `2026111501` changes `get_applicant_claims()` to put the stable
  `REQ-` ID in `requirement_reference` and retain the older value in
  `requirement_legacy_reference`. Its applicant identity, invitation eligibility,
  open-requirement filters, and function grants remain in place. Focused PGlite
  coverage checks both IDs, caller isolation, eligibility, and replay; the two
  adjacent invitation SQL suites still pass. The focused synthetic applicant
  invitation browser suite passes 25/25; lint and build pass.
- The migration passed a rolled-back staging dry run and was then applied only
  to Holmes staging. A temporary synthetic applicant redeemed a non-emailed
  claim in the current branch frontend; the dashboard displayed `REQ-000003`
  after login and reload, with Start application enabled. The claim, temporary
  profile and Auth account were deleted, and the case/candidate restored. Final
  staging readback found the migration present, zero temporary records, the
  original case status/version/event count, and unchanged totals of 11
  candidates, 10 cases, and 7 applications. Production was untouched.
- All three ready staging résumé sources with originals are already linked to
  candidates. The ordinary browser new-résumé match needs a fresh synthetic
  source with a real original-byte verification path. External invitation and
  application-email delivery were not exercised by these non-emailed smokes.
- The match dialog's existing-case warning also used the older requirement
  reference. The local Edge response now includes each case requirement's
  `display_id`, and the dialog prefers it. The focused bridge check and
  synthetic browser regression pass. A read-only staging inventory found no
  `needle-integration` or `resume-intake` Function and no `NEEDLE_` secret names.
  Live matching therefore needs a configured staging Needle service, the
  paired Function deployment, and a fresh verified synthetic original. The
  local Edge change has not been deployed to staging.

## Release gate

1. Configure the paired Needle staging service and Holmes integration Function,
   then complete an ordinary browser résumé match with a fresh synthetic source
   that passes original-byte verification. Check external invitation/email
   delivery separately if that is in release scope; the current staging smoke
   deliberately generated no message.
2. Review uncommon detail states with realistic synthetic data. Keep the
   existing semantic colors and seven-size theme unless specific screenshots
   show a better, accessible mapping.
3. Before production schema changes, follow the Holmes release gate: exact
   approval, fresh production backup, and isolated restore/count verification.
   Recheck production migration history and prepare an explicit ordered plan
   that includes any required `1202`/`1203` dependencies, the two directory
   migrations, and the applicant ID correction. Promote the matching frontend
   only after its database dependencies, then perform production smoke.

## Integration retest — 2026-11-15

- The current branch head `1a8637d` has successful checks for both Vercel
  deployments. This confirms deployment completion, not a live match. No
  production release or database write was made in this retest.
- A fresh Holmes staging inventory still found no `needle-integration`,
  `resume-intake`, or `resume-index-dispatch` Function and no `NEEDLE_` or
  `RESUME_INTAKE_` secret names. The paired Needle records also state that
  there is no separate managed Needle staging service or database. The live
  browser match and original-byte verification remain open until that isolated
  service is provisioned and connected; pointing staging at production Needle
  would not provide a valid staging test.
- The local synthetic browser suite passed **101/101** across the shared
  directories, matching modal, recruitment, applications, applicant invitation
  and sections, AI rail, Operator, KPI, and presentation-led UI. Seven adjacent
  Node suites passed **52/52**; lint and production build passed. One Node test
  initially failed because it asserted the older held-upload copy. Its assertion
  now checks the current exported hold message and the suite passes.

## Isolated Needle staging setup — 2026-11-15

- With KT's approval, created a private Railway project `needle-holmes-staging`
  (`79665bff-eadb-4ebd-b469-994260d0c8e2`) with an `engine` service
  (`d45cc0b2-d4d5-442a-8e9b-f1cccf7e1cb2`), `staging` environment, and
  persistent `/data` volume (`825f56cc-cf53-4d3a-823e-e9bea2071bfc`). This
  is separate from the protected production Railway project. A temporary token
  scoped to this project/environment was used for deployment and must be
  revoked after the staging work.
- Created a separate Supabase project `needle-holmes-staging`
  (`gildwotwdrorxwbvdkow`) and applied all 29 migrations from the current
  Needle branch. Readback found 34 public tables and 16 RLS policies. The
  Railway service uses only this new project and a fresh Holmes signing pair.
- Deployed the current Needle branch `codex/resume-review-workspace` at
  `8b9152cf` via Railway CLI. The volume-backed deployment
  `dc85cf3d-0b7e-4ea6-b7fd-d2ddee398d4f` built successfully and booted with
  cloud Supabase auth and workspace APIs registered. Needle's focused Holmes
  integration/source-verification tests passed 28/28.
- Set the paired signing private key and organization ID in **Holmes staging**,
  then deployed only its `needle-integration` Function. No production service,
  database, Function, or Drive data was changed.
- Railway's automatic approval review rejected generating a public domain for
  this staging service because it would expand network exposure. Specific
  approval has been requested. Until then, Holmes cannot call the private
  Railway service, so the live browser match remains unverified. The staging
  service also has no dedicated synthetic Google Drive original/credential or
  platform Resume Intake path; the real original-byte gate requires those to
  be provisioned separately before it can be claimed as passed.
