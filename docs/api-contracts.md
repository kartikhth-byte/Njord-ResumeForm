# API and Contract Notes

## Auth Model

### Applicant

- Google OAuth via Supabase Auth
- callback route:
  - `/auth/callback`

### Recruiter

- email/password via Supabase Auth
- recruiter reset-password route:
  - `/recruiter/reset-password`

## Edge Function: `create-recruiter`

File:
- `supabase/functions/create-recruiter/index.ts`

Current important actions:

### `status`

Request:
```json
{ "action": "status" }
```

Response:
```json
{
  "setup_complete": true,
  "master_recruiter_count": 1
}
```

### `bootstrap`

Request:
```json
{
  "action": "bootstrap",
  "full_name": "Example Master Recruiter",
  "email": "master@example.com",
  "password": "Secret123!"
}
```

Behavior:
- allowed only when no master recruiter currently exists
- creates auth user
- upserts `profiles`
- assigns `Master Recruiter`

## Important Database Contracts

### Recruiter Roles

Canonical roles:
- `Master Recruiter`
- `Recruiter`
- `Coordinator`

### Role Assignment Source

- `user_roles` is the intended recruiter role assignment table

### Current Setup/Protection Rules

- last remaining `Master Recruiter` cannot be removed or demoted through normal guarded paths

## Testing Contracts

### Playwright Applicant Session

Refresh command:
```bash
npm run test:auth:applicant
```

### Playwright Smoke

Run:
```bash
npm run test:smoke
```
