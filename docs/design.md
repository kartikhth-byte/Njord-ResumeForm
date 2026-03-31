# Design Notes

## Current Brand

- product name: `Njord Holmes`
- logo source: `njord_logo.png`

## Current Applied Branding

- applicant shared header/dashboard uses the real logo
- shared brand lockup component:
  - `src/components/ui/BrandLockup.jsx`

## Current Design Direction

- light, high-clarity backgrounds
- glassy/soft panel styling
- strong typography for dashboard headings
- clear role separation between applicant and recruiter surfaces

## Current Gaps

- branding consistency across all recruiter/public pages may still need a follow-up pass
- final visual QA of the logo scale and spacing should continue during manual review

## Interaction Notes

- applicant flows should favor simplicity and progressive disclosure
- recruiter flows should expose operational controls without making admin actions easy to misuse
- admin modals must remain usable on shorter laptop screens

## Important UI Constraints

- bootstrap/setup should clearly show locked vs available state
- team-management actions should reflect role/permission intent
- self rows in recruiter team management should hide destructive/self-edit actions where appropriate
