# B — Recruiter Applications area

Scope: `/recruiter/applications` (All tab, Search tab with AI and Manual modes), the recruiter view of `/application/view/:publicToken`, the status control and every modal it opens, StatusBadge. Paths are relative to `src/`.

Main pattern: status can be changed from 5+ places (row control, detail control, "Skip to", Decline, three separate reject flows, Reopen). Each place writes different columns and sends different emails. Several detail-page paths are broken outright. Most of this pipeline (test, interview, offer, documents, hired) is what recruitment case v1 will take over.

---

## Applications list, All tab (`/recruiter/applications`, pages/RecruiterApplications.jsx)

Verdict: SIMPLIFY. The list is useful, but the stage chips hide closed records, and the 12-column table carries a full status control in every row.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Final Stage" sub-chips "Hired", "Rejected", "Withdrawn" | RecruiterApplications.jsx:311-320, 467-492, 627-667 | The counts include every status, but the list only loads active statuses. Hired and Withdrawn always show an empty list, and Rejected does too unless the checkbox is on. The chip number and the list disagree. | SIMPLIFY: replace them with one "Closed" chip that loads hired, rejected and withdrawn itself | S | med |
| "All" chip count vs "N applications found" | :1134, :1203-1205 | "All" counts closed records, but the list doesn't show them, so the two numbers never match. | SIMPLIFY: count only what the list can show | S | low |
| Missing stages: `test_passed`, `offer_accepted`, `documents_pending` | :281-321 | These are real flow stages (SequentialStatusControl.jsx:102-113) but no chip covers them. They only appear under "All". | MERGE: into the Test and Offer chips | S | low |
| "Test Completed" sub-chip | :298 | `test_completed` isn't in the status flow, so nothing moves an application there. It is always 0. | REMOVE | S | low |
| Chip group names "Initial Stage" / "Final Stage" | :284, :312 | Wordy. "Final Stage" mixes Offered with closed outcomes. | RENAME: "New", "Offer", "Closed" | S | low |
| "(Rejected candidates hidden)" / "(Rejected candidates included)" text | :1211-1213 | Repeats what the checkbox already shows. | REMOVE | S | low |
| "Include Rejected Candidates" checkbox | :1216-1227 | Duplicates the Rejected chip. It shares state with the Manual Search scope, so toggling one changes the other. | REMOVE (the "Closed" chip replaces it) | S | low |
| Red/Amber/Green rollup badges | :1206-1210, :63-81 | They look like buttons but can't be clicked. A separate dropdown does the filtering. | MERGE: make the badges the filter and drop the dropdown (:1241-1252) | S | low |
| "All compliance" dropdown | :1241-1252 | Duplicates the badges above and the Compliance filter in Manual Search. | REMOVE (after merging into the badges) | S | low |
| Local `ComplianceBadge` | :63-81 | This is a third compliance badge, alongside `ComplianceStatusPill` (ApplicationCompliancePanel.jsx:20-32). `COMPLIANCE_TONES` (constants/statusTones.js:26) is not used. | MERGE: one shared badge | S | low |
| Row status control (SequentialStatusControl + "Handled by" select + kebab menu) | :1056-1065 | The same control is on the detail page, so every row is a second place to change status. It makes the table very wide. Its test and interview modals are the flow the case will replace. | REMOVE from rows; keep it on the detail page only | S | med |
| Eye "View application" button | :1066-1072 | Duplicates the Name link (:1009-1016). | REMOVE | S | low |
| "Contract ends" date input | :1073-1083 | It only shows for hired applications, which the All tab never loads, so it is only reachable via Manual Search > Archived. It feeds a KPI alert. | MOVE to the detail page (hired state) | S | med |
| Email and Phone columns | :979-980, :1020-1023 | Contact details belong on the detail page. Removing them shortens a 12-column table. | REMOVE | S | low |
| "Present rank" column | :981, :552 | It reads `seaService[0]`, which may not be the latest vessel. The label overclaims. | RENAME: "Last rank" (or sort sea service first) | S | low |
| Relevance and AI match columns on the All tab | :1258, :1032-1037 | `showRelevance={aiSearchActive}` shows them on normal rows that have no `similarity`, which renders "NaN%". | REMOVE: show them on AI results only | S | low |
| List while an AI search is held | :331-335, :365-396 | Likely bug: `filterApplications` is skipped while `aiSearchActive`, so the All tab can render empty for up to 30 minutes after an AI search. Verify in a browser. | SIMPLIFY: don't tie the All list to AI state | S | med |
| Teams OAuth reopen effect | :143-168 | It only reopens the interview modal if the application is in the currently loaded list rows. It goes away once status controls leave the rows. | REMOVE (along with the row controls) | S | low |
| Dead code: `OfferModal` import and state, `activeStatusScopes`, `toggleStatusScope`, `getStatusCounts` wrapper | :15, :185-186, :912-917, :935-944, :695-698 | Never rendered or called. | REMOVE | S | low |

