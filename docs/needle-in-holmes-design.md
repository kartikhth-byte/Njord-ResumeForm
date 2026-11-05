# Needle inside Holmes: integration and operator design

Date: 2026-11-05 · Status: design; owner decisions recorded in §8, none open; independent review of 2026-11-05 folded in (§10). Initial embed slice and a reconciled operator-pilot candidate are prepared locally; no deployment acceptance yet.
Builds on `docs/needle-integration.md` (product boundary, data rules, upgrade policy) and `docs/platform-review-findings.md` (decisions 1, 2, 7). This note adds the screen-level design, the sign-in bridge and the operator console.

Sources:
- **Needle (deployed).** Branch `railway-m1` at `6a483c2` (2026-11-04, the hosted beta snapshot).
- **Needle (cross-checked).** The pushed `codex/production-integration` (`68bf116`, 2026-11-01): login, roles, hosted allowlist, routes, sidebar and workspace guard are identical to `railway-m1`.
- **Not reviewed.** The owner's local working line `codex/production-integration` at `b4a43188` with uncommitted changes. Recheck this note if that work changes sign-in, roles, tenancy, intake or the hosted screens.
- **Holmes.** `ui/warm-theme` at `9841320`.

## 1. Summary

- **Needle is an internal engine, never customer-facing** (owner decision). Customers only ever see Holmes: no Needle login, name or address.
- **All hosted Needle features in Holmes, by showing Needle's own UI inside the Holmes shell**, in an embedded mode with no Needle sidebar, login or branding. Embedding keeps every feature, current and future; a rebuild would drop some and double every future feature. The two apps share the same dark theme tokens (`#171614` background, `#d97757` accent).
- **Needle is served under Holmes's own address.** Holmes's host (Vercel) forwards `/ai/*` to Needle, so the browser only talks to Holmes's address and Needle's cookie works inside the frame. Holmes stays on Vercel (§4.1).
- **One login.** Holmes exchanges a short-lived token, minted by a Holmes edge function, for a Needle session. Needle's own login is for the operator only.
- **Two places for AI in Holmes:**
  - an **AI search** page in the sidebar (the full Needle workspace);
  - **Match resumes** on a requirement: opens AI search on a search already set to the requirement's filters; the recruiter adds several and the recruitment flow starts for each.
- **Results flow into Holmes through one action, "Add to Holmes".** It adds the person to the Holmes candidate pool, optionally attached to a requirement. Holmes, not Needle, creates or links the candidate.
- **Every Holmes candidate has a resume in the resume database** (owner decision). Candidates enter with name, a phone or an email, and the resume; the recruiter completes the rest at first contact.
- **Each customer searches only its own resume pool** (owner decision). With one customer this needs only an organization tag on Needle's data now; per-customer folders and mailboxes come when a second customer signs (§4.5).
- **Operator becomes a Holmes platform flag with its own console**: Holmes's platform settings and Needle's admin pages. Organizations keep Team and Worksheet templates.
- **Leave out:** Needle's Downloads (Seajobs), the Verified dashboard (Add to Holmes replaces it) and Needle's desktop pieces. User Settings stay in Needle for the operator.
- **Retire Holmes's own AI search** (the `applications`-table search, its embeddings and the two Gemini proxy functions) once Needle is embedded.

## 2. What Needle has today (hosted build)

Needle's hosted build (`VITE_HOSTED=1`, `frontend/src/App.tsx`) already removes the desktop pages. On the server, `hosted_allowlist.py` returns 404 for everything else.

