# Worksheet Service

Hosted worksheet-generation service for customer exports.

This service:
- accepts recruiter-authenticated worksheet export requests
- rejects applications without `submitted_at` before reading template or form data
- downloads the active uploaded `.xlsx` worksheet template from Supabase storage
- fetches application data from Supabase
- reuses the existing Python writer in `scripts/client_forms/cma_cgm_writer.py`
- streams the generated workbook back to the caller

It does not perform `.xls` to `.xlsx` conversion. Upload normalized `.xlsx` templates in the app.
Submission is checked independently of the current workflow status, so a submitted form remains exportable after later case decisions.

Run the focused gate tests from the repo root:

```bash
python3 -m unittest discover -s services/worksheet-service -p test_app.py -v
```

## Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `APP_URL`
- `WORKSHEET_SERVICE_HOST`
- `WORKSHEET_SERVICE_PORT`

## Run locally

From the repo root:

```bash
python3 -m pip install -r services/worksheet-service/requirements.txt
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 services/worksheet-service/app.py
```

## Docker build

From the repo root:

```bash
docker build -f services/worksheet-service/Dockerfile .
```

## Staging deployment

Render service `njord-worksheet-service-staging` uses the `ui/warm-theme` branch,
`services/worksheet-service/Dockerfile`, Free compute, `/ready` health checks,
and manual deploys. Its `SUPABASE_URL` and service-role key must belong to Holmes
staging (`dwslhetniuzpyuspuomy`), never production. `APP_URL` currently allows
the local staging frontend at `localhost:3000` and `127.0.0.1:3000`. The
staging `WORKSHEET_SERVICE_URL` runtime setting points to
`https://njord-worksheet-service-staging.onrender.com`. Update the allowed
origin before using a remotely hosted staging frontend. The separate production
Render service tracks `main`; do not change it as part of staging deploys.
