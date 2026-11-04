# Needle inside Holmes: integration and operator design

Date: 2026-11-05 · Status: design; owner decisions of 2026-11-05 recorded in §8, none open. Nothing built.
Builds on `docs/needle-integration.md` (product boundary, data rules, upgrade policy) and `docs/platform-review-findings.md` (decisions 1, 2, 7). This note adds the screen-level design, the sign-in bridge and the operator console.

Sources:
- **Needle (deployed).** Branch `railway-m1` at `6a483c2` (2026-11-04, the hosted beta snapshot).
- **Needle (cross-checked).** The pushed `codex/production-integration` (`68bf116`, 2026-11-01): login, roles, hosted allowlist, routes, sidebar and workspace guard are identical to `railway-m1`. Its extra work is extraction (Qwen, Chandra) and an admin Pipeline Inspector page that is not routed yet.
- **Not reviewed.** The owner's local working line is `codex/production-integration` at `b4a43188` (2026-11-04 23:46 IST) with uncommitted changes; neither is pushed. Recheck this note if that work changes sign-in, roles, tenancy or the hosted screens.
- **Not used.** `main` (`fb22a53`, July) is months behind.
- **Holmes.** `ui/warm-theme` at `01ddd24`.

## 1. Summary

- **All hosted Needle features in Holmes, by showing Needle's own UI inside the Holmes shell**, in an embedded mode with no Needle sidebar, login or branding. Embedding is what keeps every feature, current and future; a rebuild would drop some. The two apps already share the same dark theme tokens (`#171614` background, `#d97757` accent), so the result looks like one product. Holmes adds the entry points and the actions that write to Holmes records.
- **One login.** Holmes signs the user in to Needle with a short-lived token minted by a Holmes edge function. Needle never shows its own login inside Holmes.
- **Two places for AI in Holmes:**
  - an **AI search** page in the sidebar (the full Needle workspace);
  - **Match resumes** on a requirement: Holmes asks Needle to run the match and lists the ranked resumes on the requirement page; the recruiter picks several and the recruitment flow starts for each.
- **Results flow into Holmes through one action, "Add to Holmes".** It adds the person to the Holmes candidate pool, optionally attached to a requirement. Holmes, not Needle, creates or links the candidate and records where they came from.
- **Every Holmes candidate has a resume in the resume database** (owner decision). Candidates enter with a small minimum (name, a phone or an email, the resume); the recruiter completes the rest at first contact.
- **Each customer searches only its own resume pool** (owner decision), so Needle needs organization scoping before launch, not later. Each customer's pool is fed by its own Drive folder: uploads from Holmes land there, and Needle's email and Drive pipelines read it. The existing Needle pool becomes Njordships' pool.
- **Operator becomes a Holmes role with its own console.** The console gets Holmes's platform settings (email, Microsoft, keys) and Needle's admin pages (runtime settings, facts review, evals, corpus status). Organizations keep Team and Worksheet templates.
- **Leave out (owner decision 2026-11-05):** Needle's Downloads (Seajobs) and the Verified dashboard (Add to Holmes replaces it). User Settings (Seajobs and Drive credentials) and login stay in Needle for the operator. Needle's desktop pieces (desktop app, local agent, local folder scanning, old single-file UI) are not needed in Needle either.
- **Retire Holmes's own AI search.** It searches the `applications` table, which the agreed boundary says is the wrong corpus. That covers the Applications "AI search" panel, the application embeddings and the two Gemini proxy functions.

## 2. What Needle has today (hosted build)

Needle's hosted build (`VITE_HOSTED=1`, `frontend/src/App.tsx`) already removes the desktop pages. On the server, `hosted_allowlist.py` returns 404 for everything else.

