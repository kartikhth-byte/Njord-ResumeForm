# Advanced Search - Post-Redesign Smoke Testing Checklist

**Version:** 1.1  
**Created:** March 15, 2026  
**Updated:** March 18, 2026 (Automated smoke status and setup notes updated)  
**Purpose:** Verify core functionality after UI redesign  
**Time Required:** 45-60 minutes (20 min for critical tests only)  
**Prerequisites:** Local dev environment running with test database, OAuth configured  

> Current status note: the Playwright smoke suite is now implemented and passing locally with **29 passed**. This checklist remains useful for targeted manual verification and production-readiness checks that are not fully covered by automation.

### Automated Smoke Reference

Run:

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
npm run test:smoke
```

Applicant protected-flow smoke requires a valid stored Google session. Refresh it when needed:

```bash
cd /Users/kartikraghavan/Documents/Njord-ResumeForm
npm run test:auth:applicant
```

Recruiter authenticated smoke depends on valid credentials in:
- `.env.playwright`

---

## ⚠️ CRITICAL PREREQUISITES - READ FIRST

### **OAuth Configuration Must Be Complete**

**Before starting any tests, verify OAuth is working:**

1. **Google Cloud Console Settings:**
   - ✅ `https://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback` in redirect URIs
   - ✅ `http://localhost:3000` in JavaScript origins
   - ✅ `http://localhost:3000/auth/callback` in redirect URIs

2. **Supabase Client Config:**
   - ✅ `detectSessionInUrl: true` in `src/lib/supabase.js`

3. **Dev Server Port:**
   - ✅ Running on port 3000 (not 5173)
   - Verify: `npm run dev` should show `http://localhost:3000/`

4. **Test OAuth Login:**
   ```bash
   # 1. Open: http://localhost:3000
   # 2. Click "Sign in with Google"
   # 3. Should redirect to Google
   # 4. Should return and login successfully
   # 5. If fails → See TROUBLESHOOTING-OAUTH.md
   ```

**If OAuth doesn't work, STOP HERE and fix it first.**

**Reference:** See `TROUBLESHOOTING-OAUTH.md` for detailed configuration guide.

---

## 📋 OVERVIEW

This checklist verifies that the Advanced Search redesign hasn't broken critical functionality. Tests are prioritized by severity.

**Testing Strategy:**
1. Start with CRITICAL tests (🔴) - If ANY fail, STOP and fix before proceeding
2. Continue with IMPORTANT tests (🟡) - Should pass but won't block deployment
3. Complete NICE TO HAVE tests (🟢) if time permits

**Environment Setup:**
```bash
# Start dev server
npm run dev

# Should show: http://localhost:3000/ (NOT 5173)
# Open browser to: http://localhost:3000
# Login as recruiter with recruiter email/password
# Navigate to: Advanced Search tab
```

---

## 🔴 CRITICAL TESTS (BLOCKING)

**If ANY of these fail, DO NOT deploy to production.**

---

### TEST 1: AI Search Basic Flow (5 min)

**Purpose:** Verify core AI search executes and returns results

**Prerequisites:**
- At least 5 applications in database
- Embeddings generated (check /recruiter/setup)

**Steps:**
1. Navigate to Advanced Search tab
2. Click "AI Search" sub-tab (should be default)
3. Enter search query: `"Chief Officer with tanker experience"`
4. Click Search button (or press Enter)
5. Wait for results to load

**Expected Results:**
- [ ] Search button shows loading state
- [ ] Results table appears within 2-3 seconds
- [ ] At least 1 result displays
- [ ] Each result shows:
  - Reference number
  - Name
  - Position
  - Status badge
  - **Relevance** percentage (e.g., "87%")
  - **AI Match** column (initially loading spinner)
- [ ] No console errors (check DevTools)

**If Fails:**
- Check console for errors
- Verify embeddingService.js is loaded
- Check network tab for failed API calls
- **STOP TESTING - Fix before proceeding**

---

### TEST 2: LLM Analysis & Confidence Badges (5 min)

**Purpose:** Verify AI reasoning and confidence scoring works

**Prerequisites:** Complete TEST 1 first

**Steps:**
1. After search completes, watch AI Match column
2. Progress banner should appear: "Analyzing X of Y applications"
3. Wait for analysis to complete (~5-10 seconds)

