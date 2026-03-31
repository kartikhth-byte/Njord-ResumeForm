# NjordHR Advanced Search - Testing Checklist

**Version:** 1.1  
**Updated:** March 18, 2026  
**Purpose:** Manual verification before UI redesign  
**Status:** Historical manual checklist; see notes below  

> Current status note: this checklist reflects the advanced-search validation goals, but the repo now also has a passing Playwright smoke suite (`npm run test:smoke` => **29 passed** during the current phase). Use this file for deeper manual search validation, not as the only current test-status reference.

### Automated Baseline

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
npm run lint
npm run build
npm run test:smoke
```

For applicant protected-flow smoke, refresh the stored Google session when needed:

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
npm run test:auth:applicant
```

---

## Overview

This checklist verifies the current `main` implementation after the advanced-search fixes. It reflects the actual repo schema and current behavior.

**Critical:** Tests marked with `CRITICAL` are blocking for UI redesign.

---

## AI Search Testing

### 1. Schema Verification `CRITICAL`

**Purpose:** Verify AI search uses the correct application schema.

**Test Steps**
1. Open recruiter Advanced Search.
2. Search for `Chief Officer with tanker experience`.
3. Inspect console/network payloads for search/LLM calls.

**Expected Data Extraction**
- `section1.appliedForRank`
- `section1.availableFrom`
- `section1.vesselType`
- `section8.certificates`
- `section14` training/certificate records
- `section15.endorsements`
- `section16.seaService`

**Pass Criteria**
- [ ] All 7 data sources are used from the correct sections
- [ ] No schema-related runtime errors
- [ ] Candidate context sent to LLM is complete
- [ ] Confidence scores are not uniformly low due to missing data

### 2. Multi-Recruiter localStorage Isolation `CRITICAL`

**Test Steps**
1. Log in as Recruiter A.
2. Run AI search: `Chief Officer`.
3. Confirm results appear.
4. Log out.
5. Log in as Recruiter B on the same browser.
6. Open Advanced Search.

**Expected**
- [ ] Recruiter B does not see Recruiter A's saved results
- [ ] Search restore is isolated per user
- [ ] localStorage key includes the recruiter ID

**Pass Criteria**
- [ ] Complete data isolation between recruiter sessions
- [ ] localStorage format is `aiSearchResults:{userId}`

### 3. Manual Filter State Consistency `CRITICAL`

**Test Steps**
1. Open Advanced Search.
2. Switch to `Manual Search`.
3. Select `Active` plus `Chief Officer`.
4. Click `Apply Filters`.

**Expected**
- [ ] Table shows only matching candidates
- [ ] Result count matches rendered rows
- [ ] No stale data from previous tab/search state

**Pass Criteria**
- [ ] Filtered table renders the applied dataset correctly

### 4. Certificate Filter Property `CRITICAL`

**Test Steps**
1. In Manual Filters, choose `Master` in the certificate filter.
2. Apply filters.
3. Inspect at least one returned candidate record.

**Expected**
- [ ] Matching certificate comes from `section8.certificates`
- [ ] Filter is comparing against `cert.grade`
- [ ] Non-matching candidates are excluded

**Pass Criteria**
- [ ] Certificate filtering is based on `cert.grade`

### 5. Visa Filter Property `CRITICAL`

**Test Steps**
1. In Manual Filters, select a visa type actually present in your data, for example `C1/D (USA)` or `Schengen`.
2. Apply filters.
3. Inspect returned candidates.

**Expected**
- [ ] Matching visa comes from `section5.visas`
- [ ] Filter is comparing against `visa.type`
- [ ] Non-matching candidates are excluded

**Pass Criteria**
- [ ] Visa filtering is based on `visa.type`

### 6. Tab Navigation No Hijacking

**Test Steps**
1. Run an AI search so results are saved.
2. Switch to `All Applications`.
3. Switch to `Pipeline`.
4. Return to `Advanced Search`.

**Expected**
- [ ] Results still restore when appropriate
- [ ] The app does not force the user back to Search after changing tabs

**Pass Criteria**
- [ ] No tab hijacking

### 7. Pagination Reset on New Search

**Test Steps**
1. Run an AI search with enough results for multiple pages.
2. Go to page 2 or 3.
3. Run a different AI search.

**Expected**
- [ ] New search starts on page 1
- [ ] The table is not blank due to stale pagination state

**Pass Criteria**
- [ ] Pagination resets correctly for every new AI search

---

## Search UX and Result Quality

### 8. Vector Similarity Search

**Suggested Queries**
- `Chief Officer with 10 years experience`
- `C1/D visa`
- `excellent communication skills`

**For Each**
- [ ] Results return promptly
- [ ] Relevance scores display
- [ ] Top results are meaningfully related to the query

### 9. LLM Analysis and Confidence Scoring

**Test**
1. Run AI search.
2. Wait for enrichment to complete.

**Check**
- [ ] Progress banner appears during enrichment
- [ ] Confidence badges replace interim loading state
- [ ] Confidence percentages look plausible

### 10. Confidence Badge UX

- [ ] Compact badge opens reasoning details
- [ ] Reasoning is readable and not clipped
- [ ] Close behavior works as expected

### 11. Filter Combinations

**Suggested combinations**
- [ ] Active + Chief Officer + Tanker
- [ ] Hired + Master + Container
- [ ] Panama endorsement + Master

### 12. Data Persistence

- [ ] Navigating away and back preserves recruiter's own saved AI search
- [ ] Page refresh restores recruiter's own saved search
- [ ] Expired saved search is cleared after 30 minutes
- [ ] Clear Search removes saved results

### 13. Flag State Filter

- [ ] Panama filter works
- [ ] Matching data comes from `section15.endorsements`

---

## Error and Edge Cases

### 14. Empty Results

- [ ] Empty-state behavior is clear
- [ ] No console errors

### 15. Network or API Errors

- [ ] Errors are surfaced gracefully
- [ ] No full-page crash

### 16. Large Result Sets

- [ ] Pagination works across large result sets

---

## Cross-Browser

### 17. Browser Compatibility

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Final Checks

### 18. Console Clean

- [ ] No red runtime errors
- [ ] No unexpected warnings in tested flows

### 19. Build Verification

```bash
npm run lint
npm run build
```

- [ ] Lint passes
- [ ] Build succeeds

---

## Sign-Off

**Critical Tests**
1. [ ] Schema Verification
2. [ ] Multi-Recruiter Isolation
3. [ ] Manual Filter State
4. [ ] Certificate Filter
5. [ ] Visa Filter

**Recommendation**
- [ ] Proceed with UI redesign
- [ ] Proceed with caution
- [ ] Do not proceed

**Tester:** __________________  
**Date:** __________________  

**Issues Found**
- None / List issues