Checked and kept: the "Applications" title, the "Syncing updates" pill, the search box ("Search by name, email, reference..."), the Reference, Name, Status, Compliance, Applied rank, Vessel type, Submitted and Notes columns, and pagination.

---

## Applications, Search tab (`/recruiter/applications?tab=search`, RecruiterApplications.jsx:1277-1475, ApplicationFilters.jsx, AISearch.jsx, EmbeddingGenerator.jsx)

Verdict: MERGE. The tab has no link to it anywhere in the app. Its "Manual Search" mode is a second filtered copy of the All list, and AI Search carries a lot of setup text.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Search tab itself | :123-127, :191 | Nothing links to `tab=search` (checked with grep). You only land there by typing the URL or when a saved AI search is restored, and then there is no control back to All. | MERGE: put an "AI search" toggle in the Applications header; drop the tab | M | med |
| "AI Search / Manual Search" segmented control | :930-933, :1281 | Manual Search is the All list with different filters and a separate Apply step. | MERGE: put Manual filters into a "Filters" popover on the All tab; remove Manual mode | M | med |
| "Manual Search" panel heading | :1390 | Repeats the segmented control label. | REMOVE | S | low |
| Active / Archived scope toggle | :1392-1415 | It shares include-flags with the All tab, so picking Archived here changes the All list. The "Closed" chip covers this need. | REMOVE | S | med |
| ApplicationFilters "Search" apply button | ApplicationFilters.jsx:121-128 | Selects only apply after clicking Search, while the All tab filters instantly. The two behave differently. | SIMPLIFY: apply on change | S | low |
| Filter chips, shown twice | ApplicationFilters.jsx:154-163 and RecruiterApplications.jsx:919-929, :1429 | The toolbar copy shows raw keys ("position: chief_officer", "dateRange: Date range"). Removing a toolbar chip doesn't re-run the query, so results go stale. | REMOVE the toolbar chips | S | low |
| Three reset buttons: "Clear", "Reset filters", "Clear manual filters" | ApplicationFilters.jsx:113-120; :1439; :1467 | All three do the same thing. | MERGE: keep "Clear" only | S | low |
| Compliance filter in "More filters" | ApplicationFilters.jsx:184-187 | Duplicates the All tab compliance filter. | REMOVE (keep it on the All tab) | S | low |
| Nationality options in lowercase ("indian", "filipino") | ApplicationFilters.jsx:6-10, :145 | They display raw lowercase values. The list is a hardcoded 15. | SIMPLIFY: show title case | S | low |
| "Date range" filter | ApplicationFilters.jsx:199-218 | It filters `created_at`, but the label doesn't say which date. | RENAME: "Applied between" | S | low |
| Heading stack "Describe the profile you need" + "Prompt" + "Recruiter prompt" | :1289, :1294; AISearch.jsx:85 | Three labels for one textarea. | SIMPLIFY: keep one, "Describe the candidate" | S | low |
| Long textarea placeholder ("Try something like:\nNeed a Chief Officer for oil tanker operations ...") plus "Starter queries" chips | AISearch.jsx:89, :137-148 | Two ways of showing examples. | SIMPLIFY: keep the 3 chips with no label; shorten the placeholder to "e.g. Chief Officer, tanker, C1/D visa" | S | low |
| Embedding panel ("Generate embeddings once.", "AI Search Setup", "Generate embeddings for semantic search", an empty "When to run this" box, "Rate limit: N minute cooldown active", "Check console for details.") | :1315-1327; EmbeddingGenerator.jsx:101-171 | Six lines of technical copy. "When to run this" has no body. It shows even when the index is ready. | SIMPLIFY: hide when ready; otherwise one line "N applications not indexed" plus an "Index now" button | S | low |
| "AI Search is locked until embeddings are ready: … Generate embeddings now, then run the search." | :105-121 | Wordy, and repeated in AISearch.jsx:124. | RENAME: "N applications not indexed." | S | low |
| "Checking embedding readiness..." box | :1295-1299 | Technical status box. | REMOVE (disable the button while loading) | S | low |
| Three "still analyzing" indicators: toolbar pill "AI confidence is still enriching top matches", "Confidence analysis is running for the highest-matching profiles.", and the per-row "Analyzing..." | :1347-1351; AISearch.jsx:129-133; :1041-1045 | Triplicated. | REMOVE the first two; keep the per-row indicator | S | low |
| "Clear" (AISearch) and "Clear search" (toolbar) | AISearch.jsx:105-112; :1352-1358 | Duplicates. | REMOVE "Clear search" | S | low |
| Relevance bar and AI match badge, two scores per row | :1030-1053 | Two percentages for one ranking confuse the reader. | SIMPLIFY: show AI match, falling back to relevance | S | low |
| Compliance column on AI results | :822-840 | The enriched results never compute `compliance_status`, so every row shows "Unknown". Notes show "—" too because `prospect_id` isn't selected. | KEEP (fix: build compliance and select `prospect_id`) | S | low |
| AI results cached in localStorage for 30 minutes | :851-857 | Stores full `application_data` (PII) in the browser. | SIMPLIFY: cache ids and scores only | S | med |