**Expected Results:**
- [ ] Progress banner displays with correct counts
- [ ] Loading spinners in AI Match column
- [ ] Spinners replaced with confidence badges:
  - 🟢 Green badge = High confidence (85%+)
  - 🟡 Yellow badge = Medium confidence (60-84%)
  - 🔴 Red badge = Low confidence (<60%)
- [ ] Percentages display correctly (e.g., "78%", not "NaN%")
- [ ] At least one badge appears (not all blank)
- [ ] No console errors

**Confidence Badge Interaction Test:**
1. Click any confidence badge
2. Inline panel should expand

**Expected:**
- [ ] Panel expands smoothly below badge
- [ ] Shows full reasoning text
- [ ] Reasoning is relevant to search query
- [ ] Click again to collapse panel
- [ ] Panel closes properly

**If Fails:**
- Check Gemini API key is configured
- Verify embeddingService.js LLM call
- Check console for API errors
- **STOP TESTING - Fix before proceeding**

---

### TEST 3: localStorage Persistence (5 min)

**Purpose:** Verify results persist across navigation and are scoped per user

**Part A: Basic Persistence**

**Steps:**
1. Complete TEST 1 (perform AI search)
2. Note the number of results
3. Navigate to Dashboard (click Dashboard in sidebar)
4. Navigate back to Advanced Search

**Expected Results:**
- [ ] Search results automatically restore
- [ ] Same number of results as before
- [ ] Search query text restored in search box
- [ ] Confidence badges still visible
- [ ] No need to re-run search
- [ ] Check localStorage in DevTools:
  - Key should be: `aiSearchResults:{userId}` (colon, not underscore)
  - Value should contain results array

**If Fails:**
- Check localStorage key format
- Verify restore effect in RecruiterApplications.jsx
- **STOP TESTING - Fix before proceeding**

---

**Part B: Multi-Recruiter Isolation**

**Steps:**
1. Note current user's email/name
2. Note the search results displayed
3. Logout (click profile → Logout)
4. Login as a DIFFERENT recruiter
5. Navigate to Advanced Search

**Expected Results:**
- [ ] Advanced Search shows EMPTY state (no results)
- [ ] No auto-restore of previous recruiter's search
- [ ] localStorage check in DevTools shows:
  - Key for previous user: `aiSearchResults:user1`
  - Key for current user: `aiSearchResults:user2` (different or non-existent)
- [ ] No data leakage between users

**If Fails:**
- Check localStorage key includes user ID
- Verify restore checks user ID
- **CRITICAL SECURITY ISSUE - Fix immediately**

---

### TEST 4: Manual Filter State Consistency (5 min)

**Purpose:** Verify manual filters actually filter the table correctly

**Steps:**
1. Click "Manual Search" sub-tab
2. Select filter: **Status** → "Active" (status pill at top)
3. Select filter: **Rank** → "Chief Officer"
4. Click "Apply Filters" button
5. Check table results

**Expected Results:**
- [ ] Table updates with filtered results
- [ ] All visible results show:
  - Status badge = "Active" (green)
  - Position column = "Chief Officer"
- [ ] Result count matches visible rows
- [ ] No stale data from previous searches
- [ ] No console errors

**Verify State Consistency:**
1. Check a few random results in detail
2. Each should actually be "Active" status
3. Each should actually be "Chief Officer" rank

**If Fails:**
- Check filter logic in RecruiterApplications.jsx
- Verify table renders from correct state slice
- **STOP TESTING - February 2026 fix regressed**

---

### TEST 5: Certificate Filter Property (3 min)

**Purpose:** Verify certificate filter uses correct property (February 2026 fix)

**Prerequisites:** Database has applications with certificates in section8

**Steps:**
1. In Manual Search mode
2. Select: **Certificate** → "Master" (or any available certificate grade)
3. Click "Apply Filters"
4. Check DevTools Console for filter logic (optional)
5. Inspect first result's data

**Expected Results:**
- [ ] Results filtered successfully
- [ ] All results have matching certificate in section8
- [ ] Filter compares against `cert.grade` property
- [ ] No results without the selected certificate

**Verification Method:**
1. Click "View" on first result
2. Navigate to application details
3. Check certificates section
4. Verify selected grade is present

**If Fails:**
- Check filter uses `cert.grade` not other property
- Verify data structure in section8.certificates
- **February 2026 fix regressed - STOP and fix**

---

### TEST 6: Visa Filter Property (3 min)

**Purpose:** Verify visa filter uses correct property (February 2026 fix)