| Needle screen | What it does | Who sees it |
|---|---|---|
| Search: projects home and project tree | Projects, each holding chats (rename, pin, archive, move, undo delete) | everyone |
| Search workspace | Chat → run → refinement stages; filter chips (rank, ship type, engine, age, CoC, availability, tonnage); live progress; ranked cards with ✓/✗/? per filter and AI-fit badge; table view; candidate detail (resume, evidence, PDF); "Assess fit"; Verify | everyone |
| Repository | The whole resume pool: filters, search, CSV, resume viewer | everyone |
| Verified dashboard | Shortlist built from Verify actions, with CSV | everyone |
| Downloads | Seajobs download jobs with OTP relay, run by the Railway worker | everyone |
| User Settings | Seajobs, Google Drive and Microsoft credentials | admin or integration manager |
| Admin → Facts review | Approve, reject or promote extracted resume facts | admin |
| Admin → Settings | Four runtime controls (reasoning model, minimum similarity, career-gap default, LLM promotion stage); audited | admin |
| Admin → Evals, Evals registry | Model evaluation evidence | admin |
| Admin → Users | User directory; browse any user's projects; create users, rotate passwords | admin |
| Corpus status badge | Searchable count, stale or failed warning | everyone |
| Login | Username and password; Flask cookie session | everyone |

The server side relevant to Holmes:

- **Roles.** Only `user` and `admin` ("the admin is the operator", `workspace_authz.py:46`).
- **Login.** Cookie session only, checked by `/auth/me`. `CORS(app)` allows any origin, no credentials.
- **No tenant.** No table has an organization key. A user sees only their own projects; the admin sees all. A run owned by another user returns 404 (`search_session_api.py:539`).
- **Resume ids are content hashes.** A resume's id is the SHA-256 of the file, and intake skips any file whose hash already exists (`worker_continuous_intake.py:381-386`). Intake reads PDFs only (`:366-371`).
- **Intake timing.** The worker runs a cycle every 60 seconds by default (`NJORDHR_WORKER_POLL_SECONDS`, minimum 10) and processes one batch per cycle, default size 1 (`NJORDHR_NUEXTRACT_BATCH_SIZE`). So a single upload is picked up within about a minute plus extraction time, and a bulk load runs at about one resume a minute unless the batch size is raised.
- **Intake sources.** Email intake and Drive intake both run in the hosted build and feed one Drive folder (`NJORDHR_RESUME_FOLDER_ID`).
- **Where the workspace lives.** Projects, chats, runs and stages are in SQLite on the Railway volume (`workspace.db`).
- **Separate database.** Needle's tables are not in the Holmes production database.
- **Users.** There are no real Needle users yet; existing projects and chats are test data (owner, 2026-11-05).

## 3. Decision per Needle screen

| Needle screen | In Holmes | How |
|---|---|---|
| Search workspace with project tree | **Bring in.** Sidebar item **AI search** (Recruit group); also opened by **Match resumes** on a requirement | Embedded (§4) |
| Repository | **Bring in** as a second tab on AI search: "Searches \| Resume pool" | Embedded |
| Candidate detail (resume, evidence, PDF) | **Bring in**, from search, pool, or a Holmes candidate's **View resume** | Embedded |
| Verify and Verified dashboard | **Replace** with **Add to Holmes** | §4.3 |
| Corpus status badge | **Bring in** in the AI search header and Operator → Health | Embedded |
| Admin → Settings, Facts review, Evals, Pipeline Inspector (when routed) | **Operator console** → AI | Embedded |
| Admin → Users | **Replace.** Holmes is the source of accounts; Needle accounts are created on first sign-in | Operator → Organizations & users |
| Downloads (Seajobs) | **Leave out** | — |
| User Settings (Seajobs, Drive, Microsoft for intake) | **Leave out.** Operator uses Needle directly | Link from Operator → AI |
| Login | **Replace** with Holmes sign-in (§4.2) | — |

## 4. Architecture

### 4.1 UI: Needle's own screens, embedded under Holmes's address

| Option | Seamless | Effort | Keeps Needle independent | Verdict |
|---|---|---|---|---|
| **A. Embed Needle's UI in a frame** filling the Holmes content area, in an embed mode | High | Small on both sides | Yes; Holmes pins a Needle release | **Chosen** |
| B. Publish Needle's `src/search/*` (about 5,900 lines) as a package Holmes imports | Highest | High: React 18/TS/Tailwind 4 vs React 19/JS/Tailwind 3 | Partly | Later, only if the frame shows real limits |
| C. Rebuild Needle's screens in Holmes, Holmes calling Needle server to server | High; Needle fully hidden | Highest; every Needle feature built twice; live progress must stream through Holmes functions | No | No |

