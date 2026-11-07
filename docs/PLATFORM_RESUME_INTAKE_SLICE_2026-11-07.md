# Platform Resume Intake amendment — implementation and staging acceptance

**Implemented and staging qualified. Not promoted to production.**
KT authorized the full design §11 amendment, necessary schema changes and
synthetic smoke while unavailable for interactive login. Existing normal staging
sessions were reused. No password was requested, collected or changed.

Bases: Holmes `2c99634`, Needle `d20afe0a`. Isolated branches:
`codex/platform-resume-intake`, `codex/needle-platform-intake`. The shared root
checkout and separate `/Documents/Njord-ResumeForm` checkout remain untouched.
The latter supplied the agreed design and two patches as read-only references.

## Implemented

1. Reviewed company/ship IDs, searchable native selectors and a navigation tree;
   Draft/ship-pending requirements; exact required fields on opening; audited
   version-checked corrections after opening. Legacy names are not inferred.
   Both canonical case creation and historical attachment paths reject Draft,
   closed/cancelled, archived/deleted or unreviewed requirements.
2. All/Unattached/In Process candidate views use actual cases; company, ship,
   requirement and case-stage filters apply to the same case. Separate case
   cards show competing and accepted offers without auto-closing other cases.
   Drafts contribute no open positions/SLA clock; case hires use actual events.
3. Platform-owned private Drive originals/registry, immutable file references,
   versions, append-only extraction attempts and reviewed identity links.
   Byte hash is not person identity. Same-file reuse never overwrites a person;
   changed-file links retain confirmed fields and previous source history.
4. Private CPU basic extractor: embedded text first; local Tesseract on scans;
   all page markers and explicit page failures; bounded raster/text/runtime;
   versioned suggestions with value, heuristic confidence, evidence/page/method.
   No Gemini, hosted model, GPU or retraining. Original remains on extraction
   failure and manual completion/hold is available.
5. Role-checked platform upload/import and reviewed new/link/hold UI, including
   explicit review before adding a version to an existing candidate. Phone-only
   draft leads stay outside prospects; conversion requires a reviewed résumé.
6. Shared-registry lookup of existing Needle source references before a new
   platform Drive write. The lookup is signed, scoped, metadata-only and private.
   Unknown/foreign hashes are indistinguishable. Lookup failure is explicit.
7. `resume.registered` outbox commits only after new/link review, independently
   retries delivery, and explicitly queues existing hashes. Hold creates no
   candidate/case/new event. Needle only reuses current approved facts; otherwise
   the job waits for the separately gated extractor. Its upload endpoint is 410;
   active repository grouping is exact-document only, with accurate résumé labels.

## Verification performed

- **Holmes:** lint/build; 48 focused/adjacent Node tests; intake, legacy bridge,
  operator-account and expiry handler checks; actual ordered SQL behavior in
  PGlite; **17 Python intake tests**; both new Function entrypoints pass Deno
  type-check. Existing bundle-size/caniuse notices remain build warnings.
- **Needle:** **167 focused/adjacent Python tests**, repository/embedding
  frontend tests and hosted build. SQL event harness checks existing-hash queue,
  event/logical replay, conflicting identity denial, immutable original mapping
  and denied browser access. No broad root backend collection was needed.
- **Real CPU container:** final built image parsed native text, ran Tesseract on
  a synthetic scan, ran ClamAV and checked modern secret-key header behavior,
  with network disabled. Separately, official ClamAV signatures allowed a clean
  PDF and rejected the inert EICAR qualification string.
- **Staging schema:** Holmes 0609–0616 applied with project guards, a fresh full
  dump/scratch payload count verification, and candidate/case count guards.
  Source SHA-256 values and read-back receipts are private. All 95 table COPY
  payloads / 800 pre-amendment rows restored and matched; managed full public
  DDL restore was not claimed. SQL behavior uses the isolated actual migrations.
- **Normal Master browser:** save incomplete Draft; register company/ship;
  open after reviewed fields; Match resumes completes through the real bridge
  and synthetic Needle search; native two-page import; hold creates no person;
  held item appears in intake queue; review saves a minimal candidate and case;
  company/ship/case filter shows the right single candidate.
- **Actual Drive/OCR:** a dedicated private synthetic-only Drive folder; a real
  scanned two-page PDF upload; Tesseract evidence on both pages; original retained;
  explicit append-only extraction retry; oversized scan rejected by the 10 MiB
  client limit. Generated source PDFs, originals, evidence and IDs stay ignored.
- **Shared identity/queue:** phone-only draft leaves candidate counts unchanged;
  upload resolves an existing corpus original without another Drive write;
  read-back proves no candidate binding or event before review. Review converts
  the draft into one unattached candidate and commits one event; the actual
  dispatcher delivers that event to the isolated Needle consumer. Separate SQL
  checks prove changed-file history, retained fields and immutable attempts.
- **Normal Coordinator:** private registry/identity queue, company creation,
  résumé preparation, matching, identity review, case opening and draft-lead creation all denied; private
  draft-lead reads return no rows through the authenticated server paths. No admin-generated user session.

## Evidence and limits

Private receipts/screenshots are under ignored
`.local/holmes-integration/operator-pilot-20261105/`, including:
`platform-review-before.private.json`, `platform-review-after.private.json`,
`platform-intake-*-staging.private.json`, `platform-scanner-qualification.private.json`,
and the platform queue/scanned/filter screenshots. Backup SHA-256 is private.

There is no staging Needle deployment/database. Joint browser qualification
uses real Holmes staging Auth/RLS/registry and private Drive, with a loopback
Functions adapter and synthetic Needle corpus/consumer. It proves no production
model/extractor behavior, deployed Edge CORS, published service placement or
production Vercel forwarding. Original-byte read-back is hash verified; browser
blob rendering has the previously recorded browser-policy/manual boundary.
The existing CLI browser suite was not used; CUA checks are the browser evidence.

The earlier independent review covers the parent candidates, not these new
amendment commits. The amended exact source still needs the consolidated
production-promotion review. There was no new delegation in this CPU slice.

## Handover

Use `PLATFORM_RESUME_INTAKE_RELEASE_2026-11-07.md`. Keep automatic Drive intake off
and AI operator-only. KT reviews the frozen amended commits, provisions the
production service/Drive connection/dispatcher, maps legacy open requirements
explicitly and owns promotion. No new paid service, production write, key grant,
GPU/model call, broad résumé backfill or intake reopening occurred here.