**Prerequisites:** Database has applications with visas

**Steps:**
1. In Manual Search mode
2. Select: **Visa Type** → "C1/D (USA)" or "Schengen" (use realistic value)
3. Click "Apply Filters"
4. Inspect results

**Expected Results:**
- [ ] Results filtered successfully
- [ ] All results have matching visa type
- [ ] Filter compares against `visa.type` property
- [ ] No results without selected visa

**Verification Method:**
1. Click "View" on first result
2. Check visa section
3. Verify selected visa type is present

**If Fails:**
- Check filter uses `visa.type` property
- Verify data structure
- **February 2026 fix regressed - STOP and fix**

---

### TEST 7: Flag State Filter (3 min)

**Purpose:** Verify flag state filter uses correct endorsements array

**Prerequisites:** Database has applications with endorsements in section15

**Steps:**
1. In Manual Search mode
2. Select: **Flag State** → "Panama" (or any available flag state)
3. Click "Apply Filters"
4. Inspect results

**Expected Results:**
- [ ] Results filtered successfully
- [ ] All results have matching endorsement
- [ ] Filter searches in `section15.endorsements` array
- [ ] Uses `endorsement.flagState` property

**If Fails:**
- Check filter uses endorsements array from section15
- **February 2026 fix may have regressed**

---

### TEST 8: Pagination Reset on New Search (3 min)

**Purpose:** Verify pagination resets to page 1 on new search

**Prerequisites:** Database has 30+ applications for pagination

**Steps:**
1. Switch to AI Search mode
2. Perform search that returns 20+ results
3. Navigate to **Page 2** or **Page 3** using pagination controls
4. Perform a NEW search (different query)
5. Check page indicator

**Expected Results:**
- [ ] New search results start on **Page 1**
- [ ] Page indicator shows "1"
- [ ] Not stuck on previous page number
- [ ] No blank results due to wrong page

**If Fails:**
- Check `setCurrentPage(1)` in search handler
- **February 2026 fix regressed**

---

## 🔴 CRITICAL TESTS SUMMARY

**Total: 8 tests, ~35 minutes**

**All 8 must PASS before proceeding to production.**

**Checkpoint:**
- [ ] All 8 critical tests passed
- [ ] No console errors
- [ ] No data corruption
- [ ] No security issues (multi-user isolation)

**If any failed:** STOP, fix issues, re-run all critical tests.

---

## 🟡 IMPORTANT TESTS (Non-Blocking)

**These should work but won't prevent deployment if they fail.**

---

### TEST 9: All 10 Manual Filter Types (10 min)

**Purpose:** Verify each filter works independently

**Test each filter:**

1. **Rank** → Select "Master"
   - [ ] Filters correctly
   
2. **Vessel Type** → Select "Tanker"
   - [ ] Filters correctly
   
3. **Nationality** → Select "Philippines"
   - [ ] Filters correctly
   
4. **Experience** → Enter "5" years
   - [ ] Filters correctly
   
5. **Certificate** → Already tested in TEST 5
   - [x] Filters correctly
   
6. **Visa** → Already tested in TEST 6
   - [x] Filters correctly
   
7. **Flag State** → Already tested in TEST 7
   - [x] Filters correctly
   
8. **Availability** → Select date range
   - [ ] Filters correctly
   
9. **Age Range** → Enter 25-45
   - [ ] Filters correctly
   
10. **Date Range** → Select submission date range
    - [ ] Filters correctly

**Pass Criteria:** 8/10 or better (Certificate, Visa, Flag State already verified)

---

### TEST 10: Sub-Tab Navigation (3 min)

**Purpose:** Verify switching between AI/Manual Search works

**Steps:**
1. Perform AI search (in AI Search mode)
2. Click "Manual Search" sub-tab
3. Apply some manual filters
4. Click back to "AI Search" sub-tab
5. Repeat switching 2-3 times

**Expected Results:**
- [ ] AI Search results persist when switching away
- [ ] Manual Search filters persist when switching away
- [ ] Each mode maintains independent state
- [ ] No data loss during switches
- [ ] No console errors
- [ ] Smooth transition (no flashing)

---

### TEST 11: Progress Banner During Analysis (2 min)

**Purpose:** Verify progress indicator shows during LLM analysis

**Steps:**
1. Perform AI search with 5+ results
2. Watch for progress banner immediately after results load

