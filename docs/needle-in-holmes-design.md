# Needle inside Holmes: integration and operator design

Date: 2026-11-05 · Status: proposal for owner decisions. Nothing built.
Builds on `docs/needle-integration.md` (product boundary, data rules, upgrade policy) and `docs/platform-review-findings.md` (decisions 1, 2, 7). This note adds the screen-level design, the sign-in bridge and the operator console.

Sources:
- **Needle (deployed).** Branch `railway-m1` at `6a483c2` (2026-11-04, the hosted beta snapshot).
- **Needle (cross-checked).** The pushed `codex/production-integration` (`68bf116`, 2026-11-01): login, roles, hosted allowlist, routes, sidebar and workspace guard are identical to `railway-m1`. Its extra work is extraction (Qwen, Chandra) and an admin Pipeline Inspector page that is not routed yet.
- **Not reviewed.** The owner's local working line is `codex/production-integration` at `b4a43188` (2026-11-04 23:46 IST) with uncommitted changes; neither is pushed. Recheck this note if that work changes sign-in, roles, tenancy or the hosted screens.
- **Not used.** `main` (`fb22a53`, July) is months behind.
- **Holmes.** `ui/warm-theme` at `01ddd24`.

## 1. Summary

- **Show Needle's own search UI inside the Holmes shell**, in an embedded mode with no Needle sidebar, login or branding. The two apps already share the same dark theme tokens (`#171614` background, `#d97757` accent), so the result looks like one product. Holmes adds the entry points and the actions that write to Holmes records.
- **One login.** Holmes signs the user in to Needle with a short-lived token minted by a Holmes edge function. Needle never shows its own login inside Holmes.
- **Two places for AI in Holmes:** an **AI search** page in the sidebar, and **Find candidates** on a requirement, which opens AI search already filtered for that requirement.
- **Results flow into Holmes through one action, "Add to requirement".** Holmes, not Needle, creates or links the candidate and records where they came from.
- **Operator becomes a Holmes role with its own console.** The console gets Holmes's platform settings (email, Microsoft, keys) and Needle's admin pages (runtime settings, facts review, evals, corpus status). Organizations keep Team and Worksheet templates.
- **Leave out:** Needle's Downloads (Seajobs), User Settings (Seajobs and Drive credentials), Verified dashboard and login. The operator keeps using them in Needle directly.
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
| Search workspace with project tree | **Bring in.** New sidebar item **AI search** (Recruit group) | Embedded Needle UI (§4) |
| Repository | **Bring in** as a second tab on AI search: "Searches \| Resume pool" | Embedded |
| Candidate detail (resume, evidence, PDF) | **Bring in**, opened from search, pool, or a Holmes candidate that came from Needle | Embedded |
| Verify and Verified dashboard | **Replace** with **Add to requirement**. Holmes requirements and candidates are the shortlist | Needle sends the selection to Holmes (§4.3) |
| Corpus status badge | **Bring in** in the AI search header, and in Operator → Health | Embedded |
| Admin → Settings (runtime controls) | **Operator console** → AI | Embedded Needle admin page |
| Admin → Facts review | **Operator console** → AI | Embedded |
| Admin → Evals | **Operator console** → AI | Embedded |
| Admin → Pipeline Inspector | **Operator console** → AI, once routed | Embedded |
| Admin → Users | **Replace.** Holmes is the source of user accounts; Needle accounts are created automatically on first sign-in. Needle's page becomes read-only support | Operator console → Organizations & users |
| Downloads (Seajobs) | **Leave out** of Holmes (agreed boundary). The operator runs them in Needle directly | Link from Operator → AI |
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
- **Words.** Holmes says "candidate" and "requirement". Embed mode shows a project linked to a requirement as "REQ-2611-004 · Chief Officer". Needle's "resume" stays "resume" (it is the document), and Verify becomes "Add to requirement".
- **Loading and errors.** Needle's own states show inside the frame. If Needle is down, Holmes shows a one-line "AI search is unavailable" with Retry, instead of a broken frame.

### 4.2 Sign-in: one login, token not cookie

The two apps are on different sites (`*.vercel.app` and `*.railway.app`). Browsers block cookies for a site inside another site's frame, so the embed must not rely on Needle's cookie.

1. When Holmes opens the AI search frame, it calls a new Holmes edge function, `needle-token`. The function checks the Supabase session and the role, then signs a short-lived token (about 10 minutes):
   `sub` (Holmes user id), `email`, `name`, `org` (organization id), `role` (Holmes Operator → `admin`, Master Recruiter or Recruiter → `user`), `aud: needle`, `exp`.
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

### 4.3 From a Needle result to a Holmes candidate