Checked and kept: the AI search textarea and Search button, the empty state "No AI search has been run yet", the Manual filters themselves (Rank, Vessel Type, Experience, Certificate, Visa Type, Flag State, Availability, Age Range), and pagination.

Overlap with the Candidates page (pages/RecruiterCandidatesPage.jsx): it has its own text search, stage filter and Notes column over prospects. The Applications list should stay limited to submitted long forms, and AI search is the only thing unique to this page.

---

## Application detail, recruiter view (`/application/view/:publicToken`, pages/ViewApplication.jsx recruiter branch)

Verdict: SIMPLIFY. Good single place for status actions, but several actions are broken here, compliance is shown twice, and the sidebar repeats data from the sections.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Make Offer", "Mark Accepted", "Mark as Hired" buttons | ViewApplication.jsx:650; SequentialStatusControl.jsx:245-270 | Bug: these steps call `onStatusChange(next)` expecting the parent to write the status. On this page the parent only reloads (`refreshApplication`), so clicking does nothing. | KEEP (fix: write the status in the control itself) | S | high |
| Modals opened from this page (schedule test/interview, results, reject, withdraw, documents) | ViewApplication.jsx:651; TestSchedulingModal.jsx:110; InterviewSchedulingModal.jsx:397; TestResultModal.jsx:162, :238; InterviewResultModal.jsx:153, :222; SequentialStatusControl.jsx:600-605 | Bug: `application` here is the raw row without `application_data`, `full_name` or `email`. Candidate emails go to "" and modal subtitles show blank names. | KEEP (fix: pass an application merged with `applicationData`) | S | high |
| Two compliance panels: "Documents, training, and review flags" and "Application compared against REQ-…" | :704-719 | The overlay is the same groups re-scored against the requirement plus a match group, so most items appear twice side by side. | MERGE: one panel, using the overlay when a requirement is linked | S | low |
| `eyebrow` / `description` props on the overlay panel | :713, :715 | The panel ignores them, so this is dead copy ("This overlay keeps the live candidate evidence visible…"). | REMOVE | S | low |
| Overlay requirement choice | :191-197 | It picks the most recently updated `prospect_requirements` row, which is arbitrary when there are several. This conflicts with the per-requirement case. | KEEP for now; note for case v1 (take the requirement from the case) | — | med |
| Sidebar summary list (Nationality, Age, Certificates, Endorsements, Sea service entries, Visas counts) | :325-333, :657-664 | Nationality and Age repeat the Personal section. The counts give no decision value. | SIMPLIFY: keep only "Submitted" | S | low |
| Fallback text "Rank not specified • Vessel preference not specified", "Available from unknown date" | :623, :639 | Filler text. | SIMPLIFY: hide missing parts | S | low |
| Footer "Reference number: X" | :1173-1177 | Duplicates the reference chip at :606-619 and the print panel. | REMOVE on screen (keep for print) | S | low |
| Sea service "Trading Area" and "Trade Route" rows | :1086-1087 | Trading Area falls back to `tradeRoute`, so the same value prints twice. | REMOVE "Trade Route" | S | low |
| Height, Weight and Shoe Size rows | :1017-1018, :1021 | Bug: a template string with a missing value renders "undefined ". | KEEP (fix: build the string only when a value exists) | S | low |
| RejectionHistory banner | :587; RejectionHistory.jsx:5-129 | It reads `interview_feedback` / `test_feedback`. The main Reject flow writes `rejection_category` / `rejection_notes`, and nothing writes `test_feedback`. Most rejections show "Previously rejected" and "Stage: Test" even when wrong. "Previously rejected. Check the feedback above." (:126) is filler. | SIMPLIFY: one line "Rejected {date} · {category} · {notes}" from the columns the reject flow actually writes; drop the ratings grid | S | med |
| "Generate Worksheet" header button | :422-431 | The modal title "Generate & Download" (:453) and the footer button repeat it. | RENAME: header button "Worksheet" | S | low |