**Expected Results:**
- [ ] Banner appears: "Analyzing X of Y applications"
- [ ] Count is accurate (e.g., "Analyzing 5 of 10")
- [ ] Updates as analysis progresses
- [ ] Disappears when complete
- [ ] No UI blocking (can still scroll table)

---

### TEST 12: Empty State Handling (2 min)

**Purpose:** Verify proper handling when no results found

**Steps:**
1. AI Search mode
2. Search for nonsense: `"asdfasdfasdf12345"`
3. Check UI response

**Expected Results:**
- [ ] "No results found" message displays
- [ ] No error messages
- [ ] No blank screen
- [ ] Can perform new search
- [ ] No console errors

---

### TEST 13: Sort Functionality (3 min)

**Purpose:** Verify sort by Relevance and Confidence works

**Prerequisites:** AI search with mixed confidence scores

**Steps:**
1. Perform AI search
2. Wait for confidence analysis
3. Check current sort (should be Relevance by default)
4. Click "Confidence" sort button
5. Observe table reorder
6. Click "Relevance" sort button

**Expected Results:**
- [ ] Default sort is by Relevance (highest %)
- [ ] Click "Confidence" → Results reorder by confidence score
- [ ] Highest confidence at top
- [ ] Click "Relevance" → Results reorder back
- [ ] Active sort button highlighted

---

### TEST 14: Clear Search (2 min)

**Purpose:** Verify clear button removes results and storage

**Steps:**
1. Perform AI search
2. Verify results display
3. Click "Clear Search" button
4. Check DevTools → localStorage

**Expected Results:**
- [ ] Results table clears
- [ ] Search query box clears
- [ ] localStorage key removed (`aiSearchResults:{userId}`)
- [ ] Empty state displays
- [ ] Ready for new search

---

### TEST 15: Filter Combinations (3 min)

**Purpose:** Verify multiple filters work together

**Steps:**
1. Manual Search mode
2. Apply 3+ filters simultaneously:
   - Status: Active
   - Rank: Chief Officer
   - Vessel Type: Tanker
3. Click Apply Filters

**Expected Results:**
- [ ] Results match ALL criteria (AND logic)
- [ ] No false positives (candidates that don't match all)
- [ ] Result count accurate

---

### TEST 16: Confidence Filter Dropdown (3 min)

**Purpose:** Verify filtering by confidence level

**Prerequisites:** AI search with mixed confidence scores

**Steps:**
1. Perform AI search, wait for confidence analysis
2. Select confidence filter: "High (85%+)"
3. Check table results
4. Select "Medium (60-84%)"
5. Select "Low (<60%)"
6. Select "All Levels"

**Expected Results:**
- [ ] High: Only green badges visible
- [ ] Medium: Only yellow badges visible
- [ ] Low: Only red badges visible
- [ ] All: All badges visible
- [ ] Result count updates correctly
- [ ] Stats update (🟢 X 🟡 Y 🔴 Z)

---

## 🟡 IMPORTANT TESTS SUMMARY

**Total: 8 additional tests, ~30 minutes**

**Pass Criteria:** 6/8 or better

---

## 🟢 NICE TO HAVE TESTS

**Test if time permits, not required for deployment.**

---

### TEST 17: Build & Lint (2 min)

**Steps:**
```bash
npm run lint
npm run build
```

**Expected Results:**
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] No warnings (or only acceptable warnings)

---

### TEST 18: Mobile Responsive (5 min)

**Steps:**
1. Open DevTools
2. Switch to mobile view (iPhone 12 Pro)
3. Navigate to Advanced Search
4. Try basic AI search

**Expected Results:**
- [ ] UI doesn't break
- [ ] Can perform search
- [ ] Results display (even if cramped)
- [ ] Basic functionality works

---

### TEST 19: Cross-Browser (10 min)

**Test in:**
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

**Basic smoke test in each:**
- [ ] Can perform AI search
- [ ] Confidence badges appear
- [ ] Manual filters work
- [ ] No major visual bugs

---

### TEST 20: Performance with Large Results (5 min)

**Steps:**
1. Perform search returning 100+ results
2. Navigate through pages
3. Apply filters
4. Sort results

**Expected Results:**
- [ ] No significant lag
- [ ] Pagination smooth
- [ ] Filtering responsive
- [ ] No browser freezing

---

## 📊 TEST RESULTS TEMPLATE

**Copy and fill out after testing:**