**Served under Holmes's address (decided 2026-11-05).**
- Holmes's routing middleware (`middleware.js`) forwards `/ai/*` to the Needle named by the environment's `NEEDLE_ORIGIN` (unset in previews: 404). Needle's frontend is built with base path `/ai/` and calls its API under `/ai`; Flask routes stay as they are because the prefix is stripped.
- **Why:** the browser sees only Holmes's address; Needle's session cookie is first-party inside the frame, so every Needle screen, download link and CSV export works unchanged; and Needle's direct login can be limited to the operator.
- **Streaming:** Vercel waits up to 120 seconds for the first byte from an external origin, then keeps the request open as long as data arrives at least every 120 seconds. Needle streams search progress from the start. **Test first:** one real search through the rule, and confirm Needle's `Set-Cookie` passes through it.
- **Fallback** if the test fails: a small forwarding service on Railway in front of Needle, with Holmes's address pointed at it. Moving Holmes itself to Railway is not needed (decided 2026-11-05).
- **Holmes's own domain:** if Holmes will get one, set it before launch; every redirect and email link depends on it.

**How it looks native:**
- **Shell.** Holmes owns the sidebar, page title, breadcrumbs and user menu. Needle in embed mode renders only its content at full height. Font size already matches (both 14px on the current Needle line); remove any hard-coded palette colours in Needle chips.
- **Space.** On AI search the Holmes sidebar collapses to its icon rail (`data-rail`).
- **Addresses.** `/recruiter/ai/:projectId/:chatId` ↔ Needle's `#/search/:projectId/:chatId`, kept in step with `postMessage` so Back, refresh and links work.
- **Words.** Holmes's words: "candidate", "requirement", "Add to Holmes". Any error or text Needle shows inside the frame is seen by customers and must read as Holmes.
- **Unavailable.** If Needle is down, Holmes shows "AI search is unavailable" with Retry.

### 4.2 Sign-in: token exchanged for a Needle session

Because Needle is served under Holmes's address, the frame is same-site and a cookie works.

1. Before opening AI search, Holmes calls its edge function `needle-token`, which checks the Supabase session and signs a short-lived token (about 2 minutes): `sub` (Holmes user id), `email`, `name`, `org` (Holmes organization id), `role` (Operator → `admin`; Master Recruiter or Recruiter → `user`; anyone with a Coordinator role gets no token; a read-only `viewer` comes with View resume in H5), `aud: needle`, `exp`, `jti`.
2. Holmes posts the token once to `/ai/auth/holmes`. Needle verifies it and sets its session cookie (HttpOnly, Secure, SameSite=Lax, path `/ai`) holding the Holmes user id (as `holmes:<id>`), role and organization; Needle's workspace is keyed by that id, so no Needle user record is created. Holmes then checks `/ai/auth/me` before showing the frame.
3. Every Needle screen then works as today, including `/auth/me`, the corpus badge, Evals, Facts review, PDF links and CSV export.
4. The Needle session lasts a working day at most. Holmes repeats the exchange on page load when Needle answers 401, and calls `/ai/auth/logout` when the user signs out of Holmes.
5. Needle's username and password login is limited to operator accounts.