| Needle screen | What it does | Who sees it |
|---|---|---|
| Search: projects home and project tree | Projects, each holding chats (rename, pin, archive, move, undo delete) | everyone |
| Search workspace | Chat → run → refinement stages; filter tray with constraint chips (rank, ship type, engine, age, CoC, availability, tonnage); live progress (scan, gates, reasoning, narration); ranked cards with ✓/✗/? per filter and AI-fit badge; table view; candidate detail (resume and evidence, original PDF); "Assess fit"; Verify | everyone |
| Repository | The whole resume pool: filters, search, CSV, resume viewer | everyone |
| Verified dashboard | Shortlist built from Verify actions, with CSV | everyone |
| Downloads | Seajobs download jobs with OTP relay, run by the Railway worker | everyone |
| User Settings | Seajobs, Google Drive and Microsoft credentials | admin or integration manager |
| Admin → Facts review | Approve, reject or promote extracted resume facts | admin |
| Admin → Settings | Four runtime controls: reasoning model, minimum similarity, career-gap default, LLM promotion stage. Audited; secrets stay in Railway | admin |
| Admin → Evals, Evals registry | Model evaluation evidence | admin |
| Admin → Pipeline Inspector (`codex/production-integration` only, not routed yet) | Operator view of the extraction pipeline | admin |
| Admin → Users | User directory; browse any user's projects and chats; create users and rotate passwords | admin |
| Corpus status badge | Searchable count, stale or failed warning | everyone |
| Login | Username and password; Flask cookie session | everyone |

The server side relevant to Holmes:

- **Roles.** Needle has only `user` and `admin`. The code says "the admin is the operator" (`workspace_authz.py:46`).
- **Login.** Cookie session only. `CORS(app)` allows any origin but no credentials. There are no API tokens for `/api/workspace/*`.
- **No tenant.** No table has an organization key. A user sees only their own projects; the admin sees all.
- **Where the workspace lives.** Projects, chats, runs, stages and verified records are in SQLite on the Railway volume (`workspace.db`), not in Supabase.
- **Separate database.** Needle's tables are not in the Holmes production database (read-only audit, 2026-11-03).

## 3. Decision per Needle screen

| Needle screen | In Holmes | How |
|---|---|---|
| Search workspace with project tree | **Bring in.** New sidebar item **AI search** (Recruit group); also reached from **Refine in AI search** on a requirement | Embedded Needle UI (§4) |
| Repository | **Bring in** as a second tab on AI search: "Searches \| Resume pool" | Embedded |
| Candidate detail (resume, evidence, PDF) | **Bring in**, opened from search, pool, or a Holmes candidate that came from Needle | Embedded |
| Verify and Verified dashboard | **Replace** with **Add to Holmes** (owner decision). Holmes candidates and requirements are the shortlist | Needle sends the selection to Holmes (§4.3) |
| Corpus status badge | **Bring in** in the AI search header, and in Operator → Health | Embedded |
| Admin → Settings (runtime controls) | **Operator console** → AI | Embedded Needle admin page |
| Admin → Facts review | **Operator console** → AI | Embedded |
| Admin → Evals | **Operator console** → AI | Embedded |
| Admin → Pipeline Inspector | **Operator console** → AI, once routed | Embedded |
| Admin → Users | **Replace.** Holmes is the source of user accounts; Needle accounts are created automatically on first sign-in. Needle's page becomes read-only support | Operator console → Organizations & users |
| Downloads (Seajobs) | **Leave out** of Holmes (owner decision 2026-11-05) | — |
| User Settings (Seajobs, Drive, Microsoft for intake) | **Leave out.** Operator in Needle directly | Link from Operator → AI |
| Login | **Replace** with Holmes sign-in (§4.2) | — |

## 4. Architecture

### 4.1 UI: Needle's own screens, embedded

Three ways to put the search UI in Holmes:

| Option | Seamless | Effort | Keeps Needle independent | Verdict |
|---|---|---|---|---|
| **A. Embed Needle's UI in an iframe** filling the Holmes content area, in an embed mode (no Needle sidebar, login, user menu or branding) | High: same theme tokens; Holmes sidebar and URLs stay | Small on both sides | Yes. Needle ships UI and engine together; Holmes pins a version | **Recommended for v1** |
| B. Publish Needle's `src/search/*` (about 5,900 lines) as a package that Holmes imports | Highest | High. Needle is React 18, Router 6, Tailwind 4, TypeScript; Holmes is React 19, Router 7, Tailwind 3, JavaScript. ChatColumn depends on the router, the auth context and Needle's API client | Partly: two builds to keep in step | Later, only if the frame shows real limits |
| C. Rebuild the search UI in Holmes against Needle's API | High | Highest; duplicates Needle's fastest-changing UI | No; drifts on every Needle release | No |

**How it looks native:**

- **Shell and theme.** Holmes owns the shell: the sidebar, page title, breadcrumbs and the Holmes user menu. Needle in embed mode renders only its content (project list, chat, results) at full height with no outer padding. The theme tokens already match. Two things to align:
  - **Font size.** Needle uses 15px and Holmes 14px.
  - **Hard-coded colours.** Remove any remaining Tailwind palette colours in Needle chips and badges (on `main` they were in about 11 files).
