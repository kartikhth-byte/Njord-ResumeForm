# Njord ResumeForm - Project Handoff Status

**Last Updated:** March 18, 2026  
**Purpose:** Current-state handoff for a new chat/window  
**Status:** Active development, core smoke automation green

---

## Executive Summary

The project is in a stable working state for the main applicant and recruiter flows.

Verified locally:
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes with **29 passed**

The biggest completed workstreams in this phase were:
- recruiter/applicant auth hardening
- recruiter RBAC cleanup and role normalization
- recruiter bootstrap/setup repair
- recruiter password reset flows
- Playwright smoke automation stabilization
- applicant shared-header branding update to `Njord Holmes`

---

## Current Role Model

The recruiter-side role model is now intentionally limited to:

- `Master Recruiter`
- `Recruiter`
- `Coordinator`

Important distinction:
- applicants authenticate with Google OAuth
- recruiter-side users authenticate with email/password
- `profiles.user_type` is used for coarse account type
- recruiter capabilities are enforced through role/permission loading

---

## Recruiter Auth and Setup Status

### Working

- recruiter login via email/password
- first-time recruiter bootstrap flow via `/recruiter/setup`
- recruiter password reset from login page
- admin-triggered reset email action in Team Management
- last-master-recruiter safeguards in DB/app logic

### Important Implementation Notes

#### Bootstrap flow

The initial recruiter setup now relies on the `create-recruiter` edge function.

Supported actions in the function:
- `status`
- `bootstrap`
- existing recruiter-management actions

Key files:
- `src/pages/RecruiterSetup.jsx`
- `supabase/functions/create-recruiter/index.ts`

#### Required Supabase deployment step

When `create-recruiter` is changed locally, it must be redeployed:

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
supabase functions deploy create-recruiter
```

#### Password reset

Recruiter password reset uses Supabase Auth email flow, not Resend.

Routes/pages:
- `/recruiter/login`
- `/recruiter/reset-password`

Supabase Auth redirect URLs must include:
- `http://localhost:3000/recruiter/reset-password`
- production equivalent

---

## Database / RBAC Cleanup Status

The database cleanup and role normalization work was started and validated manually.

Important migration files:
- `supabase/migrations/20260317_01_align_rbac_to_user_roles.sql`
- `supabase/migrations/20260317_02_drop_legacy_rbac_tables.sql`
- `supabase/migrations/20260317_03_harden_assign_master_recruiter.sql`
- `supabase/migrations/20260317_04_normalize_recruiter_roles.sql`

Validated outcomes during this phase:
- `user_roles` is the intended source of truth for recruiter role assignment
- old role drift was identified and corrected
- first-recruiter/master bootstrap logic was hardened
- last-master-recruiter removal/demotion safeguards are in place

Known caution:
- the auth lock override in `src/lib/supabase.js` fixed a severe startup delay, but introduces some multi-tab refresh-token race risk

---

## Playwright Smoke Automation Status

### Current Result

Automated smoke is green:
- **29 passed**

Coverage includes:
- public routes
- recruiter authenticated smoke
- applicant authenticated smoke
- applicant stored-session refresh setup
- applicant section route smoke across all 20 sections
- applicant autofill smoke

Key files:
- `playwright.config.js`
- `tests/smoke/public.spec.js`
- `tests/smoke/authenticated.spec.js`
- `tests/smoke/applicant-sections.spec.js`
- `tests/smoke/applicant-fill.spec.js`
- `tests/smoke/applicant-auth.setup.js`
- `tests/smoke/applicant-refresh.setup.js`

### Operational Notes

Recruiter smoke depends on valid credentials in:
- `.env.playwright`

Applicant protected-flow smoke depends on a valid stored Google session, captured via:

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
npm run test:auth:applicant
```

Main smoke command:

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
npm run test:smoke
```

---

## Branding Status

Branding work has been partially updated.

### Applied

- shared applicant header branding now uses the real `njord_logo.png`
- product name updated to `Njord Holmes`
- subtitle currently reads:
  - `Recruitment Intelligence Workspace`

Key files:
- `njord_logo.png`
- `src/components/ui/BrandLockup.jsx`
- `src/components/layout/Navbar.jsx`
- `src/pages/Dashboard.jsx`
- `src/index.css`

### Important Note

The branding rollout is currently focused on the applicant shared header/dashboard surface.  
If strict global consistency is required across **all** recruiter/public pages, that should be treated as a follow-up pass.

---

## Team Management Status

Team management improvements completed:
- `Master Recruiter` team access restored
- signed-in account identity added to recruiter dashboard
- add-team-member modal scroll fixed
- recruiter team actions simplified around the 3-role model

Current intended behavior:
- `Send reset email` appears for `Master Recruiter` rows
- self row hides `Edit` and `Remove`
- `Recruiter` / `Coordinator` no longer show `Send reset email`

Primary files:
- `src/pages/RecruiterDashboard.jsx`
- `src/pages/RecruiterTeam.jsx`
- `src/components/recruiter/CreateRecruiterModal.jsx`
- `src/components/recruiter/EditRecruiterModal.jsx`

---

## Manual Validation Still Worth Doing

The automated suite is green, but these are still worth a manual pass:

- recruiter bootstrap end-to-end through the UI after a controlled reset
- recruiter reset-email link and new-password completion
- master recruiter create/edit/remove flows with real email/password behavior
- coordinator restricted access review
- final branding review across applicant, recruiter, and public surfaces

---

## Known Risks / Follow-Ups

### 1. Supabase auth lock override

File:
- `src/lib/supabase.js`

Current fix removed the severe startup lag, but the no-op auth lock may create refresh-token race behavior in multi-tab scenarios.

Recommendation:
- keep current fix for now
- revisit with a narrower lock strategy later

### 2. Full branding consistency

Current `Njord Holmes` branding is not yet guaranteed to be propagated to every recruiter/public view.

Recommendation:
- do one final global branding pass if product requires uniform naming everywhere

### 3. Documentation consolidation

The existing docs folder is still heavily weighted toward advanced search and redesign-era notes.

Recommendation:
- keep this handoff doc as the current source of truth for cross-cutting platform state

---

## Recommended Next Steps For A New Window

1. Start from this document first.
2. Verify current local state:
   - `npm run lint`
   - `npm run build`
   - `npm run test:smoke`
3. Decide whether the next priority is:
   - recruiter admin/manual QA
   - branding rollout
   - applicant full manual data-entry test
   - auth lock hardening