Security:
- **Signing key.** An Ed25519 key pair: the private key in Holmes's function secrets, the public key in Needle's environment, so Needle can verify but not mint. (Supabase's managed signing keys cannot mint custom tokens.)
- **What Needle trusts.** Organization and role come only from the verified token, never from a request body.
- **`viewer`** can open resumes and candidate detail, and nothing that runs the model or exports: no search, no "Assess fit", no CSV.
- **Frame messages.** Route sync and Add to Holmes use `postMessage`. Both sides post with the exact target origin and accept a message only when `event.origin` is Holmes's own origin and `event.source` is the frame (or its parent).
- **Framing and CORS.** Needle sends `frame-ancestors` for Holmes's origin only, and narrows CORS to it.
- **Needle's own address.** Every Needle request needs a valid session, so its Railway address being reachable is not by itself a hole. Making it unreachable needs the forwarder to add a secret header Needle checks, or the Railway fallback; decide after the test.

### 4.3 From a Needle result to a Holmes candidate: Add to Holmes

- **The action.** In embed mode, cards, table rows and candidate detail show **Add to Holmes** instead of Verify; several can be selected. The frame sends only `{resume_id, stage_id}` per person. Holmes fetches the facts for prefill from Needle's API by `resume_id`; it never trusts facts sent through the frame.
- **The dialog** (Holmes):
  - **Where to.** The candidate pool only (Candidates → Unattached), or the pool and a requirement. Only open requirements can be chosen (attaching needs `status = open`).
  - **Duplicate check.** A matching email means the person is already in Holmes (one live candidate per email, `prospects_email_live_uidx`): only **Link to existing** is offered. A matching phone, or name plus date of birth, offers Link or Create new. Nothing merges on its own (finding F2).
  - **Prefill** from Needle's facts. Phones are normalized to international format (`+` and country code); Holmes rejects any other format.
- **What a candidate needs:**

  | When | Required |
  |---|---|
  | At entry | name; a phone **or** an email; the resume |
  | Before moving past contacted (candidate status `contacted` → `approved`; case status past `contacted`) | phone, email, date of birth, nationality |
  | Before any email from Holmes (test or interview invitation, long-form invite) | email; the actions show "Add an email first" |
  | Optional | rank and vessel type (default from the requirement), months in rank, previous employer |

  - A resume without an email enters on its phone and shows "Missing: email".
  - A resume with neither phone nor email stays in the resume pool only.
  - **Schema change (H8).** Relax `2026060302_prospect_schema.sql` to the entry minimum, change `create_prospect_with_requirement` (it rejects a missing date of birth, phone or email), enforce the "past contacted" set in the status change, and check the screens, KPI and worksheet code that assume those fields. Staging first.
- **Save.** Creates or links the candidate and, if chosen, attaches them to the requirement; with case v1 in production, that starts the case.
- **Where it came from.** Holmes stores `needle_resume_id`, `source` (`needle_search`, `holmes_upload`, ...), the stage id and the engine version. The candidate page shows **View resume**.
- **What Needle never does.** It never writes to Holmes tables. Holmes writes use the recruiter's session and permissions, so Coordinators cannot add.

### 4.4 Match resumes on a requirement

1. On an open requirement, the recruiter clicks **Match resumes**.
2. Holmes asks Needle (`/ai/...`, same session) to find or create **this recruiter's** search for the requirement (external key `holmes:requirement:<id>`, per user, which fits Needle's per-user ownership), with filters mapped from the requirement: rank, vessel type and, where Needle supports them, nationality and joining window. Unmapped fields show as "not applied" and never become hard filters.
3. Holmes opens AI search on that search. The recruiter sees Needle's own ranked results, refines as usual, selects several and clicks **Add to Holmes**, with the requirement already chosen. Each goes through §4.3, and the recruitment flow starts for each.
4. Running it again after the requirement changes adds a new stage; earlier results stay.

A results list drawn by Holmes on the requirement page is deferred; it would rebuild Needle's result cards (option C).

**One requirement, many candidates** already works: a requirement has a positions count and any number of attached candidates, each with their own case under case v1. A candidate can be on several requirements.

**Holmes never reads Needle's database.** It gets Needle data only through Needle's API under the user's session.

### 4.5 Organizations: one resume pool per customer

**Decided 2026-11-05:** each customer searches only its own pool; the operator sees all.

