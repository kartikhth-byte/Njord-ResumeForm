## Playwright smoke tests

Run:

```bash
npm run test:smoke
```

Notes:

- Public-route smoke tests run without credentials.
- Recruiter sign-in smoke test runs when these variables are present. You can either export them in your shell or create a local `.env.playwright` file in the project root.

```bash
PLAYWRIGHT_RECRUITER_EMAIL=...
PLAYWRIGHT_RECRUITER_PASSWORD=...
```

- Example local file:

```bash
cp .env.playwright.example .env.playwright
```

- If you want to test against an already-running server, set:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

- Applicant Google login can be captured once and reused:

```bash
npm run test:auth:applicant
```

This opens a headed browser. Complete the Google login manually once, and Playwright will save the session to `playwright/.auth/applicant.json`.

- After that, `npm run test:smoke` will reuse the saved applicant session for applicant protected-route smoke tests.
