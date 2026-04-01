# Code Review — Njord Holmes
**Date:** 2026-04-01
**Scope:** Full repo — Supabase edge functions, Flask worksheet service, Python writer, React services layer

---

## Executive Summary

The codebase is well-structured and mostly clean. The edge functions follow a consistent pattern, the React services layer is tidy, and the Python writer is impressively complete. There are three areas that need attention before this goes further into production:

1. **Two parallel worksheet generation implementations** that will diverge. This is the highest-priority structural issue.
2. **The `.numbers` template conversion path** depends on macOS Numbers + AppleScript and will never work in any cloud environment.
3. **Applicant photos are fetched from a public storage URL** — unauthenticated — in both implementations.

Everything else is either a minor clean-up or a hardening suggestion.

---

## 1. Worksheet Generation — The Structural Problem

There are two completely separate implementations of the worksheet generation logic:

| | Flask service (Render) | Supabase Edge Function |
|---|---|---|
| File | `services/worksheet-service/app.py` + `scripts/client_forms/cma_cgm_writer.py` | `supabase/functions/generate-customer-worksheet/index.ts` |
| Runtime | Python 3.12 + openpyxl + Pillow | Deno + ExcelJS |
| Routing | Used when `WORKSHEET_SERVICE_URL` is set | Used as fallback |
| Field mappings | ~400 mappings in Python dataclasses | Duplicated in TypeScript |

Both contain the same field mapping tables, the same transform logic, the same sea-service history population, the same End sheet experience summary — maintained separately. Any mapping fix or new section has to be applied twice or they silently diverge. The TypeScript edge function is already 43 KB.

**Recommendation: consolidate to one implementation.**

The Flask service on Render is the better choice to keep, for two concrete reasons:
- openpyxl handles Excel format edge cases (merged cell state, indexed colour preservation) more reliably than ExcelJS. The style-preservation work you did — copying fill/border/font/alignment before writing and re-applying — is already proven in Python.
- It runs in a real container so it can be extended to handle LibreOffice conversion for `.xls` templates without Deno sandbox restrictions.

**What to do:**
- Set `WORKSHEET_SERVICE_URL` permanently in production runtime settings so the edge function fallback is never reached.
- Deprecate `generate-customer-worksheet` by having it return a `501 Not Implemented` with a message pointing to the service URL. Or just keep it dead but do not update its mappings going forward — it will quietly rot either way, so making it explicit is cleaner.
- The `normalize-worksheet-template` edge function should stay — it is a separate concern (template upload normalization) and doesn't duplicate generation logic.

---

## 2. Template Normalization — The macOS Dependency

`scripts/client_forms/cma_cgm_writer.py` → `export_numbers_template()`:

```python
applescript = f"""
tell application "Numbers"
  activate
  open inputAlias
  delay 2
  export exportedDoc to outputFile as Microsoft Excel
  ...
```

This works on a developer's MacBook and nowhere else. The Docker container (`python:3.12-slim`) has no Numbers, no AppleScript, no GUI. If a recruiter uploads a `.numbers` template, the Render service will crash.

The `app.py` entry point enforces `source_extension == 'xlsx'` before calling the writer, which protects the service path. But the CLI path (`prototype:cma-cgm`) lets `.numbers` through and hits this code.

**Recommendation:**
- The service is already protected — keep the `source_extension != 'xlsx'` guard.
- The `normalize-worksheet-template` edge function should handle the one-time normalization at upload time, not at generation time. Verify it actually converts `.numbers` via a server-side path rather than deferring to the client.
- Remove or stub `export_numbers_template()` from the writer and replace it with a clear error: "Upload an .xlsx template. Use the normalize endpoint to convert .numbers files."
- Long-term: if `.numbers` → `.xlsx` conversion is needed server-side, LibreOffice in the Docker image handles `.xls` already (`export_xls_template()`). Numbers files are a zip archive (`Index/Document.iwa`) and there is no reliable headless converter except LibreOffice on Linux (which does support Numbers since v6.x). Add LibreOffice to the Dockerfile and route both `.xls` and `.numbers` through it.

---

## 3. Applicant Photo — Public Storage URL

In `cma_cgm_writer.py` → `resolve_photo_bytes()`:

```python
def build_public_storage_url(storage_path: str) -> str:
    ...
    return f"{supabase_url}/storage/v1/object/public/{PHOTO_BUCKET}/{quoted_path}"
```

