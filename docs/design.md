# Design Notes

## Current Brand

- product name: `Holmes`
- Holmes is operated by its owner; Njordships is a customer
- visible identity: text wordmark and `public/favicon.svg`
- customer names and logos are separate from the Holmes product identity

## Current Applied Branding

- applicant and recruiter surfaces use the Holmes wordmark
- shared brand lockup component:
  - `src/components/ui/BrandLockup.jsx`

## Current Design Direction

- superseded by `docs/ui-theme-spec.md` (warm compact theme: recruiter dark, applicant light)
- clear role separation between applicant and recruiter surfaces

## Current Gaps

- branding consistency across all recruiter/public pages may still need a follow-up pass
- final visual QA of the wordmark scale and spacing should continue during manual review

## Interaction Notes

- applicant flows should favor simplicity and progressive disclosure
- recruiter flows should expose operational controls without making admin actions easy to misuse
- admin modals must remain usable on shorter laptop screens

## Important UI Constraints

- bootstrap/setup should clearly show locked vs available state
- team-management actions should reflect role/permission intent
- self rows in recruiter team management should hide destructive/self-edit actions where appropriate