- **Mapping.** Needle stores Holmes's organization id; names are display only. The development seed "Default organization" is renamed Njordships.
- **N8a, before launch.** Every resume and workspace record carries an organization, and searches, the repository, candidate detail and facts filter by the organization in the session. Because resume ids are content hashes, pool membership is keyed by (organization, resume id): the same PDF can be in two pools, and intake must stop skipping a hash that exists only in another organization's pool. All existing resumes are tagged Njordships; the existing pool becomes Njordships' pool. Existing test projects and chats can be deleted.
- **N8b, when a second customer signs.** A Drive folder and resume mailbox per organization, the worker reading each folder into its organization, and `workspace.db` moved to Supabase. Until then there is one folder, Njordships', fed by the existing email and Drive intake.
- **Every channel goes through the customer's folder:** uploads from Holmes (§4.6), the customer's resume mailbox, a one-time bulk move at onboarding, and later the candidate portal. Seajobs downloads stay outside Holmes.
- **Onboarding a customer** (operator, Operator → Organizations): create the organization, link its folder and mailbox, raise the intake batch size for the bulk load, and watch progress from Needle's corpus status.

### 4.6 Every Holmes candidate has a resume

**Decided 2026-11-05:** no candidate enters Holmes without a resume in the resume database.

| Way in | How the resume gets there |
|---|---|
| Add to Holmes from AI search or Match resumes | already in the pool; Holmes stores the resume id |
| New candidate in Holmes | the form gets a required resume upload (PDF only in v1); Holmes sends the file to Needle (N9), which stores it in the customer's folder and **returns the resume id at once** (the file's SHA-256) |
| Existing Holmes candidates | marked "Resume missing" and listed on the Dashboard until a resume is uploaded |
| Long-form applicants | already candidates with a resume (invited after a passed interview) |

**What the upload answers, and what Holmes shows:**

| Needle's answer | Holmes |
|---|---|
| New resume | Saves the candidate with the resume id. The candidate shows "Reading resume…"; the empty fields fill in when extraction finishes (about a minute or more) |
| Already in the pool, not yet in Holmes | Uses the existing resume and prefills from its facts at once. Not an error |
| Already in the pool and linked to a Holmes candidate | "This resume belongs to *name*", with **Open candidate**; no second candidate |
| Not a PDF, too large or unreadable | Rejected on the form: "Upload a PDF resume" |
| Extraction fails later | The candidate stays; the resume is stored and viewable. The candidate shows "Couldn't read this resume — fill in the details", and the failure is listed in Operator → Health |

The rule is met by the stored file, not by a successful extraction.

**Enforcement.** A check on new candidates only (in the create function or an insert trigger), so existing candidates without a resume can still be edited. A table constraint is added only after the backlog is cleared: Postgres checks even a not-yet-validated constraint on every update.

## 5. Operator: a Holmes platform flag and console

- **Operator** is a platform flag (a `platform_operators` table), not a row in `user_roles`. Holmes picks a user's main role from the first role row (`AuthContext.jsx:230`), so an Operator role row would make the Needle role mapping order-dependent. The token maps the flag to Needle `admin`.
- It reaches the operator console and Needle as `admin`; no recruiter permissions by default. KT can also hold a recruiter role; no role switcher is needed.
- Support access to an organization's data is a separate, audited action.

**The console**, at `/operator`, shown only to operators:

| Section | Contents | Comes from |
|---|---|---|
| Health | Needle `/healthz` and corpus status; intake failures; email delivery (Resend); last expiry-warning run; edge function errors | new |
| Platform settings | Microsoft app, Resend key, sender and notification addresses, Resend webhook secret, app URL. Set / not set with rotate; values never shown. (The Gemini key goes with the old search, H7) | **moved from** Settings → Integrations |
| AI | Needle runtime controls, Facts review, Evals (embedded, as `admin`); links to Needle Downloads and User Settings | Needle Admin |
| Organizations & users | Organizations, each with its folder, mailbox and intake progress; Master Recruiters; disable or reset an account | new; replaces Needle Admin → Users |
| Audit | Settings changes, support access, Needle admin changes | new |

Organizations keep **Team** and **Worksheet templates** in Settings. The Integrations tab leaves organization Settings.

## 6. Work list

### Needle (in the Needle repo; Holmes pins the release)