Checked and kept: the Back button, the name title, the reference copy chip, StatusBadge, Print, the photo, the email/phone lines, the Reopen button (gated by `canEditApplications`, so coordinators are excluded), sections 1-19 with empty rows hidden, the print-only header and panel, and the consent rows.

### Worksheet modal (ViewApplication.jsx:441-577)

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Application Status — Current status: …" card | :467-472 | Status is already in the page sidebar. | REMOVE | S | low |
| "Template Details" card (Active template, Uploaded) | :498-514 | Admin detail. The readiness message already says whether a template exists. | REMOVE | S | low |
| Generating text "The template is being populated now. This can take a few seconds." plus a fake progress bar | :516-529 | The button spinner is enough. | REMOVE | S | low |
| Success text "Worksheet download started successfully for X. Check your browser's default Downloads folder." | :362-364 | Wordy. | RENAME: "Downloaded X" | S | low |
| Modal size (88vh, `rounded-[32px]`) for a single select | :450 | Oversized and off-style. | SIMPLIFY: narrow modal | S | low |

Checked and kept: the Customer select, the readiness message, the Retry action on error, Close, and Generate.

---

## Status controls (components/SequentialStatusControl.jsx, recruiter/HandledBySelect.jsx, StatusBadge.jsx)

Verdict: SIMPLIFY. There are too many parallel paths into the same statuses. Each writes different columns, and the copy says things the code doesn't do.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Skip to" menu | SequentialStatusControl.jsx:184-189, :453-470 | From Submitted you can jump straight to Hired with a bare "Skip to Hired / Confirm". That bypasses test, interview, offer and documents and records no reason. The case flow allows only `test_waived`, and only with a reason. | REMOVE | S | high |
| Generic confirm modal "Advance to Under Review" (Cancel / Confirm) | :502-540 | An extra click for a low-stakes forward step. | SIMPLIFY: no confirmation for "Start Review" | S | low |
| "Decline" button (Offered) | :319-344, :404-414 | Duplicates Withdraw > "Candidate declined offer". It writes `withdrawal_reason` while the Withdraw modal writes `withdrawal_data`, so Reopen and history lose the reason. | REMOVE (use Withdraw with that reason preselected) | S | med |
| Three reject flows: kebab "Reject Application" (RejectionModal), Test "Failed", Interview "Failed" | :483-492; TestResultModal.jsx:24-31; InterviewResultModal.jsx:27-35 | Three different reason lists (9 categories, 6 test reasons, 7 interview reasons) written to three different places. Only the interview flow keeps a reason RejectionHistory can read. | MERGE: one reason list and one write path | M | med |
| Statuses outside the flow (`new`, `test_completed`, `test_failed`, `interview_completed`, `second_interview_*`) | :102-113, :178-181 | They get no main button and no skip options, only Reject. Records in them are stuck. | SIMPLIFY: map them onto flow steps (or let the case own them) | S | med |
| "Handled by" select | :417-424; HandledBySelect.jsx:13-84 | Shown in every list row and on the detail page. It disappears on closed statuses, so ownership can't be fixed after a hire. Its query includes all recruiter profiles, not only `workingRecruiters`. | MOVE: detail page only, visible on every status | S | med |
| `console.log` debug output on every render and click | :51-68, :74-78, :171-177, :207-210 (also TestResultModal.jsx:59-118, InterviewSchedulingModal.jsx:73-88) | Noise, and it logs applicant emails. | REMOVE | S | low |
| Unreachable label "Mark Interview Complete" | :137 | It is overridden by "Update Interview Result" (:149-151). | REMOVE | S | low |
| Four label maps for statuses | StatusBadge.jsx:3-23 ("Under review"); SequentialStatusControl.jsx:115-129 ("Under Review"); RecruiterApplications.jsx:281-321; WithdrawalModal `status.replace('_',' ')`; worksheet modal `formatDisplayValue(status)` | Casing and wording drift between them. | MERGE: export StatusBadge's `STATUS_LABELS` and use it everywhere | S | low |
| StatusBadge on the applicant view | components/applicant/ApplicantApplicationView.jsx:147 | Applicants see internal pipeline labels such as "Test failed" or "Rejected". Flag for the applicant audit. | KEEP here; review in the applicant area | — | med |

