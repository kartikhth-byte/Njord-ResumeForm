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