| # | Change | Why |
|---|---|---|
| N1 | Embed mode: no sidebar, login, user menu or branding; full-height content; `postMessage` for route sync and Add to Holmes, with origin checks | §4.1, §4.3 |
| N2 | `/auth/holmes`: verify the Holmes token (Ed25519), create or link the user, map role including `viewer`, set the session cookie; `/auth/logout`; direct login limited to operator accounts | §4.2 |
| N3 | Serve under `/ai` (frontend base path, API base); `frame-ancestors` and CORS for Holmes's origin; set `NJORDHR_FLASK_SECRET` in Railway | §4.1, §4.2 |
| N4 | Find or create a user's search by external key with initial filters; rank and ship-type mapping for Holmes ids | §4.4 |
| N5 | Add to Holmes in place of Verify in embed mode (single and multi-select) | §4.3 |
| N6 | Admin pages usable embedded (Settings, Facts review, Evals, corpus status) | §5 |
| N7 | Security fixes that affect the hosted build: the `X-Admin-Token` `!=` fallback on `/admin/users` (`backend_server.py:2963-2968`); RLS on `app_runtime_config`, `ai_file_registry`, `ai_feedback`, `njordhr_telemetry_logs`; confirm key rotation re-encrypts Seajobs credentials | before recruiters use it |
| N8a | **Before launch:** organization on resumes and workspace; pool membership by (organization, resume id); existing pool and data tagged Njordships | §4.5 |
| N8b | **When a second customer signs:** folder and mailbox per organization; `workspace.db` in Supabase | §4.5 |
| N9 | Resume upload: store the PDF in the customer's folder and return the resume id and status (new, in pool, linked, rejected) at once. If the upload registers the resume row itself, it must also queue extraction: Drive intake skips any hash already registered, so it would never pick that file up | §4.6 |

### Holmes

| # | Change | Depends on |
|---|---|---|
| H1 | Operator flag (`platform_operators`), `/operator` console shell, Integrations moved; Settings keeps Team and Worksheet templates; rename the organization to Njordships | nothing (can start now) |
| H2 | `needle-token` edge function (Ed25519) | N2; the `organizations` table (case v1 migration, or split out of it) |
| H3 | `/ai/*` forwarding by routing middleware and `NEEDLE_ORIGIN` per environment (test one real search first); AI search page with the session exchange, route sync, unavailable state and sidebar rail; behind a feature flag | N1–N3, H2 |
| H8 | Candidate fields: entry minimum, phone normalization, `create_prospect_with_requirement`, "past contacted" rule, email-gated actions, dependent screens; staging first | — |
| H5 | Add to Holmes dialog: pool or open requirement, duplicate rules, prefill fetched by resume id, provenance, View resume | N5, H3, H8; case v1 for the case path |
| H4 | Match resumes button on open requirements: find or create the search, open AI search on it, requirement preselected for Add to Holmes | N4, H5 |
| H9 | Required resume: PDF upload on the New candidate form via N9 with the answers in §4.6; "Resume missing" list for existing candidates; insert-only check; table constraint after backfill | N9, H8 |
| H6 | Operator → AI (embedded Needle admin pages) | N6, H1 |
| H7 | Retire the application-embedding search: Applications "AI search" panel, `AISearch`, `EmbeddingGenerator`, `embeddingService`, `gemini-*-proxy`, the Gemini key; drop `application_embeddings` only after export and sign-off | H3 live |

## 7. Risks and Needle findings

- **Two systems in one screen.** A Needle outage or slow release shows inside Holmes. Mitigation: the unavailable state, a pinned release per environment, the upgrade checks in `docs/needle-integration.md`.
- **Frame limits.** Needle's modals stay inside the content area; focus moves into the frame; history needs the route sync to avoid double Back steps.
- **Cost.** Needle has no budgets, rate limits or quotas, and recruiter use spends the operator's LLM credit. At minimum a monthly cap per organization and usage in Operator → Health.
- **Security (hosted build).** `/admin/settings` and `/api/agent/*` already return 404 on the hosted build. What does affect it: the `X-Admin-Token` `!=` fallback on `/admin/users`; Needle tables without RLS (`app_runtime_config` holds secrets in plaintext); credentials encrypted with a key derived from the Supabase service key.
- **State.** The Needle workspace lives on one Railway volume; it needs backups now.
- **Bulk intake speed.** At default settings intake runs about one resume a minute; raise the batch size for onboarding.