Checked and kept: the main next-step button labels ("Start Review", "Schedule Test", "Update Result", "Schedule Interview", "Update Interview Result", "Make Offer", "Mark Accepted", "Start Documents", "Mark as Hired"), the kebab with Withdraw and Reject, StatusBadge colours (statusTones.js), and the `canEditApplications` gating.

---

## Modals

Verdict: SIMPLIFY. Each modal has an "Action:" or "What happens next" box that repeats its own options, and several of those boxes say untrue things.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| RejectionModal notes: "Provide detailed feedback for internal records" with the placeholder "Great technical skills but lacks… Consider for 2nd Officer positions in 2 years." | recruiter/RejectionModal.jsx:360-370; services/emailService.js:130-132 | The notes are appended to the candidate's rejection email, so text written as internal goes to the candidate. | RENAME: "Message to candidate (emailed)", or stop sending notes | S | high |
| RejectionModal "This action cannot be undone" | RejectionModal.jsx:216-224 | False: Reopen exists. | RENAME: "The candidate is emailed." | S | low |
| RejectionModal "Contact for Future Roles — Shows up in Find Past Candidates." | :339-355 | No "Find Past Candidates" feature exists (checked with grep). | REMOVE the helper line | S | low |
| RejectionModal "Predefined Tags" (15 in 4 groups) and "Custom Tags" | :65-97, :261-336 | `rejection_tags` is written but never read anywhere in `src`. | REMOVE | S | med |
| RejectionModal category cards with emoji and descriptions; "Withdrew" category | :53-63, :226-259 | Visual noise. "Withdrew" duplicates the Withdraw flow. | SIMPLIFY: a plain select; remove "Withdrew" | S | low |
| RejectionModal "{n} characters" counter | :373-375 | No limit exists, so the count tells the user nothing. | REMOVE | S | low |
| RejectionModal email order | :131-150 | The email is sent before the status write, so a failed save still emails the candidate. | KEEP (fix: write first, then email) | S | med |
| DocumentsChecklistModal "⚠️ Note: The candidate is notified to send these documents." | recruiter/DocumentsChecklistModal.jsx:151-155 | False: no email is sent. | REMOVE | S | low |
| DocumentsChecklistModal static 8-item list and "* Required documents must be submitted before candidate can be hired" | :9-18, :107-134 | The list can't be ticked and nothing enforces the rule; "Mark as Hired" just sets the status. The case has `documents_verified`. | REMOVE the modal; make "Start Documents" a direct step | S | med |
| OfferModal | recruiter/OfferModal.jsx (480 lines) | Imported but never rendered (only RecruiterApplications.jsx:15). "Make Offer" sets `offered` without offer details. | REMOVE (offers move to the case) | S | low |
| WithdrawalModal "⚠️ Important: Marks the application Withdrawn. You can reopen it later." and the info card (Candidate / Current Status / Position) | recruiter/WithdrawalModal.jsx:111-133 | Restates the title. Candidate shows blank from the detail page, and Position is the raw `applied_rank`. | REMOVE both | S | low |
| TestSchedulingModal "What happens next — The candidate gets an email with the details." | TestSchedulingModal.jsx:262-268 | Duplicates "This link will be sent to the candidate" (:243-245) and the button "Schedule Test & Notify". | REMOVE the box | S | low |
| TestResultModal "Action:" box and the Failed description "Candidate failed the test. Application will be rejected." | TestResultModal.jsx:357, :515-535 | Says the same thing twice. | REMOVE the Action box | S | low |
| TestResultModal two-line subtitle "Candidate: … • ref / Position: … • Attempt: x of y" | :300-305 | Wordy. The attempt count is already in the Retake option. | SIMPLIFY: "Name · Ref" | S | low |
| InterviewResultModal "Action:" box for "Did not attend" | InterviewResultModal.jsx:507-520 | Bug: for a no-show it says "Candidate will receive a rejection email… Application will be closed." Nothing like that happens. | REMOVE the Action box | S | low |
| InterviewResultModal 5 star ratings, Overall rating, and a 3-option recommendation with descriptions | :384-462 | Heavy for a pass/fail record. The ratings also show for "Did not attend". | SIMPLIFY: outcome, overall rating, notes; hide ratings on no-show | S | low |
| No-show follow-up | InterviewResultModal.jsx:99-117 | Status stays `interview_scheduled` and the only main button is "Update Interview Result", so the UI has no way to reschedule. | KEEP; note for the case (it has `interview_no_show → interview_scheduled`) | — | med |
| InterviewSchedulingModal Teams block ("Microsoft Teams Required" card with logo SVG; "Microsoft Teams Connected / Ready to auto-create meeting links") | InterviewSchedulingModal.jsx:532-569 | Large for a connection state. | SIMPLIFY: one inline "Connect Teams" link, or a check next to Auto-create | S | low |
| InterviewSchedulingModal Teams OAuth return | :151-178; pages/MicrosoftOAuthCallback.jsx:75 | It always returns to the list, even when started from the detail page, so the user loses their place. | SIMPLIFY: return to the page that started it | S | low |
| ReopenApplicationButton: success `alert()`, "What happens next", info card, long placeholder, title "Reopen Rejected Application" | recruiter/ReopenApplicationButton.jsx:72, :128, :168, :175-178 | Five pieces of copy for a one-field confirm. | SIMPLIFY: title "Reopen", optional reason, no alert | S | low |

