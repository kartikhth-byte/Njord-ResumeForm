# Njord ResumeForm - Platform PRD

## Product Summary

Njord ResumeForm is a maritime recruitment platform for collecting applicant profiles, reviewing maritime qualifications, and operating recruiter workflows from intake through hiring.

The product now uses the user-facing brand name:
- `Njord Holmes`

## Primary User Groups

### Applicants

- authenticate with Google OAuth
- create and manage maritime application drafts
- complete a 20-section application form
- submit applications and track progress

### Recruiter-Side Users

- authenticate with email/password
- search and review applicants
- manage pipeline/status workflows
- schedule interviews and related actions

## Recruiter Roles

### Master Recruiter

- full recruiter admin
- manages recruiter accounts and roles
- manages team access and settings
- can operate the full recruiter workflow

### Recruiter

- full operational recruiter
- can review, search, schedule, and move candidates through pipeline
- cannot manage recruiter accounts/settings

### Coordinator

- limited support role
- can view candidates and support scheduling/status workflows
- cannot manage recruiter accounts/settings

## Core Product Areas

### 1. Applicant Intake

- Google OAuth login
- draft creation
- form autosave
- review and submission flow
- post-submission status visibility

### 2. Recruiter Operations

- recruiter dashboard
- application workspace
- advanced search
- pipeline/status progression
- scheduling flows

### 3. Recruiter Administration

- first-time setup via `/recruiter/setup`
- team management
- role assignment
- password reset support

### 4. AI/Advanced Search

- semantic candidate search
- LLM-assisted match reasoning
- manual filters
- confidence scoring

## Applicant Form Scope

The applicant workflow is built around a 20-section form, including:

- availability/application details
- personal/contact details
- passport
- CDC / Seaman's Book
- visas
- education
- dependents
- certificates of competency
- GMDSS certificates
- medical/vaccination
- medical history
- languages
- physical/uniform details
- STCW and marine courses
- flag state documents
- sea service
- experience summary
- references
- bank/emergency details
- declaration/consent

## Current Product Goals

- reduce recruiter time to identify viable maritime candidates
- maintain structured candidate records with maritime-specific qualifications
- support a clean split between applicant and recruiter experiences
- make recruiter account administration safe and explicit

## Current Non-Goals

- broad social-login support beyond Google OAuth for applicants
- password-based applicant accounts
- a large recruiter role matrix beyond the 3-role model

## Current Product Constraints

- auth and role behavior are tightly coupled to Supabase Auth + database RBAC
- recruiter bootstrap depends on the `create-recruiter` edge function
- applicant protected-flow smoke depends on stored Google session capture

## Current Success Signals

- `lint`, `build`, and smoke are green
- bootstrap setup works through the backend and is repaired for the UI path
- recruiter password reset is available
- recruiter/admin and applicant baseline flows are automated
