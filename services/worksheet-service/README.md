# Worksheet Service

Hosted worksheet-generation service for customer exports.

This service:
- accepts recruiter-authenticated worksheet export requests
- rejects applications without `submitted_at` before reading template or form data
- downloads the active uploaded `.xlsx` worksheet template from Supabase storage
- fetches application data from Supabase
- reuses the existing Python writer in `scripts/client_forms/cma_cgm_writer.py`
- clears old applicant photo/signature images from reused templates while preserving branding outside those output zones
- preserves template wrapping and requests Excel text fitting for single-line output cells
- streams the generated workbook back to the caller

It does not perform `.xls` to `.xlsx` conversion. Upload normalized `.xlsx` templates in the app.
Submission is checked independently of the current workflow status, so a submitted form remains exportable after later case decisions.

Run the focused gate tests from the repo root:

```bash
python3 -m unittest discover -s services/worksheet-service -p 'test_*.py' -v
```

## Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred, `sb_secret_...`) or `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback)

Optional:
- `APP_URL`
- `WORKSHEET_SERVICE_HOST`
- `WORKSHEET_SERVICE_PORT`

## Run locally

From the repo root:

```bash
python3 -m pip install -r services/worksheet-service/requirements.txt
SUPABASE_URL=... SUPABASE_SECRET_KEY=... python3 services/worksheet-service/app.py
```

## Docker build

From the repo root:

```bash
docker build -f services/worksheet-service/Dockerfile .
```

## Staging deployment

Render service `njord-worksheet-service-staging` is configured for the `ui/warm-theme` branch,
`services/worksheet-service/Dockerfile`, Free compute, `/ready` health checks,
and manual deploys. Its `SUPABASE_URL` and secret key must belong to Holmes
staging (`dwslhetniuzpyuspuomy`), never production. `APP_URL` currently allows
the local staging frontend at `localhost:3000`, `127.0.0.1:3000`,
`localhost:5197` and `127.0.0.1:5197`. The
staging `WORKSHEET_SERVICE_URL` runtime setting points to
`https://njord-worksheet-service-staging.onrender.com`. Update the allowed
origin before using a remotely hosted staging frontend. The separate production
Render service tracks `main`; do not change it as part of staging deploys.

The new secret key is sent only in the `apikey` header for admin REST and
Storage calls. It must not be used as a bearer token. The applicant/recruiter
JWT remains in `Authorization` when validating a caller. The legacy
service-role key remains supported so production can migrate separately.
After switching staging to a new secret key, remove its legacy key from this
service and confirm both a submitted export and draft HTTP 409. Do not disable
staging's legacy project keys until the frontend and Edge Function consumers
have been migrated and tested independently.

Signature output is left blank because the writer has no confirmed signature input. Images without cell anchors fail conversion instead of risking applicant-image reuse. Validate each normalized customer template in Excel and on the hosted service before release.

The 2026-11-06 rehearsal manually deployed exact candidate commit `2e11d4a`
from `codex/holmes-warm-integration`, now live at
`dep-dbmv0orncjis73ajeer0`. Do not use Deploy latest on the older configured
branch and unintentionally remove the reviewed writer fixes. Previous staging
deploy: `dep-dbmag9142hec73e4icgg` / `8a2a0bc`. Production was not redeployed.
The real CMA layout with synthetic data matches 5,389 local values/styles and
layout metadata; old test photo/signature clearing and draft/applicant/unsigned
denials pass. KT approved CMA-only pilot scope and will review Excel/print
fidelity. A second customer needs its own mapping/layout acceptance first.