## 8. Owner decisions (2026-11-05)

- All hosted Needle features belong in Holmes, except Seajobs downloads and the Verified dashboard.
- Embed Needle's own UI in the Holmes shell.
- **Needle is never customer-facing.** It is served under Holmes's address; Holmes stays on Vercel.
- Verified is replaced by Add to Holmes into the candidate pool, with an optional requirement.
- Desktop pieces are not needed in Needle either.
- Requirement matching is wanted: Match resumes starts the recruitment flow for the chosen candidates.
- Each customer searches only its own resume pool. The existing Needle pool becomes Njordships' pool.
- Each customer has its own Drive folder (with multi-tenancy); Holmes uploads land there and Needle's email and Drive pipelines feed the pool from it; a new customer bulk-moves its resumes and connects its mailbox.
- Separate Operator role (built as a platform flag).
- Coordinators cannot run AI searches; they can open a candidate's resume.
- Retire Holmes's application search once Needle is embedded.
- Every Holmes candidate has a resume; missing details are completed on the first call.
- The organization "Default organization" (a development seed) is renamed Njordships.
- There are no real Needle users; existing projects and chats are test data.

## 9. Order

**First usable version = steps 1–3** (AI search embedded for the operator and one recruiter). Steps 4–7 follow only after that pilot is in use.

1. **H1**, operator flag and console with Integrations moved. Holmes only; can start now.
2. **Needle foundation:** N1–N3, N7. (Built 2026-11-05, with H1–H3: `docs/needle-embed-rollout.md`.) N8a follows the pilot and comes before launch.
3. **H2–H3**, AI search embedded behind a flag, after the test search through Vercel. Pilot with the operator, then one recruiter. Then **H7**.
4. **H8**, then **N5 + H5** Add to Holmes, then **N4 + H4** Match resumes. The case path follows case v1 in production.
5. **N9 + H9**, required resume.
6. **N6 + H6**, operator AI pages.
7. **N8b** when a second customer signs.

The 10-screen applicant form regroup and the candidate portal are separate tracks.

## 10. Review of 2026-11-05

An independent review checked this design against `railway-m1` and the Holmes repo. Changes made from it:
- resume ids are content hashes, so upload returns the id at once and pool membership is per organization (§4.5, §4.6);
- the resume rule is enforced on new candidates only until backfill (§4.6);
- serving Needle under Holmes's address replaces a bearer token on selected endpoints, which missed `/auth/me`, the corpus badge, Evals, Facts review and download links (§4.1, §4.2);
- frame message origin checks, and facts fetched by resume id (§4.2, §4.3);
- duplicate rules follow the unique email and the phone format (§4.3);
- missing dependencies added (H5 on H8, H4 on H5, H2 on the organizations table);
- multi-tenancy split into N8a and N8b;
- Match resumes opens Needle's results instead of a Holmes-drawn list, with one search per recruiter;
- security list narrowed to what the hosted build exposes;
- Operator as a platform flag, no role switcher; the Gemini key leaves with the old search.

## 11. Pilot implementation record (2026-11-05)

KT selected an operator-only production rollout because no staging Needle exists. Use the production-based `codex/holmes-operator-pilot` and `codex/needle-operator-pilot` candidates, not the broader staging branches. The pilot keeps production navigation/theme and adds Operator → AI review links. Needle is explicitly bound to one organization with scoped pool memberships and tagged workspace roots. This does not qualify full multi-customer intake/review/storage behavior. Candidate-field relaxation and Add to Holmes still follow the accepted embed pilot. `docs/needle-embed-rollout.md` is the current execution procedure; prior local smoke does not prove Vercel forwarding.