- **Space.** AI search uses three columns (projects, chat, results). On that page the Holmes sidebar collapses to its icon rail, which already exists (`data-rail`).
- **Addresses.** The Holmes URL mirrors Needle's location: `/recruiter/ai/:projectId/:chatId` ↔ `#/search/:projectId/:chatId`. The frame and Holmes keep them in step with `postMessage`, so Back, refresh and shared links work.
- **Words.** Holmes says "candidate" and "requirement". Embed mode shows a project linked to a requirement as "REQ-2611-004 · Chief Officer". Needle's "resume" stays "resume" (it is the document), and Verify becomes "Add to Holmes".
- **Loading and errors.** Needle's own states show inside the frame. If Needle is down, Holmes shows a one-line "AI search is unavailable" with Retry, instead of a broken frame.

### 4.2 Sign-in: one login, token not cookie

The two apps are on different sites (`*.vercel.app` and `*.railway.app`). Browsers block cookies for a site inside another site's frame, so the embed must not rely on Needle's cookie.

1. When Holmes opens the AI search frame, it calls a new Holmes edge function, `needle-token`. The function checks the Supabase session and the role, then signs a short-lived token (about 10 minutes):
   `sub` (Holmes user id), `email`, `name`, `org` (organization id), `role` (Holmes Operator → `admin`, Master Recruiter or Recruiter → `user`, Coordinator → `viewer`: open a resume, no searches), `aud: needle`, `exp`.
2. Holmes hands the token to the frame with `postMessage`, never in the URL. Needle in embed mode sends it as `Authorization: Bearer` on `/api/workspace/*`.
   - The search stream is already a fetch-based POST, so it can carry the header.
   - The PDF view must fetch the file as a blob instead of pointing an `<iframe src>` at the URL.
3. Needle verifies the signature. On first use it creates or links a Needle user keyed by the Holmes user id. When the token is close to expiry, the frame asks Holmes for a new one.
4. Needle's own login and cookie session stay for the operator's direct use (Downloads, User Settings).

Security notes:
- **Signing key.** Use a key Needle can only verify, not mint: asymmetric, or Supabase's JWT signing keys if the Holmes project uses them. Otherwise a shared secret, stored in Holmes's function secrets and Railway env.
- **What Needle trusts.** Needle never takes the organization or role from the request body.
- **CORS.** Narrow Needle's CORS to the Holmes origins.
- **Frame embedding.** Needle must allow being framed only by Holmes, via `Content-Security-Policy: frame-ancestors`.

### 4.3 From a Needle result to a Holmes candidate: Add to Holmes

- **The action.** In embed mode, cards, table rows and candidate detail show **Add to Holmes** instead of Verify. A selection of several is allowed. Needle sends `{resume_id, stage_id, key facts}` per person to Holmes by `postMessage`.
- **The dialog.** Holmes opens its own dialog:
  - **Where to.** Into the candidate pool only (they appear under Candidates → Unattached), or into the pool and attached to a requirement in one step.
  - **Duplicate check.** Holmes looks for an existing candidate by email and phone and offers "link to existing" or "create new". It never merges silently (finding F2).
  - **Prefill.** Fields come from Needle's facts.
- **What a candidate needs at entry, and later (owner decision 2026-11-05, refined).** Name, phone, date of birth and email are usually on a resume, but extraction misses some and some resumes lack an email. So:

  | When | Required | Why |
  |---|---|---|
  | At entry | name; a phone **or** an email; the resume | enough to contact and to check for duplicates |
  | Before moving past "contacted" | phone, email, date of birth, nationality | the recruiter gets them on the first call; Holmes asks for them in the step that records the contact |
  | Before any email from Holmes (test or interview invitation, long-form invite) | email | these actions are disabled with "Add an email first" |
  | Optional | rank and vessel type (default from the requirement when attached), months in rank, previous employer | filled from the resume when found |

  - **A resume without an email** enters on its phone number. The candidate shows "Missing: email" until the recruiter adds it after the call. Nothing that sends email is possible until then.
  - **A resume with neither phone nor email** cannot enter Holmes. It stays in the resume pool, where it is still searchable.
  - **Duplicates** are proposed on a matching email, a matching phone, or name plus date of birth. The recruiter links or creates; nothing merges on its own (finding F2).
  - **Schema change.** Today the database requires date of birth, nationality, rank, vessel type, months in rank, phone, email and previous employer (`2026060302_prospect_schema.sql`). Relax these to the entry minimum above, enforce the "past contacted" set in the status change, and add the resume reference (§4.6). Staging first.