And in `app.py` → `fetch_photo_bytes()`:

```python
response = requests.get(
    f"{SUPABASE_URL}/storage/v1/object/public/{PHOTO_BUCKET}/..."
)
```

Both download from the **public** bucket path without authentication. This means:
- Anyone who knows (or guesses) a storage path can download any applicant photo without credentials.
- The path format is predictable: `{user_id}/{filename}` or similar.

**Recommendation:**
- Change both to use the authenticated storage API: `/storage/v1/object/{PHOTO_BUCKET}/...` with the service role key in the `Authorization` header. The `app.py` already has `service_role_headers()` available — use it.
- In `cma_cgm_writer.py`, the CLI path re-reads `.env.local` inside `build_public_storage_url()` every call. Move env loading to once at startup. Use the service role key there too.
- Consider whether `application-photos` should be a private bucket. If photos are currently public, any URL leak exposes them.

---

## 4. Edge Functions — Auth Coverage

Most edge functions that take destructive or privileged actions do not verify the calling user's identity. They rely entirely on being invoked through the Supabase client which passes a JWT, but the functions themselves mostly skip validation.

Examples:
- `send-application-emails/index.ts` — accepts any `applicationId`, no caller identity check.
- `create-recruiter/index.ts` — validates role logic well but does not verify the *caller* is a Master Recruiter; any authenticated client can call it.
- `schedule-event/index.ts` — has a `has_permission` check for `schedule_interviews`, which is the right pattern.

The `schedule-event` pattern is the one to follow. The missing check in `create-recruiter` is worth fixing since it controls account creation.

**Recommendation:**
- For `create-recruiter`, before any action, verify the caller has `manage_team` or equivalent permission via `has_permission` RPC, same pattern as `schedule-event`.
- For email send functions, the risk is lower (spam, not data leak), but at minimum validate that the `applicationId` belongs to a submitted application before sending, which `send-application-emails` already does with `.not('submitted_at', 'is', null)`. Keep that.

---

## 5. CORS Wildcard on All Edge Functions

Every edge function has:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
}
```

This means any website can invoke your edge functions from a browser if they can get a valid JWT. The JWT requirement is the real guard, but wildcard CORS means a phishing page could prompt a logged-in recruiter's browser to call your functions.

The Flask service does this correctly — it validates `Origin` against `ALLOWED_ORIGINS` from `APP_URL`. The edge functions should do the same, or at minimum restrict to your production domain.

**Recommendation:** Pass the allowed origin through `getRuntimeSettings(['APP_URL'])` and restrict the CORS header to that value. The `_shared/runtime-settings.ts` already fetches `APP_URL` — add it to CORS headers in a shared helper.

---

## 6. Flask Service — Minor Issues

**`fetch_single_row` with `extra_filters`:**

```python
filters = [f"{quote(field)}=eq.{quote(str(value), safe='')}"]
if extra_filters:
    filters.extend(extra_filters)
url = f"...?select=...&{'&'.join(filters)}"
```

The `extra_filters` values like `"is_active=eq.true"` and `"order=created_at.desc"` are passed as raw strings and joined directly into the URL. These are not user-supplied so injection risk is low, but the approach is fragile — `order` and `limit` are not filter parameters in PostgREST, they're separate query params. This works by accident because `&order=created_at.desc` is valid in the query string, but it will break if PostgREST ever tightens its parsing.

**`resolve_allowed_origin` falls back to first allowed origin** when the request origin doesn't match. This returns your own domain in the header for a cross-origin request, which is wrong — the browser will still block it. It should return `null` or omit the header for unrecognized origins. Current behaviour is cosmetically wrong but functionally safe since the browser enforces CORS on the client side.

**No request size limit.** A crafted request with a huge `applicationId` string could blow through the PostgREST query. Flask has no default body size limit set. Add `app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024` (1 MB) as a baseline.

---

## 7. `cma_cgm_writer.py` — Code Quality

The writer is 2001 lines and impressively complete. A few things to tighten:

**`write_preserving_style` is called hundreds of times with `horizontal_alignment=None`** but still copies and re-applies all style objects every call. For cells where the value is blank (missing data), this is wasted work but harmless.

**`clear_main_sheet_outputs` clears only cells in `FIELD_MAPPINGS`.** If a prior run wrote a value to a cell that is no longer in the mapping (e.g., after a mapping change), the old value persists in the template copy. Consider clearing all known output ranges explicitly rather than only iterating `FIELD_MAPPINGS`.

**`get_by_path` in the writer vs `get_by_path` in `app.py`** — identical function defined twice. Move it to a shared utility if the scripts live in the same package.

**The `marine_course:*` source paths** are resolved against a dict keyed by course name. Course names contain `&`, `/`, `:` characters (e.g., `"marine_course:ARPA/NCC:certificateNumber"`). The path splitter uses `:` as delimiter which means names with colons in them would need special handling. Currently none of the course names contain `:` so it works, but it is a latent bug.

---

## 8. `worksheetConfigService.js` — Upload Race Condition

In `uploadWorksheetTemplate`:

```js
// Step 1: upload to storage
await supabase.storage.from(TEMPLATE_BUCKET).upload(...)

