# Long form: data audit

Date: 2026-11-03 · Scope: is everything the applicant enters stored, and is it used correctly?

## How the form is stored

- All 19 sections are saved as one JSON document per application: `application_data.data`, keyed `section1` … `section19`. Autosave writes the whole section on every change (`src/hooks/useAutoSave.js`).
- The photo is a file in the `application-photos` bucket; its path is `section2.photoStoragePath`.
- `applications` holds only workflow columns (status, reference number, public token, applied rank, timestamps). No form field is copied into its own column or table.

## Result: is everything stored?

**Yes.** Every field each section collects is in its saved payload. The reload sync in each section lists the same fields as its initial state, so nothing is dropped when a draft is reopened.

| Section | Saved as |
|---|---|
| 1 Availability | flat fields |
| 2 Personal and contact | flat fields + `nextOfKin`, `emergencyContact`, phone code/number, photo path |
| 3 Passport, 4 CDC | flat fields |
| 5 Visas | `visas[]` |
| 6 Education | `education[]` |
| 7 Dependents | `dependents[]` |
| 8 Certificates of competency | `certificates[]` |
| 9 GMDSS | `gmdss[]` |
| 10 Medical and vaccinations | `medicalFitness`, `vaccinations` |
| 11 Medical history | `medicalHistory` (nested one level) |
| 12 Languages | `languages[]` |
| 13 Physical and uniform | flat fields |
| 14 Courses | `courses[]` |
| 15 Endorsements | `endorsements[]` |
| 16 Sea service | `seaService[]` |
| 17 Technical skills | flat fields (booleans + type/level text) |
| 18 References | `references[]`, `currentEmployer`, `objectionToContactLastEmployer` |
| 19 Declarations | flat fields |

## Problems found: stored but not shown, or read from the wrong place

| # | Problem | Effect | Status |
|---|---|---|---|
| 1 | Recruiter application view had no Dependents (s7) or Technical skills (s17) section | Recruiters could not see two sections the candidate filled in | Fixed |
| 2 | PDF export read `section17.skills`, which does not exist | PDF left out all technical skills | Fixed |
| 3 | Applications list built five fields from paths the form never writes: `section5.totalSeaService`, `section15.englishProficiency`, `section15.marlinsScore`, `section16.bmi`, `section16.bloodGroup` | Always empty; nothing used them | Removed |
| 4 | Worksheet field "Home Telephone Number" (Main C52) maps to `section2.homeTelephoneNumber`; the form has no such field | Cell is always blank | **Owner decision:** add the field to section 2, or remove the mapping |
| 5 | Edge Function `extract-document-expiries` reads paths that do not exist (`section3.passport`, `section3.seamanBook`, `section5.coc*`, `section10.medicalFirstAid`, …) and nothing calls it | Dead code; would extract nothing | Delete, or rewrite when expiry tracking is redone |
| 6 | Expiry page reads view `v_expiring_documents`, whose definition is not in the repo | Cannot confirm it reads the right paths | **Check:** run `select pg_get_viewdef('public.v_expiring_documents', true);` (read-only) |
| 7 | Legacy `generate-customer-worksheet` Edge Function also uses old paths | Already a 501 stub; no effect | Can be deleted later |

## Limits of the current storage

- Everything is one JSON document, so the database cannot query or report on form content directly (for example "all candidates with a GMDSS certificate expiring this quarter"). Today the app reads the JSON and computes in the browser.
- Certificates, courses, endorsements and sea service would need their own tables, or a maintained extract, for reliable expiry tracking, search and matching. This belongs with recruitment-case v1 and the expiry rework, not a separate project.