Checked and kept: the test date, time and link fields and "Instructions for Candidate (Optional)"; the Test Passed/Failed/Retake options and retake fields; interview type, date, time, duration, Teams URL with Auto-create, and location; the interview Failed reason and "This feedback will be included in the rejection email" (it prevents mistakes); the Withdraw reason and notes; and every Cancel button.

---

## Conflicts with recruitment case v1 (note only, no redesign)

- **Pre-interview stages:** the list's Test and Interview chips (RecruiterApplications.jsx:293-309) and the `submitted → under_review → test_* → interview_*` flow (SequentialStatusControl.jsx:102-113) treat pre-interview stages as application statuses. Under v1 the long form only exists after a passed interview, so these stages belong on the case.
- **Modals that move to the case:** TestScheduling, TestResult, InterviewScheduling and InterviewResult all write `applications.status` and `scheduled_events` directly. RecruitmentCasePanel (RecruiterRequirementDetail) will own these steps.
- **Offer, documents, hired:** "Make Offer", "Start Documents" and "Mark as Hired" on the application duplicate the case's `offered → offer_accepted → documents_pending → documents_verified → sent_to_principal → hired`.
- **Reopen:** Reopen moves the application to `under_review` (ReopenApplicationButton.jsx:48). The case has its own exit and reopen rules.
- **Requirement overlay:** the compliance overlay guesses the requirement from the latest `prospect_requirements` row (ViewApplication.jsx:191-197). It should come from the case.
- **Handled by:** this is per-application today (HandledBySelect). The case may need per-case ownership. Decide before building more on it.

