# Platform Resume Intake (Holmes-owned)

Private Drive originals and a Holmes registry are authoritative. Needle consumes
reviewed registration events and approved facts; it never writes these originals
or merges people from contacts. This service is separate from the frozen
training/production rich-conversion path. It does not call Gemini, NuExtract,
Qwen, OpenRouter, or any hosted model.

## Runtime

Build from this directory:

```sh
docker build -t holmes-resume-intake:<release> services/resume-intake
```

Deploy only after KT's release gate. Use HTTPS behind the service ingress, a
private signature volume, a memory/CPU limit, and no persistent processing disk.
The container updates ClamAV signatures before starting and fails closed when
signatures/scanning are unavailable. PDF parsing and OCR use private temporary
directories that are removed. Store credentials only in the provider secret store.
Do not expose this service's registry or Drive credentials to the browser.

Required private environment:

- `SUPABASE_URL`: **Holmes** project URL.
- `SUPABASE_SECRET_KEY`: Holmes service credential; `sb_secret` uses `apikey`
  only, legacy JWT additionally uses Bearer. Never use a browser key.
- `RESUME_INTAKE_PUBLIC_KEY`: Holmes Ed25519 public signing key (PEM).
- `RESUME_INTAKE_ORG_ID`: pilot organization UUID.
- `RESUME_INTAKE_DRIVE_FOLDER_ID`: dedicated private platform folder.
- `RESUME_INTAKE_DRIVE_CLIENT_ID`, `RESUME_INTAKE_DRIVE_CLIENT_SECRET`,
  `RESUME_INTAKE_DRIVE_REFRESH_TOKEN`: platform-owned OAuth connection with
  access to its folder and imported legacy originals. No interactive OAuth is
  attempted by the service. Qualification reused the existing local Drive login
  and a synthetic-only folder; production credential provisioning is a KT gate.
- `PORT`: provider HTTP port (default 8080 in the container).

Requests require short-lived Ed25519 tokens with issuer `holmes`, audience
`resume-intake`, exact organization, actor, purpose and per-version/hash scope.
A Needle session token is not valid here. `/healthz` reveals versions only.

## Contract and bounds

`POST /v1/upload` accepts an unlocked PDF, at most 10 MiB and 1–100 pages.
`POST /v1/import` reuses and hash-verifies an existing private Drive original.
The authenticated Holmes API first resolves an unseen hash against Needle's
organization-scoped legacy document registry; lookup failure is explicit and
never treated as "not found". Existing platform versions remain usable during
an indexing outage. This metadata lookup does not run an index/model/search.
Both paths scan before registration and never overwrite by filename. A lease
and Drive app-property recovery reconcile retries and orphaned writes.

Embedded text is preferred per page. Image-only pages use local Tesseract.
Every page has a marker and method/outcome. OCR is bounded to 20 seconds/page,
60 seconds total, a bounded raster size, and explicit per-page/total text limits. Exhaustion produces explicit
partial/failed page evidence; it never silently marks truncated output complete.
Over-limit/locked/unsafe PDFs fail before storage. Stored originals survive
extraction failure and permit manual completion.

Suggestions have value, heuristic confidence, evidence, page and method.
Confidence is not a calibrated probability. Nothing auto-populates confirmed
Holmes identity/contact fields. No CV classification or automatic approval is
claimed: non-CV input is held for human review and creates no facts/candidate.

`POST /v1/versions/<id>/extract` explicitly appends another immutable attempt.
`GET /v1/versions/<id>/pdf` independently retrieves and SHA-verifies the original.

A stored original is **awaiting identity review**, not indexed. New/link review
commits candidate/source/case and the versioned outbox event together. Hold
creates no candidate/case/outbox event. `resume-index-dispatch` retries delivery
independently. Configure a private scheduled POST with a random 32+ byte
`x-resume-dispatch-secret` matching `RESUME_INDEX_DISPATCH_SECRET`; never put it
in a browser, URL, Git, or logs. Keep `RESUME_INTAKE_ENABLED=false` until rollout
is qualified. It blocks new preparation/upload/retry; authenticated original
view/status stay available. Existing authorized review receipts are not revoked. The separate Railway `NJORDHR_DRIVE_INTAKE_ENABLED=false` stays off
until KT accepts the selected extractor hookup. Delivery is not facts approval.

## Tests

```sh
python -m pytest -q services/resume-intake/tests/test_intake.py
node supabase/tests/resume-intake.test.mjs
```

The SQL harness uses PGlite and the actual ordered migrations. Staging acceptance
and known deployment boundaries are in
`docs/PLATFORM_RESUME_INTAKE_SLICE_2026-11-07.md`.