// Step 2: deactivate old templates
await supabase.from('worksheet_templates').update({ is_active: false })...

// Step 3: insert new template as active
await supabase.from('worksheet_templates').insert({ is_active: true })
```

Between steps 2 and 3 there is a window where no template is active. If a recruiter triggers a worksheet generation at that exact moment, they get a "no active template" error. This is rare in practice but easy to avoid by wrapping the deactivate + insert in a Postgres transaction via an RPC function.

Also, `upsert` in `saveWorksheetMappings` uses `onConflict: 'customer_id,field_key'`. If `field_key` changes (e.g., a field is renamed in a mapping update), the old row is not deleted — it just accumulates. The mapping list will grow stale entries. Add a delete-then-insert or a cleanup step that removes rows not in the incoming payload.

---

## 9. `runtimeSettingsService.js` — Stale Cache

```js
let clientConfigPromise = null

export async function getClientRuntimeSettings(forceRefresh = false) {
  if (!clientConfigPromise || forceRefresh) {
    clientConfigPromise = invokeManageRuntimeSettings(...)
  }
  return clientConfigPromise
}
```

`clientConfigPromise` is module-level and is never cleared except via `forceRefresh`. If the `manage-runtime-settings` call fails (network error, cold start), the rejected promise is cached and every subsequent call gets the same rejection until the page reloads. Add a `.catch` to reset it:

```js
clientConfigPromise = invokeManageRuntimeSettings(...).catch(err => {
  clientConfigPromise = null  // allow retry on next call
  throw err
})
```

---

## 10. Render Deployment — What's Missing

The Dockerfile and service are production-ready for the generation path. What's currently not covered:

- **No health check in the Docker Compose / Render config.** The `/health` and `/ready` endpoints exist but are not wired to a restart policy. If the service crashes silently, generation requests get connection errors with no automatic recovery.
- **No `gunicorn` or production WSGI server.** `app.py` runs Flask's built-in dev server (`app.run()`). For production on Render, use `gunicorn -w 2 -b 0.0.0.0:8765 app:app`. Flask's dev server is single-threaded and not suited for concurrent requests.
- **`APP_URL` on Render is currently set to the dev/local origin** (noted in `docs/tasks.md`). Fix before go-live — the CORS check in `resolve_allowed_origin` will silently return the wrong origin for production requests.

---

## Summary Table

| Area | Severity | Action |
|---|---|---|
| Two parallel worksheet implementations | High | Deprecate the edge function fallback; commit to Flask/Render |
| macOS Numbers dependency in writer | High | Remove from writer; ensure normalize endpoint handles it server-side |
| Photos downloaded from public URL | Medium | Switch to authenticated storage API in both implementations |
| `create-recruiter` no caller auth check | Medium | Add `has_permission` check for caller |
| Flask running dev server in production | Medium | Switch to gunicorn |
| CORS wildcard on all edge functions | Low-Medium | Restrict to `APP_URL` via shared helper |
| `uploadWorksheetTemplate` race condition | Low | Wrap deactivate+insert in a DB transaction/RPC |
| `saveWorksheetMappings` stale rows | Low | Delete-then-insert or cleanup pass |
| `clientConfigPromise` caches rejections | Low | Reset promise on catch |
| `resolve_allowed_origin` fallback wrong | Low | Return null/omit header for unrecognized origin |
| `get_by_path` duplicated across files | Low | Extract to shared module |
| Flask no request size limit | Low | Add `MAX_CONTENT_LENGTH` |