---

## Top 10

1. **Fix the dead detail-page buttons.** "Make Offer", "Mark Accepted" and "Mark as Hired" do nothing on the application page; the control should write the status itself (SequentialStatusControl.jsx:245-270, ViewApplication.jsx:650). S, high.
2. **Fix blank emails from the detail page.** Modals opened there get no candidate email or name; pass the merged application (ViewApplication.jsx:651). S, high.
3. **Stop internal notes reaching candidates.** RejectionModal notes are labelled "for internal records" but are emailed; relabel them as a candidate message or stop sending (RejectionModal.jsx:360-370, emailService.js:130-132). S, high.
4. **Remove the "Skip to" menu.** It allows Submitted → Hired with no record (SequentialStatusControl.jsx:453-470). S, high.
5. **Delete false or filler copy:**
   - "This action cannot be undone"
   - "Shows up in Find Past Candidates."
   - "The candidate is notified to send these documents."
   - "* Required documents must be submitted…"
   - the no-show "Action:" box
   - TestScheduling "What happens next"
   - TestResult "Action:"
   - Withdraw "Important" box and info card

   S, low.
6. **Remove row-level status controls from the list.** That means SequentialStatusControl, "Handled by" and the Eye button; the detail page becomes the one place to act (RecruiterApplications.jsx:1056-1072). S, med.
7. **Replace the broken closed chips.** One "Closed" chip should load hired, rejected and withdrawn. Remove the "Include Rejected Candidates" checkbox and its "(…hidden)" text, and the dead "Test Completed" chip (:298, :311-320, :1211-1227). S, med.
8. **Merge the two compliance panels and remove dead props.** Use the overlay when a requirement is linked (ViewApplication.jsx:704-719). Also make the R/A/G list badges the filter and drop the "All compliance" dropdown (:1206-1252). S, low.
9. **Remove dead and duplicate code:**
   - unused OfferModal (component, import and state)
   - RejectionModal tags, which are never read
   - the Decline button, which duplicates Withdraw
   - `console.log` noise in the status control and modals

   S, low–med.
10. **Fold the unreachable Search tab into the All tab.** AI search becomes a header toggle and Manual filters a "Filters" popover. Drop the duplicate chips, the three reset buttons and the embedding setup copy (shown only when not indexed). M, med.