- **Save.** Saving creates or links the candidate and, if chosen, attaches them to the requirement. Once case v1 is live in production, attaching starts the case (`recruitment_case_open`).
- **Where it came from.** Holmes stores `needle_resume_id`, `source` (`needle_search`, `holmes_upload`, ...), the stage id and the engine version on the candidate. The Holmes candidate page shows **View resume**, which opens Needle's candidate detail.
- **What Needle never does.** It never writes to Holmes tables. Every Holmes write uses the recruiter's Holmes session and permissions, so Coordinators cannot add.

### 4.4 Match resumes on a requirement

The flow the owner asked for: fill a requirement, click a button, get a set of matching resumes, start the recruitment flow.

1. On the requirement page, the recruiter clicks **Match resumes**.
2. Holmes calls Needle server-side (edge function, with the recruiter's short-lived token from §4.2). The call asks Needle to find or create the search for this requirement (external key `holmes:requirement:<id>`) and run it with filters mapped from the requirement: rank, vessel type and, where Needle supports them, nationality and joining window.
   - Unmapped fields show as "not applied". They never become hard filters (`docs/needle-integration.md`).
   - This reuses Needle's existing search engine (`POST /runs/<id>/stages`). The new Needle pieces are the token check and the external key.
3. The requirement page shows a **Matches** list: name, rank, score, the ✓/✗/? per filter and the AI-fit reason, with **View resume**.
4. The recruiter ticks several and clicks **Add to requirement**. Each goes through the Add to Holmes dialog (§4.3) in one pass: duplicate check per person, leads allowed. They join the requirement's candidate list and the recruitment flow (cases) starts for each.
5. **Refine in AI search** opens the full embedded workspace on the same search, so every Needle refinement (chips, follow-up prompts, assess fit, table view) is available.
6. After the requirement changes, **Match resumes** again runs a new stage. Earlier results stay as they were.

**One requirement, many candidates** already works. A requirement has a positions count and any number of attached candidates (`prospect_requirements`, unique per candidate and requirement). With case v1, each candidate on a requirement has their own case, one active at a time (`recruitment_cases_one_active_uidx`). A candidate can be on several requirements.

**Can Holmes read Needle's data directly?** No, and it should not. Needle's data is in its own Supabase project, and reading it from Holmes would mean sharing Needle's service key and coupling the two schemas. Holmes gets Needle data only through Needle's API, with the recruiter's token: search results, resume facts for prefill, and the resume itself.

### 4.5 Organizations: one resume pool per customer

**Decided 2026-11-05:** each customer searches only its own resume pool, the way a user searches in Needle today. The operator sees all pools.

- **Needle work before launch, not before a second customer.** Every resume, its facts, markdown and search index entries carry an organization. Searches, the repository, candidate detail and the facts caches filter by the organization in the token. Projects, chats and runs are scoped the same way, and `workspace.db` moves to Supabase (it is on one Railway volume today and cannot be rebuilt from Supabase).
- **How a resume gets into a customer's pool:**
  - **Holmes upload:** when a recruiter creates a candidate (§4.6);
  - **customer intake folder:** a Drive folder per customer, using Needle's existing Drive intake;
  - **later, the candidate portal.**
  - Seajobs downloads stay outside Holmes. Whether the operator may still run them into a customer's pool is the customer's data-rights question, not Holmes's.
- **The existing Needle pool.** It has to be assigned to an owner before scoping goes live. If it was gathered for Njordships, it becomes Njordships' pool. Otherwise it stays operator-only and Njordships starts with the resumes it provides (open decision).

### 4.6 Every Holmes candidate has a resume

**Decided 2026-11-05:** no candidate enters Holmes without a resume in the resume database. One resume store keeps search, matching and the candidate record pointing at the same document.

| Way in | How the resume gets there |
|---|---|
| Add to Holmes from AI search or Match resumes | already in the customer's pool; Holmes stores the resume id |
| New candidate in Holmes (today's form) | the form gets a required resume upload. Holmes sends the file to Needle's intake for that customer, then stores the returned resume id. The fields the upload extracts prefill the form |
| Existing Holmes candidates (before this change) | marked "Resume missing" and listed on the Dashboard until a resume is uploaded. The database rule is added as not-yet-validated and validated once the backlog is cleared |
| Long-form applicants | they are already Holmes candidates with a resume, because the long form is invited after a passed interview |

- **Needle needs an upload endpoint** (N9). Hosted intake today is only the Drive folder worker; there is no upload API. Extraction is asynchronous, so the candidate is saved with the resume id at once and the extracted facts arrive later.
- **Enforcement** is a database rule on the candidate (a resume reference is required), not only a form check.
## 5. Operator: a Holmes role and console

Holmes today has Master Recruiter, Recruiter and Coordinator, all inside the one organization. KT runs the platform as the operator (decision 2026-11-04). The operator role is planned in `docs/platform-review-findings.md` §2 as a platform role outside organization memberships.

**The role.**
- Add **Operator** as a platform role.
- **Access.** It reaches the operator console, and Needle as `admin` through the token. It has no recruiter permissions by default.
- **Support access.** Access to an organization's data is a separate, audited action.
- **Using both roles.** KT can hold Operator and a recruiter role at the same time, and the user menu switches between them.

**The console**, at `/operator`, with its own sidebar section shown only to operators:

| Section | Contents | Comes from |
|---|---|---|
| Health | Needle `/healthz` and corpus status; email delivery (Resend); last scheduled expiry-warning run; edge function errors | new; Needle corpus badge |
| Platform settings | Microsoft app (client id, tenant, redirect, secret), Resend key, sender address, notification addresses, Resend webhook secret, Gemini key, app URL. Shown as set / not set with rotate; values never shown | **moved from** Holmes Settings → Integrations (`RecruiterIntegrationsSection.jsx`, `manage-runtime-settings`) |
| AI | Needle runtime controls, Facts review, Evals (embedded Needle admin pages, signed in as `admin`); links to Needle Downloads and User Settings | Needle Admin |
| Organizations & users | The organization (one today); its Master Recruiters; disable or reset an account; see a user's Needle activity | new; replaces Needle Admin → Users |
| Audit | Settings changes, support access, Needle admin changes (Needle already audits its runtime controls) | new |

**What organizations keep** (Settings, Master Recruiter):
- **Team.**
- **Worksheet templates.** The templates are the organization's per principal.
- The **Integrations** tab leaves organization Settings, and Holmes's settings permission stops covering platform keys.

## 6. Work list

### Needle (in the Needle repo; Holmes pins the release)

| # | Change | Why |
|---|---|---|
| N1 | Embed mode (build flag or `?embed=holmes`): no sidebar, login, user menu or branding; fills its frame; `postMessage` for route sync, token handoff and "Add to Holmes" | §4.1, §4.3 |
| N2 | Bearer token sign-in for embed (verify Holmes token, create or link the user, map role, including a read-only `viewer` that can open resumes but not search); blob-fetch the PDF view | §4.2 |
| N3 | `frame-ancestors` and CORS limited to Holmes origins; set `NJORDHR_FLASK_SECRET` in Railway (otherwise sessions reset on every deploy) | §4.2 |
| N4 | Find or create a search by external key (`holmes:requirement:<id>`) with initial filters, callable server-side with the token; rank and ship-type mapping for Holmes ids | §4.4 |
| N5 | Replace Verify with "Add to Holmes" in embed mode (single and multi-select); retire the Verified dashboard from the hosted build when Holmes is live | §4.3 |
| N6 | Embedded admin pages for the operator console (Settings, Facts review, Evals, corpus status) | §5 |
| N7 | Security fixes found in this review (§7) | before wider use |
| N8 | **Before launch:** organization scoping of resumes, facts, index, repository, searches and workspace; `workspace.db` in Supabase; per-customer Drive intake | §4.5 |
| N9 | Resume upload intake for a customer's pool, callable by Holmes with the token; returns a resume id and extracts asynchronously | §4.6 |

### Holmes

| # | Change | Depends on |
|---|---|---|
| H1 | Operator role, `/operator` console shell; move Integrations into it; Settings keeps Team and Worksheet templates | nothing (can start now) |
| H2 | `needle-token` edge function | N2 |
| H3 | AI search page (frame, route sync, unavailable state, sidebar rail on this page), behind a feature flag | N1–N3 |
| H4 | Match resumes on the requirement page: edge function calling Needle, Matches list, multi-select add, Refine in AI search | N2, N4 |
| H5 | Add to Holmes dialog: pool or requirement, duplicate check, prefill, provenance columns, View resume | N5; case v1 for the case path |
| H8 | Candidate fields: entry minimum (name; phone or email; resume), completion required before moving past contacted, email required before email actions (migration, staging first) | — |
| H9 | Resume required: upload on the New candidate form via N9; "Resume missing" for existing candidates; not-yet-validated database rule, validated after backfill | N9 |
| H6 | Operator → AI section (embedded Needle admin pages) | N6 |
| H7 | Retire Holmes's application-embedding AI search: Applications "AI search" panel, `AISearch`, `EmbeddingGenerator`, `embeddingService`, `gemini-*-proxy` functions, `application_embeddings` (drop the table only after export and sign-off) | H3 live |

## 7. Risks and Needle findings

**Seams.**
- **Two systems in one screen.** A Needle outage or slow release shows up inside Holmes. Mitigation: an unavailable state, a pinned release per environment, and the upgrade checks in `docs/needle-integration.md`.
- **Frame limits.** Needle's modals stay inside the content area, which is fine. Keyboard focus moves into the frame. Browser history needs the route sync to avoid double Back steps.

**Cost.** Needle has no budgets, rate limits or per-user quotas. Recruiter use spends the operator's LLM credit. At minimum: a per-organization monthly cap and usage shown in Operator → Health.

**Needle security issues** (from the `railway-m1` review). They matter before any recruiter outside the operator uses Needle:
- **Plaintext secrets, no RLS.** `app_runtime_config` stores secrets in plaintext and has no RLS. `ai_file_registry`, `ai_feedback` and `njordhr_telemetry_logs` have no RLS either. Needle uses its own Supabase project, but anyone holding that project's anon key could read them.
- **Plaintext over the API.** `GET /admin/settings?include_secrets=true` returns secrets in plaintext.
- **Admin token checks.** `X-Admin-Token` is compared with plain `!=` and reaches hosted `/admin/users`.
- **Fail-open tokens.** `cloud_api` and agent ingest accept requests when no token is configured.
- **Encryption tied to the service key.** Seajobs credentials and the OTP relay are encrypted with a key derived from the Supabase service key. Check that the recent key-rotation change (`0a703fc`) re-encrypts them.

**State.** The Needle workspace lives on one Railway volume. It needs backups now, and a move to Supabase before multiple organizations use it.

## 8. Owner decisions

Decided 2026-11-05:
- **All hosted Needle features belong in Holmes**, except Seajobs downloads and the Verified dashboard.
- **Embed Needle's own UI** in the Holmes shell (§4.1).
- **Seajobs downloads stay out of Holmes.**
- **Verified is replaced** by Add to Holmes into the Holmes candidate pool, with an optional requirement.
- **Desktop pieces are not needed in Needle either:** the desktop app, local agent, local folder scanning and the old single-file UI.
- **Requirement matching is wanted:** Match resumes on a requirement starts the recruitment flow for the chosen candidates (§4.4).
- **Each customer searches only its own resume pool** (§4.5).
- **Separate Operator role** (§5).
- **Coordinators cannot run AI searches.** They can open a candidate's resume.
- **Retire Holmes's application search** once Needle is embedded.
- **Every Holmes candidate has a resume** in the resume database (§4.6).
- **Missing details are completed by the recruiter on the first call** (§4.3), with the entry minimum and the "past contacted" rule.

Open:
1. **The existing Needle pool:** Njordships' pool, or operator-only (§4.5)?
2. **Customer intake:** is a Drive folder per customer the right channel besides Holmes upload, or something else (email, bulk upload)?

## 9. Order

1. **H1, the operator role and console with Integrations moved.** Holmes only; it can start now.
2. **Needle foundation:** N1–N3 (embed mode, token sign-in, framing and CORS), N7 (security fixes) and N8–N9 (per-customer pools and upload intake). Decide open item 1 before N8 goes live.
3. **H2–H3, AI search embedded** behind a flag. Pilot with the operator, then one recruiter. Then H7, retire the old search.
4. **N4 + H4, Match resumes; N5 + H5, Add to Holmes; H8–H9, candidate fields and required resume.** The case path follows case v1 in production.
5. **N6 + H6, operator AI pages.**

The 10-screen applicant form regroup and the candidate portal are separate tracks and do not block this.