- **The action.** In embed mode, cards, table rows and candidate detail show **Add to requirement** instead of Verify. Clicking it sends `{resume_id, stage_id, key facts}` to Holmes by `postMessage`.
- **The dialog.** Holmes opens its own dialog, "Add <name> to REQ-…":
  - **Duplicate check.** Holmes looks for an existing candidate by email and phone and offers "link to existing" or "create new". It never merges silently (finding F2).
  - **Prefill.** The fields come from Needle's facts. The recruiter supplies what a Holmes candidate requires but the resume lacks (today: date of birth, nationality, experience, phone, email).
  - **Save.** Saving creates or links the prospect and attaches it to the requirement. Once case v1 is live in production, it starts the case instead (`recruitment_case_open`).
- **Where it came from.** Holmes stores `needle_resume_id`, `source = 'needle_search'`, the stage id and the engine version on the candidate. The Holmes candidate page then shows **View resume**, which opens Needle's candidate detail.
- **What Needle never does.** It never writes to Holmes tables. Every Holmes write uses the recruiter's Holmes session and permissions, so Coordinators cannot add.

### 4.4 Find candidates on a requirement

- **The button.** The requirement page gets **Find candidates**. It opens AI search on a Needle project linked to that requirement, creating the project if needed, with chips prefilled from the requirement: rank, vessel type and, where Needle supports them, nationality and joining window.
- **Needed on the Needle side.** An "open or create project by external key" call (`holmes:requirement:<id>`) that accepts initial filters. Plus a mapping from Holmes `rank_id` and `vessel_type_id` to Needle's canonical ranks and ship types.
  - Unmapped fields show as "not applied". They never become hard filters (`docs/needle-integration.md`).
- **Requirement changes.** A rerun after the requirement changes is a new stage, which Needle already supports.

### 4.5 Organizations and data rights

- **What works without tenancy.** Needle has no tenant model. That is acceptable only while Holmes has one organization (Njordships) plus the operator. The token already carries `org`, so nothing in Holmes changes later.
- **Gate before a second organization:** Needle must scope projects, chats, runs and the resume pool by organization in its stores and queries, and move `workspace.db` to Supabase (it is on one Railway volume today and cannot be rebuilt from Supabase).
- **Corpus rights (finding F4).** The existing pool was gathered by Seajobs downloads. Recruiters may search it only if the organization that sourced it is the one searching. This is an owner decision (§8.2).

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
| N1 | Embed mode (build flag or `?embed=holmes`): no sidebar, login, user menu or branding; fills its frame; `postMessage` for route sync, token handoff and "Add to requirement" | §4.1, §4.3 |
| N2 | Bearer token sign-in for embed (verify Holmes token, create or link the user, map role); blob-fetch the PDF view | §4.2 |
| N3 | `frame-ancestors` and CORS limited to Holmes origins; set `NJORDHR_FLASK_SECRET` in Railway (otherwise sessions reset on every deploy) | §4.2 |
| N4 | Open or create a project by external key with initial filters; rank and ship-type mapping for Holmes ids | §4.4 |
| N5 | Replace Verify with "Add to requirement" in embed mode | §4.3 |
| N6 | Embedded admin pages for the operator console (Settings, Facts review, Evals, corpus status) | §5 |
| N7 | Security fixes found in this review (§7) | before wider use |
| N8 | Before a second organization: organization scoping and `workspace.db` in Supabase | §4.5 |

### Holmes

| # | Change | Depends on |
|---|---|---|
| H1 | Operator role, `/operator` console shell; move Integrations into it; Settings keeps Team and Worksheet templates | nothing (can start now) |
| H2 | `needle-token` edge function | N2 |
| H3 | AI search page (frame, route sync, unavailable state, sidebar rail on this page), behind a feature flag | N1–N3 |
| H4 | Find candidates on the requirement page | N4 |
| H5 | Add-to-requirement dialog: duplicate check, prefill, provenance columns on the candidate, View resume | N5; case v1 for the case path |
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

1. **UI approach:** embed Needle's own UI in the Holmes shell (recommended), or rebuild it in Holmes.
2. **Corpus for Njordships:** may Njordships recruiters search the existing Needle pool? It depends on whose Seajobs account gathered it (finding F4). If not, AI search starts with resumes Njordships provides or uploads.
3. **Operator role:** a separate platform role with audited support access (recommended), with KT also holding a recruiter role. Or keep "Master Recruiter = operator" until a second organization signs.
4. **Coordinators:** recommended: Coordinators see AI search results attached to candidates but cannot run searches, because searches cost money. Alternatively they could run read-only searches.
5. **Seajobs downloads:** confirm they stay in Needle, run by the operator, and out of Holmes.
6. **Retire Holmes's application search** once Needle search is live (recommended), or keep both for a period.

## 9. Order

1. Owner decisions 1–3.
2. **H1, the operator console with Integrations moved.** Holmes only and small; it can start now.
3. **N1–N4 in Needle, then H2–H4 behind a flag.** Pilot with the operator first, then one recruiter.
4. **N5 + H5, Add to requirement.** The case path follows case v1 in production.
5. **N6 + H6, operator AI pages; then H7, retire the old search.**
6. **Before a second organization:** N8 and Holmes multi-organization RLS.

The 10-screen applicant form regroup and the candidate portal are separate tracks and do not block this.
