# Project Status

## Current Milestone

- Stabilize recruiter/admin workflows and begin staged client-form export implementation

## Completed

- recruiter/applicant auth hardening
- recruiter RBAC cleanup and role normalization
- recruiter bootstrap/setup repair
- recruiter password reset flow
- Playwright smoke suite implementation and stabilization
- recruiter team-management fixes
- applicant shared-header branding update using the real `njord_logo.png`
- recruiter status-update modals now keep background scroll locked and allow the modal body to scroll
- recruiter status updates now refresh application lists/counts in the background instead of flashing the full workspace loader
- duplicate emergency-contact section removed from the applicant form flow
- declaration is now a real `section19` route/data key instead of the previous `section20` workaround
- applicant dashboard submitted-application view now renders an applicant-facing read-only summary and hides recruiter-only workflow controls
- recruiter review emails now issue expiring secure application links instead of relying on raw `public_token` access alone
- recruiter review emails now support a `RECRUITER_NOTIFICATION_EMAIL` runtime setting for development; if set, all recruiter submission emails are sent only to that address instead of profile-derived recruiter recipients
- Section 14 simplified so course metadata is system-managed from the course map, deprecated fields were removed, and existing data was normalized through DB migration
- applicant auth refresh fixture repaired so smoke can regenerate applicant session state reliably
- CMA CGM writer prototype implemented for Sections 1 and 2 plus applicant photo

## Current Verification State

- Review follow-up on 2026-03-30:
- applicant sign-out cleanup no longer throws `clearLoginIntent is not defined`
- applicant Google sign-in no longer waits on profile bootstrap before routing to `/dashboard`
- declaration step now routes at `/application/form/section/19` and the visible numbering is aligned across sidebar, dropdown, footer, review, and dashboard
- applicant submitted-application summary no longer exposes recruiter-oriented header copy or status-change controls
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes (`75 passed, 2 skipped`) on top of the latest diff
- live post-migration Section 14 submitted-application sanity check passed
- CMA CGM writer prototype generated a visually correct Sections 1 and 2 export for live application `NJD-211280`

## Current Role Model

- `Master Recruiter`
- `Recruiter`
- `Coordinator`

## Current Auth Model

- applicant: Google OAuth
- recruiter: email/password

## Important Commands

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test:smoke`
- `npm run test:auth:applicant`
- `npm run prototype:cma-cgm -- --template '/Users/kartikraghavan/Downloads/CMA CGM form 1.numbers' --public-token '<public-token>' --output '<output.xlsx>'`
  currently populates Sections 1 and 2 plus the applicant photo

## Known Issues / Risks

- multi-tab auth behavior has residual risk because the Supabase auth lock was overridden to eliminate a severe startup stall
- full branding consistency across all recruiter/public pages still needs a final pass
- recruiter admin/manual validation still needs a short human QA pass beyond smoke automation
- the client-form writer is still a prototype CLI, not yet wired into recruiter UI/settings
- live DB export generation depends on network access to Supabase and local macOS Numbers for `.numbers` template export
- do not carry the development `RECRUITER_NOTIFICATION_EMAIL` override into customer deployment; production must route recruiter emails to real recruiter inboxes/profile emails using a verified Resend domain/from-address

## Immediate Next Steps

- inspect the next client-form sections to determine the next export slice after Sections 1 and 2
- decide whether to keep the writer as a Python utility or wrap it behind a backend/service endpoint before UI integration
- manually verify the applicant submitted-application summary from the dashboard against applicant expectations
- manual QA of recruiter admin flows
- clean applicant test-data state and retest full applicant entry flow
- decide whether to harden the auth lock implementation further
