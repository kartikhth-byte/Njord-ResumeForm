# Worksheet Service

Hosted worksheet-generation service for customer exports.

This service:
- accepts recruiter-authenticated worksheet export requests
- downloads the active uploaded `.xlsx` worksheet template from Supabase storage
- fetches application data from Supabase
- reuses the existing Python writer in `scripts/client_forms/cma_cgm_writer.py`
- streams the generated workbook back to the caller

It does not perform `.xls` to `.xlsx` conversion. Upload normalized `.xlsx` templates in the app.

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