```
=== ADVANCED SEARCH POST-REDESIGN SMOKE TEST RESULTS ===

Date: __________
Tester: __________
Environment: Local / Staging / Production
Browser: Chrome / Firefox / Safari / Edge
Database: Test / Staging / Production

=== CRITICAL TESTS (8) ===
[ ] 1. AI Search Basic Flow - PASS / FAIL
    Notes: ___________________________________

[ ] 2. LLM Analysis & Badges - PASS / FAIL
    Notes: ___________________________________

[ ] 3. localStorage Persistence - PASS / FAIL
    Part A (Basic): ___________________________
    Part B (Multi-User): _____________________

[ ] 4. Manual Filter State - PASS / FAIL
    Notes: ___________________________________

[ ] 5. Certificate Filter - PASS / FAIL
    Notes: ___________________________________

[ ] 6. Visa Filter - PASS / FAIL
    Notes: ___________________________________

[ ] 7. Flag State Filter - PASS / FAIL
    Notes: ___________________________________

[ ] 8. Pagination Reset - PASS / FAIL
    Notes: ___________________________________

CRITICAL TESTS: ___/8 passed

=== IMPORTANT TESTS (8) ===
[ ] 9. All 10 Filter Types - ___/10 passed
[ ] 10. Sub-Tab Navigation - PASS / FAIL
[ ] 11. Progress Banner - PASS / FAIL
[ ] 12. Empty State - PASS / FAIL
[ ] 13. Sort Functionality - PASS / FAIL
[ ] 14. Clear Search - PASS / FAIL
[ ] 15. Filter Combinations - PASS / FAIL
[ ] 16. Confidence Filter - PASS / FAIL

IMPORTANT TESTS: ___/8 passed

=== NICE TO HAVE TESTS ===
[ ] 17. Build & Lint - PASS / FAIL
[ ] 18. Mobile Responsive - PASS / FAIL
[ ] 19. Cross-Browser - PASS / FAIL
[ ] 20. Performance - PASS / FAIL

=== ISSUES FOUND ===
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

=== CONSOLE ERRORS ===
(Copy any critical errors from browser console)

=== OVERALL ASSESSMENT ===
[ ] ✅ READY FOR PRODUCTION
    - All 8 critical tests passed
    - 6+ important tests passed
    - No blocking issues

[ ] ⚠️ PROCEED WITH CAUTION
    - All critical tests passed
    - Some important tests failed (non-blocking)
    - Minor issues documented

[ ] ❌ DO NOT DEPLOY
    - 1+ critical test failed
    - Blocking issues present
    - Requires fixes before deployment

=== NEXT STEPS ===
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

Tester Signature: _________________ Date: _______
```

---

## 🎯 QUICK START GUIDE

**Minimum Viable Test (20 minutes):**
Run CRITICAL TESTS ONLY (Tests 1-8)
- If all pass → Can proceed with confidence
- If any fail → Stop and fix

**Recommended Test (50 minutes):**
Run CRITICAL + IMPORTANT TESTS (Tests 1-16)
- Comprehensive coverage
- Catches most issues

**Full Test (90 minutes):**
Run ALL TESTS (Tests 1-20)
- Maximum confidence
- Pre-production best practice

---

## ⚠️ CRITICAL REMINDERS

1. **START WITH CRITICAL TESTS** - If any fail, stop immediately
2. **DOCUMENT EVERYTHING** - Use test results template
3. **CHECK CONSOLE** - Note any errors or warnings
4. **TEST MULTI-USER** - Security critical (Test 3B)
5. **VERIFY SCHEMA FIELDS** - February 2026 fixes must stay (Tests 5-7)

---

## 🔗 RELATED DOCUMENTATION

- [FEATURE-STATUS-POST-REDESIGN.md](./FEATURE-STATUS-POST-REDESIGN.md) - Feature inventory
- [UI-REDESIGN-DECISIONS.md](./UI-REDESIGN-DECISIONS.md) - Design rationale
- [NJORD-ADVANCED-SEARCH-PRD.md](./NJORD-ADVANCED-SEARCH-PRD.md) - Original requirements
- [COMPLETED-FEATURES.md](./COMPLETED-FEATURES.md) - Pre-redesign features

---

**END OF SMOKE TESTING CHECKLIST**

**Remember:** This is smoke testing, not comprehensive QA. It verifies core functionality hasn't broken. Full feature testing should follow if deploying to production.
