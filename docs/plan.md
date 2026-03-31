# Technical Plan

## Current Phase

- stabilize platform workflows
- replace scattered legacy docs with a cleaner operating set
- finish admin/manual validation around recruiter setup and role management

## Near-Term Workstreams

### 1. Documentation Consolidation

- establish `documentation.md` as live project memory
- establish `docs/tasks.md` as pending-work source of truth
- keep `Njord-Resumeform-Documents/` as legacy/reference material

### 2. Recruiter Admin Hardening

- verify bootstrap reset and first-master-creation path end-to-end
- verify self-service and admin-triggered password reset
- verify role restrictions for `Recruiter` and `Coordinator`

### 3. Applicant Validation

- reset applicant test data
- perform full manual applicant-entry pass across all sections
- compare manual behavior against Playwright smoke expectations

### 4. Branding Rollout

- finish replacing old naming with `Njord Holmes`
- verify real logo usage across all shared headers/surfaces
- do a final consistency pass on recruiter/public pages if required

### 5. Auth Risk Follow-Up

- keep current startup fix in place
- evaluate a narrower replacement for the Supabase auth lock override later

## Verification Baseline

- `npm run lint`
- `npm run build`
- `npm run test:smoke`

## Deployment-Sensitive Areas

- `supabase/functions/create-recruiter/index.ts`
- `src/components/auth/AuthContext.jsx`
- `src/lib/supabase.js`
- recruiter team-management UI
- applicant shared navigation/header
