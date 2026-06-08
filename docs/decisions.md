# Decisions Log

## 2026-03 - Recruiter Role Model Simplified

Decision:
- recruiter-side roles are limited to:
  - `Master Recruiter`
  - `Recruiter`
  - `Coordinator`

Why:
- avoids admin clutter
- aligns the UI and DB model more cleanly
- makes permissions easier to reason about

## 2026-03 - Applicant vs Recruiter Auth Split Preserved

Decision:
- applicants use Google OAuth
- recruiter-side users use email/password

Why:
- this matches current product expectations and existing operational workflows

## 2026-03 - Recruiter Bootstrap Uses Edge Function

Decision:
- first-time recruiter setup is routed through `create-recruiter` edge function
- setup status is also resolved through the edge function

Why:
- avoids fragile direct browser-side RLS-sensitive setup logic
- keeps bootstrap rules centralized

## 2026-03 - Supabase Auth Lock Override Kept

Decision:
- keep the no-op auth lock override in `src/lib/supabase.js` for now

Why:
- it removed a severe signed-in startup delay caused by auth lock contention

Trade-off:
- introduces multi-tab refresh-token race risk that should be revisited later

## 2026-03 - Recruiter Password Reset Uses Supabase Auth

Decision:
- recruiter password reset emails are sent via Supabase Auth
- not through Resend

Why:
- password reset is an auth concern, not a custom transactional-email concern

## 2026-03 - Shared Applicant Branding Updated To Njord Holmes

Decision:
- shared applicant header branding now uses:
  - real `njord_logo.png`
  - product name `Njord Holmes`

Why:
- align visible tool identity to requested branding

## 2026-05 - Single Active Applicant Pipeline

Decision:
- enforce one active application per applicant at the database layer
- treat `hired`, `rejected`, and `withdrawn` as terminal statuses that allow a future application

Why:
- prevents alternate clients or stale browser state from bypassing applicant dashboard guards
- keeps the applicant pipeline unambiguous for recruiters

## 2026-05 - Edge Function CORS Uses APP_URL Allowlist

Decision:
- edge functions use a shared request-origin CORS helper instead of wildcard origins
- allowed origins come from the comma-separated `APP_URL` runtime setting, with edge env vars as fallback
- `OPTIONS` preflights return bodyless `204` responses

Why:
- browser access is limited to intended frontend origins
- the shared helper keeps CORS behavior consistent across deployed functions

## 2026-06 - Recruiter Shell Split Into Dashboard, Workspace, and KPI

Decision:
- the recruiter shell now uses a dedicated `Dashboard` snapshot, a `Workspace` for requirements/candidates/pipeline work, and a separate `KPI` page
- the legacy prospect route remains as a redirect into `Workspace` for compatibility

Why:
- keeps the executive snapshot clean
- separates daily operations from reporting
- preserves older entry points while the UI transition settles

## 2026-06 - Vite Uses Rollup WASM In Codex

Decision:
- the local Vite toolchain resolves `rollup` to `@rollup/wasm-node` through the repository manifest
- Playwright smoke launches Vite via the local `./node_modules/.bin/vite` binary instead of `npm run dev`

Why:
- the Codex macOS Node runtime cannot load the signed native Rollup addon reliably in this environment
- the WASM build keeps `npm run dev` and the smoke server bootable without manual node_modules patching
- the direct local binary avoids PATH drift and makes the smoke auto-start path deterministic
