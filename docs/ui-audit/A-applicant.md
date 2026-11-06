# A — Applicant side audit

Scope: applicant auth, legal pages, dashboard, form shell, 19 form sections, review & submit, submitted read-only view, legacy success route. All refs are `src/...:line`.

Note on "unused" fields: the only client-side worksheet mapping is `constants/worksheetMappingDefaults.js` (Main + End sheets). The hosted worksheet service is not in this copy, so before you remove a field the table calls "display only", check it against the customer template.

---

## Applicant sign in (`/applicant/login`; `/login` → `/recruiter/login`), `pages/LoginPage.jsx`, `components/auth/AuthLayout.jsx`
Verdict: already lean. Two small changes.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Footer "Recruiter? Sign in here" | pages/LoginPage.jsx:71-74 | Applicants only arrive by emailed link, and recruiters use `/` → recruiter login. Applicants get nothing from the link. | REMOVE (or replace with a "Privacy" link; see Legal) | S | low |
| No message after an expired or invalid link | pages/AuthCallback.jsx:26, 71, 85 | A failed `verifyOtp` only logs to the console. The user lands back on the sign-in page with no explanation. This is the one place a short line prevents confusion. | SIMPLIFY: redirect with `?expired=1`, and LoginPage shows "Link expired. Send a new one." | S | low |

Checked and kept: title "Sign in"/"Check your inbox", subtitle (prevents using the wrong email), email field, "Email me a link", "Open it on this device", "Use a different email", AuthLayout brand mark, `/login` redirect.

## Auth callback (`/auth/callback`), `pages/AuthCallback.jsx`
Verdict: keep. Only the expired-link message is missing (row above).

Checked and kept: spinner, "Completing sign in", 4 s session wait, routing by user type.

## Unauthorized (`/unauthorized`), `pages/Unauthorized.jsx`
Verdict: too wordy for a dead-end page.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Eyebrow "Permission Required" plus title "Access Denied" plus "You don't have access to this page." | :27, :30, :34 | Three lines that say the same thing. | SIMPLIFY: title "No access" only | S | low |
| "You're logged in as a {userType}. …" | :38-42 | Renders "a applicant" (grammar bug). Exposes an internal role word and repeats the title. | REMOVE | S | low |
| "If you believe this is an error, contact support." | :54 | There is no support channel or link. | REMOVE | S | low |
| Button "Go to Dashboard" when signed out | :15, :50 | Goes to `/applicant/login`, so the label is wrong. | RENAME to "Sign in" when `!userType` | S | low |

Checked and kept: icon, home button for signed-in users.

## Privacy policy / Terms (`/privacy-policy`, `/terms-conditions`), `pages/PrivacyPolicy.jsx`, `pages/TermsConditions.jsx`
Verdict: nothing in the app links to these pages (checked with grep), so applicants never see them. Link them or drop them.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Unlinked pages | App.jsx:176-177 | Section 19 asks for "processing of my personal data" consent (Section19.jsx:269) but never links the policy. | MOVE: link "privacy policy" from the Section 19 consent label and the login footer | S | med (legal) |
| "Close Window" button | PrivacyPolicy.jsx:74-79, TermsConditions.jsx:100-105 | `window.close()` does nothing on a tab the user navigated to directly, which is the only way in today. | REMOVE | S | low |
| Intro paragraph under title | PrivacyPolicy.jsx:7-9, TermsConditions.jsx:7-9 | Repeats the title. Terms intro says "in development" and names the operator personally. | SIMPLIFY: drop the Privacy intro. Owner to decide the Terms wording | S | med (legal) |
| "Last Updated" in its own section | PrivacyPolicy.jsx:13-17, TermsConditions.jsx:13-17 | Takes a whole section for one line. | SIMPLIFY: small line under the title | S | low |

Checked and kept: numbered policy and terms sections (legal content, not UI copy).

## Applicant dashboard (`/dashboard`), `pages/Dashboard.jsx`
Verdict: the biggest clean-up on the applicant side. Progress appears twice, there are empty cards, the same action has three entry points, and a start-options modal sits behind a button labelled "Resume".

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Prepare for final review" panel with "What happens next" and "Useful tip" | :520-530 | The cards have headings and no content (leftover shells). | REMOVE | S | low |
| Stat grid "Draft progress" % and "Sections complete" | :403-414 | Repeats the progress bar at :499-508 on the same screen. | REMOVE | S | low |
| Chip "Draft in progress", "Autosave enabled", h3 "Your application is underway" | :489-492 | Three labels for one state. The autosave note is not needed. | SIMPLIFY: keep the progress bar plus "Last saved" | S | low |
| Header "Resume draft" | :390-393 | Calls `handleStartApplication`, which opens the 3-choice modal instead of resuming. Also duplicates "Continue application" at :511. | SIMPLIFY: resume directly. Drop the header button while the draft panel is shown | S | low |
| "Continue application" always opens section 1 | :313-318 | The applicant has to look for where they stopped. | SIMPLIFY: open the first incomplete section | S | low |
| Start-options modal ("Choose how you want to begin", "Continue existing draft", "Start blank", "Reuse previous data", "This replaces your current draft.") plus `confirm()` and `alert()` | :431-480, :277-283, :226-228 | Two layers of confirmation for a rare action. A separate "Discard draft" link already exists at :494. | SIMPLIFY: no modal. With a previous application, prefill from it automatically; to restart, use "Discard draft" | M | med (workflow) |
| "Reuse previous data" copies the whole old record, including `section19` | :194-205 | Declarations, consents, signature name and date carry over, so the applicant can submit without re-confirming. | SIMPLIFY: never copy `section19` (and `section1.availableFrom`) | S | high (consent data) |
| "Application Sections" grid of 19 tiles plus `SECTION_INFO` (a second copy of the section list with icons) | :534-556, :37-57 | Repeats the form sidebar list and `constants/formSections.js` names, with different titles. | REMOVE grid and `SECTION_INFO` (sidebar plus "Continue" cover it) | S | low |
| Empty state "Ready to apply for a maritime position?" plus "Apply now" | :416-429 | Repeats the header "Start application" (:395). See also the Case v1 conflict. | REMOVE (keep the header button) | S | med (case v1) |
| "Create new application" shown twice | :396 and :564-568 | The same button appears in the header and on the Applications panel. | REMOVE the panel copy | S | low |
| Warning banner "A new application can be started only after…" | :571-575 | The start button is already hidden in this state, so the user cannot make the mistake. The same text is also in three `alert()` calls (:189, :237, :251). | REMOVE banner. Keep the alert only as a server-error fallback | S | low |
| "Application record" muted text | :586 | Meaningless label. | REMOVE | S | low |
| Copy-reference button uses the `FileText` icon | :593-607 | It looks like a document icon, not a copy action. | SIMPLIFY: use a `Copy` icon | S | low |
| `getApplicantStatusLabel` | :59-75 | Duplicates the `StatusBadge` labels with different wording ("Offer Received" vs "Offered", "Under Review" vs "Under review"). The applicant sees two vocabularies. | MERGE into StatusBadge (or one applicant label map) | S | low |

Checked and kept: page title "Your application", "Discard draft", progress bar, "Last saved", "Review before submit", applications list (status, ref, rank, submitted date, "View application"), loading state.

## Applicant shell and form layout, `components/applicant/ApplicantSidebar.jsx`, `components/form/FormSidebar.jsx`, `components/form/FormLayout.jsx`, `components/form/FormNavigation.jsx`, `pages/FormSection.jsx`
Verdict: the sidebar is good. The bar under it is broken and duplicates the sidebar, and there is no Next or Previous button.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| FormNavigation: 19 numbered circles plus "Section X of 19" | FormNavigation.jsx:38-78, FormLayout.jsx:203-205 | `applicationData` is never passed, so every circle except the current one is grey (status never shows). It repeats the sidebar list, and there is still no Next or Previous. | SIMPLIFY: replace with "Previous" / "Next" buttons (plus "Section X of 19") | S | low |
| Autosave bar | FormLayout.jsx:158-192 | A full-width bordered box with an empty left `<div>` (:159-160). On first load (`saved` with no `lastSaved`) it renders an empty box. | SIMPLIFY: one small inline status text with no box, hidden when idle | S | low |
| Debug `console.log`s with emoji | FormLayout.jsx:82, 96, 107, 112, 122 | Noise in the user's console. | REMOVE | S | low |
| "Section N - Coming Soon / This section is under development / Go Back" | FormSection.jsx:73-89 | Only reachable with a bad URL. The text is a dev placeholder. | SIMPLIFY: redirect to `/application/form/section/1` | S | low |
| Footer role label "Applicant" under the name | ApplicantSidebar.jsx:117 | Every user on this side is an applicant. | REMOVE | S | low |
| Three different completion calculations | FormSidebar.jsx:20-46 (validate), Dashboard.jsx:354-362 (meaningful data + validate), ReviewSubmit.jsx:130-151 (any data) | The same draft shows different % and complete states on each screen. | MERGE into one helper in `utils/applicationProgress.js` | S | med |

Checked and kept: brand/home button, "Your application" nav item, sidebar progress bar, 19 section links with done/"Fix" states, "Review & submit" / "Return to review" footer, sign-out, mobile drawer.

## Long form: whole-form findings (Sections 1-19), `components/form/sections/*`, `constants/formSections.js`, `utils/sectionValidation.js`
Verdict: 19 steps is more than the job needs. Several fields are asked twice, and about 77 `helpText` lines mostly repeat the field label.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| 19 separate steps | constants/formSections.js:9-28 | The submitted view already groups them into 7 headings (ApplicantApplicationView.jsx:178-435). Several sections hold 1 to 3 fields or are optional lists. | MERGE in the UI only, keeping the `sectionN` data keys: 3+4+5 Travel documents; 8+9+14+15 Certificates; 10+11 Medical; 7 into 2 Personal; 6+12 Education & languages. About 19 steps becomes about 10 | L | med (workflow; data unchanged) |
| Section names in 5 versions | formSections.js (title/shortTitle), Dashboard.jsx:37-57, ReviewSubmit.jsx:15-27, each section `<h2>` | Example: "Experience Summary" / "Experience" / "Technical experience and skills" / "Technical Experience & Skills". Section 2 alone uses "Section 2: …" (Section2.jsx:282). | SIMPLIFY: one `title` from `FORM_SECTIONS` used everywhere. Drop the `SECTION_NAMES` overrides | S | low |
| `helpText` that repeats the label (about 60 of 77) | e.g. S1:144, 158, 176; S3:111, 126, 139, 152, 164; S4:109, 124, 139, 152, 164; S6:164, 177; S9:170; S15:224, 250; S16:376, 436; S17:163, 379, 388, 505; S19:204, 214, 225, 234 | Examples: "When the passport expires", "Start date", "Your preferred contract length". This is the wordy copy the owner wants gone. | REMOVE. Keep only format hints (S16:575 mm/dd, S18:427 country code) | S | low |
| Hard-coded hints "Your height", "Your weight", "Enter your shoe size number" | S13:191, 228, 284 | They repeat the labels. | REMOVE | S | low |
| Info boxes and notices | S11:146-150 and S11:194-208 (two confidentiality notes in one section); S10:261-268 ("will not trigger expiry warnings", a recruiter concept); S18:493-512 ("Best Practices", 5 bullets); S18:516-531 ("Privacy & Confidentiality"); S19:242-244, 288-290; S19:329-336 ("Section 19 Complete!") | Each one adds text the applicant does not need to fill the form. | REMOVE all. From S18 keep only the hint "Add at least 2 references." | S | low |
| Empty-state second lines | S15:186 "Add endorsements if you have any" | Repeats the button. | REMOVE | S | low |
| Remove buttons on record cards have no confirm or undo | e.g. S16:180-184, 317 | One click deletes an 18-field sea-service record. | KEEP behaviour, but flag it: add a `confirm()` only on S16 | S | low |

## Long form: per-section findings
Verdict: the main targets are Sections 2, 16, 18 and 19. Most other sections only need text trimmed.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| S1 "Position Applied For", "Type of Vessel", media-advert and recommendation toggles | Section1.jsx:134-260 | Asked after a passed interview, when the prospect and requirement already hold rank, vessel and `lead_source` (ViewApplication.jsx:183). Worksheet maps C16/C17/E20/F23. | KEEP for now. Prefill from the prospect when case v1 lands (see Case v1) | M | med |
| S1 toggle labels "Are you responding to a media advertisement?" / "If yes, please state which one" | :205, :213, :240, :248 | Long question phrasing. | RENAME: "Found us via an ad" / "Which ad"; "Referred by someone" / "Referred by" | S | low |
| S2 "Age" read-only input plus "Automatically calculated…" | Section2.jsx:404-411 | Display-only box. The worksheet computes age from DOB. Keep storing `age` (RecruiterApplications reads it) but hide the field. | REMOVE input | S | low |
| S2 "Known As" vs "Other Names" | :331-347 | Overlapping name fields. Only `otherNames` is in the worksheet. `knownAs` is display-only. | MERGE `knownAs` into "Other names" | S | med (data) |
| S2 Next of Kin block vs Emergency Contact block | :575-652 vs :656-713 | Both ask name and relationship (required), address and phone. NOK has the toggles "has different address/phone" (:605, :631), which only the form uses (no consumer reads `addressDifferent`/`phoneDifferent`). Only the emergency contact is in the worksheet. | SIMPLIFY: drop the two toggles and show optional NOK address/phone. Owner to decide whether NOK and emergency contact can be one block | S (toggles) / M (merge) | med |
| S2 "Domestic Airport" / "International Airport" | :541-557 | helpText repeats the label. Both placeholders say "JFK, LAX". | RENAME labels "Nearest domestic airport" / "Nearest international airport". Remove helpText | S | low |
| S2 Photo upload: two triggers plus a 5-bullet "Photo Requirements" list | shared/PhotoUpload.jsx:141-157 and :170-193 | The "Click to upload" tile and the "Choose Photo" button do the same thing. Format and size are already enforced by the input and alerts. | SIMPLIFY: keep the tile. One line: "Passport-style, plain background" | S | low |
| S3 "Important: Passport must be valid at least 6 months…" box | Section3.jsx:168-183 | A box plus heading for one sentence. | SIMPLIFY: make it the expiry field's helpText | S | low |
| S7 Dependents "Age" auto field | Section7.jsx:155-162 | Same as the S2 age field. | REMOVE input | S | low |
| S8 "Revalidation Details (if applicable)": two dates plus "Leave blank if not revalidated" ×2 | Section8.jsx:256-279 | Compliance reads only `dateRevalidationExpiry`. `dateRevalidated` is display-only. | SIMPLIFY: one optional "Revalidated until" field | S | med (data) |
| S10 six routine vaccines (Hep A/B, Typhoid, Tetanus, Measles, Polio), each a checkbox plus date | Section10.jsx:330-500 | Display-only. Compliance uses only yellow fever and COVID. There is already a free-text "Other Vaccinations" field (:503). | SIMPLIFY: keep yellow fever and COVID, fold the rest into "Other vaccinations" | M | med (check worksheet) |
| S11 long helpTexts | Section11.jsx:139, 185 | :185 repeats the placeholder at :184. | REMOVE helpTexts | S | low |
| S13 "Hair Color", "Eye Color" | Section13.jsx:233-250 | Display-only. Not in the worksheet defaults or the applicant view. | REMOVE (confirm against customer template) | S | med |
| S13 shoe "Sizing System" select plus helpText | :287-296 | An extra control for one number. | SIMPLIFY: put the unit in the placeholder ("e.g. EU 42"). Remove the select's helpText | S | low |
| S14 read-only "IMO Model Course" and "Reference- Regulation" fields | Section14.jsx:183-204 | Auto-filled. The applicant cannot edit them and does not need them. They are still stored for the recruiter view. Label typo "Reference- Regulation". | REMOVE from form (keep stored) | S | low |
| S14 "Mandatory STCW Courses" box at the bottom | :256-282 | Useful (prevents missing courses) but sits after the list, where it is read too late. | MOVE above the list. Shorten to one line plus the 5 names | S | low |
| S16 "Rank Held" and "Position", both required | Section16.jsx:470-490 | Same question twice, with the same placeholder "Chief Officer". | MERGE into "Rank" (`rankHeld`) | S | med (data) |
| S16 "Trading Area" (text) and "Trade Route" (select), both required | :544-565 | The same concept asked twice. | MERGE into one select | S | med |
| S16 "Main Engine Type", "Engine Family", "Main Engine Make", all required, plus "Engine Power" | :417-461 | Three overlapping engine fields (`Steam Turbine` appears in two lists). Required for deck ratings too. Engine family helpText "Normalized … for reporting" is internal language. | SIMPLIFY: keep Make and Family. Make them required only for engine ranks. Remove the helpText | M | med |
| S16 "TEU" required, "Year Built" required, "GRT (Gross Registered Tonnage)" plus helpText | :368-413, sectionValidation.js:372-374 | TEU only applies to container ships, so others are forced to type 0. | SIMPLIFY: TEU optional (or only for container types). Label "GRT", no helpText | S | med |
| S16 "Total mm/dd" typed by hand, required | :567-577 | Can be derived from the sign-on/off dates, which are already required (the banner computes them at :217-233). | SIMPLIFY: auto-calculate, no input | S | med |
| S16 "Reason for Leaving" options "MR/VS/EOC" plus a legend helpText | :49-53, :587 | The abbreviations need a legend. | RENAME options to "Medical", "Vessel sold", "End of contract" (keep values). Remove helpText | S | low |
| S16 "Approximately N days total" line and per-row "(N months)" | :260-262, :306-313 | Repeats the total banner just above it. | REMOVE both | S | low |
| S17 skill labels with long expansions, e.g. "ECDIS (Electronic Chart Display and Information System)" | Section17.jsx:150-152 | The audience is seafarers who know the acronyms. | RENAME to the acronym | S | low |
| S17 "Main/Auxiliary Engine Experience" free text | :373-389 | Overlaps the per-vessel engine data in S16. | KEEP (optional), but remove the helpTexts | S | low |
| S18 "Do you have any objection if we contact your last employer for reference?" | Section18.jsx:221 | Double negative. The applicant view already rewrites it as "May we contact them?" (ApplicantApplicationView.jsx:419). | RENAME to "May we contact your last employer?" (invert the option mapping, keep the stored value) | S | med (worksheet H19 reads it) |
| S18 references: 8 required fields each, for 2 references | sectionValidation.js:413-425 | The worksheet uses only company, name, address and phone. Relationship, years known, email and position are display-only. | SIMPLIFY: make relationship, years known and email optional (or remove relationship and years known) | S | med |
| S18 "Additional Notes (Optional)" plus example helper line | Section18.jsx:459-474 | Low value per reference. | REMOVE helper line. Owner to decide on the field | S | low |
| S19 "Notice Period" and "Preferred Join Date" | Section19.jsx:198-216 | Duplicate S1 "Available From". All three helpTexts ask "when can you join". | REMOVE both (S1 owns availability) | S | med (data) |
| S19 "Medical Conditions or Disabilities" | :157-164 | Duplicates S11 Medical history. | MOVE to S11 (or remove) | S | med |
| S19 "Special Requirements", "Preferred Contract Duration", "Salary Expectation" | :147-154, :219-235 | Display-only, collected after a passed interview, when terms come from the requirement and offer. | REMOVE (owner confirm) | S | med |
| S19 "Additional Information About Your Application" | :136-144 | Overlaps S17 "Additional Skills". | MERGE into one free-text field | S | low |
| S19 "I agree to receive relevant updates…" (`marketingConsent`) | :278-283 | Collected but nothing uses it (only displayed in ViewApplication). | REMOVE (or keep only if the owner plans marketing emails) | S | med (consent) |
| S19 signature "Full Name" and editable "Signature Date" | :293-312 | The name repeats S2. The date defaults to today but can be backdated, and `submitted_at` already records the date. | SIMPLIFY: prefill the name from S2. Make the date read-only | S | med |
| S19 section title "Additional information and declarations" | :130 | Differs from the sidebar "Declaration & Consent". | RENAME (see section names row) | S | low |

Checked and kept: S3/S4 document fields (all in the worksheet); S5 visas; S6 education entries (minus helpTexts); S8 CoC core fields; S9 GMDSS (worksheet maps the latest); S10 medical certificates, yellow fever with lifetime flag, COVID; S11 signed-off question plus conditional fields; S12 languages; S13 height, weight, uniform sizes; S14 course list; S15 endorsements; S16 vessel name, type, flag, company, manning, dates; S17 checkbox groups; S18 employer block; S19 criminal record question and 3 mandatory declarations.

## Review & submit (`/application/review`), `pages/ReviewSubmit.jsx`
Verdict: one real bug, dead code, and a third copy of the application renderer. Simplify to one list plus one submit area.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Completion = "section has any data" | :130-151, :171-189 | A mandatory section with one field filled counts as complete, so it can be submitted while the sidebar shows "Fix". | SIMPLIFY: use `validateSection` (the same helper as the sidebar) | S | high (changes what can be submitted; pair with the S16/S18 required-field trims) |
| Section 2 summary uses `lastName` | :800 | The field is `surname`, so the summary shows the first name only. | SIMPLIFY: use `surname` | S | low |
| "Required Sections Incomplete" modal | :1041-1094, :191-200 | Unreachable: the submit button is disabled whenever sections are incomplete (:1011). | REMOVE | S | low |
| "Application Progress" card (%, bar, "X of 19") | :879-893 | Duplicates the sidebar progress shown on this page, and calculates it differently. | REMOVE | S | low |
| "Back to Dashboard" link | :863-871 | Duplicates the sidebar "Your application". | REMOVE | S | low |
| `SECTION_NAMES` overrides | :15-27 | A fifth set of section names. | REMOVE (use `FORM_SECTIONS`) | S | low |
| "REQUIRED" badge on 13 rows | :923-927 | Noise once a section is complete. The red icon already marks incomplete ones. | REMOVE | S | low |
| Per-row "Review" expand with `renderSectionDetails` | :346-790, :934-950 | About 450 lines that re-render the application a third time (besides ApplicantApplicationView and the recruiter ViewApplication), with fewer fields and different labels. | MERGE: show `ApplicantApplicationView` content (or a link to it) and keep the "Edit" per section | M | low |
| Submit area: "Ready to Submit?", green/red box (heading plus repeated sentence), "By submitting, you confirm…", "Complete all required sections to enable submission" | :978-1036 | Four messages for one state. "By submitting…" repeats the S19 accuracy declaration. | SIMPLIFY: button plus one line listing incomplete sections as links | S | low |
| Confirm modal "You'll get a confirmation email." | :1107 | The submit code comments say `send-application-emails` is the "recruiter email" (:300). Unverified that the applicant gets anything. | REMOVE unless the edge function emails the applicant | S | low |
| Debug `console.log`s | :208, :222-232, :280-290, :313 | Noise in the console. | REMOVE | S | low |

Checked and kept: sidebar in review mode, per-section status icon plus summary, "Edit" → section with `?return=review`, confirm modal itself, submit flow, redirect to the read-only view with `?submitted=1`.

## Submitted application, applicant view (`/application/view/:publicToken`), `components/applicant/ApplicantApplicationView.jsx`, `pages/ViewApplication.jsx` (applicant branch)
Verdict: good structure. Remove the duplicate summary cards and the always-"Yes" rows, and clean up the leftover applicant branches in ViewApplication.

| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "At a glance" 4 cards | ApplicantApplicationView.jsx:163-176 | "Available from" repeats the Availability card. The certificate and sea-service counts repeat the tables. "Nationality" appears only here. | REMOVE cards. MOVE Nationality into "Personal & contact details" | S | low |
| Group headings (Personal, Travel documents, … Declaration) | :178, 234, 268, 316, 361, 412, 435 | An extra layer above the card titles. "Declaration" and "References" wrap their own cards. | REMOVE | S | low |
| Availability card "Position applied for", "Vessel type" | :226-227 | Repeat the header subtitle (:143-145). | REMOVE from the card | S | low |
| Declaration rows "Information is accurate", "Background check consent", "Data processing consent" | :438-440 | Always "Yes", because submission requires them. | REMOVE | S | low |
| Status badge (pipeline status) | :147 | Shows internal stages such as "Test scheduled" or "2nd interview completed" to the applicant. See Case v1. | KEEP for now; flag | — | med |
| Error state "Application Not Found" plus "Go to Login" | ViewApplication.jsx:295-307 | For a signed-in applicant, `/` goes to the dashboard, so the label is wrong. There is also no sidebar. | RENAME to "Back" | S | low |
| Dead applicant branches after the early return | ViewApplication.jsx:243-246 (`handleBack` applicant path), :397 (`isApplicantView ? 'applicant-shell'`) | Unreachable, because the applicant returns at :377. | REMOVE | S | low |

Checked and kept: "Application submitted" banner with reference and dismiss, photo/initials, name, reference, submitted date, Print, all section cards and tables, "Nothing provided."/"None listed." empties. Separation is fine: the compliance panel and recruiter actions are gated by `isRecruiterView` and never reach the applicant branch.

## Legacy success route (`/application/success`), `App.jsx:321`
Verdict: keep the redirect to `/dashboard` (old emailed links). No UI.

## Brand leak: reference number prefix
| Element | Where | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Reference numbers generated as `NJD-XXXXXX` | utils/referenceGenerator.js:8-11 | Applicants see "NJD" (= Njord) on the dashboard (:592), the submitted banner (ApplicantApplicationView.jsx:117) and the header (:149), which breaks the "no Njord" rule. `isValidReferenceNumber` (:16-20) is unused (grep). | RENAME prefix (e.g. `HLM-`). Delete the unused validator | S | med (existing refs keep the old prefix) |

## Case v1 conflicts (note only, no redesign)
- The dashboard lets applicants start, restart and reuse applications themselves ("Start application", "Apply now", "Create new application", "Reuse previous data": Dashboard.jsx:391-398, 416-429, 456-472, 564-568). In case v1, the long form is opened only after a passed interview.
- The applicant sees pipeline statuses that move to the case (test, interview, offer stages): Dashboard.jsx:59-75, ApplicantApplicationView.jsx:147 via StatusBadge.
- The "one active application" rule and its alerts (Dashboard.jsx:185-191, 247-253; ReviewSubmit.jsx:326-330) key off application status. In case v1 this becomes per candidate per requirement.
- S1 asks rank, vessel type and lead source, which the prospect, requirement and case will already hold (ViewApplication.jsx:183 reads `rank_applied_for_id`, `vessel_type_id`, `lead_source`). Submit writes `applied_rank` from S1 (ReviewSubmit.jsx:207, 241).

## Top 10
1. **Review completeness bug**: use `validateSection` in ReviewSubmit (:130-189) so incomplete mandatory sections cannot be submitted and the review page agrees with the sidebar. Ship it together with #4 so the stricter check does not block on nonsense fields. S, high.
2. **Stop copying Section 19 on "Reuse previous data"** (Dashboard.jsx:194-205), so consents and signature are re-confirmed. S, high.
3. **Remove the empty "Prepare for final review" panel** (Dashboard.jsx:520-530) and the duplicate stat grid (:403-414). S, low.
4. **Section 16 de-duplication**: merge Rank Held/Position and Trading Area/Trade Route, auto-calculate Total mm/dd, make TEU optional, and spell out the MR/VS/EOC options. S-M, med.
5. **Rename the `NJD-` reference prefix** (referenceGenerator.js:11). S, med.
6. **Bulk text cut**: about 60 label-repeating helpTexts, the duplicate S11 confidentiality notes, the S18 "Best Practices"/"Privacy" boxes, the S19 explainer paragraphs and "Section 19 Complete!", the S10 lifetime alert, and the S13 "Your height/weight". S, low.
7. **Section 19 duplicates out**: Notice period and Preferred join date (S1 owns availability), Medical conditions (S11 owns it), and the unused `marketingConsent`. S, med.
8. **Replace the FormNavigation circle strip with Previous/Next** (FormLayout.jsx:203-205). The strip never shows status, and the form has no Next button today. S, low.
9. **ReviewSubmit clean-up**: remove the dead incomplete modal, progress card, "Back to Dashboard", REQUIRED badges and the 4-message submit block, and fix the `lastName` summary bug (:800). S, low.
10. **Dashboard entry points**: "Resume draft"/"Continue" go straight to the first incomplete section, drop the start-options modal and the duplicate "Create new application", "Application record" and warning banner, and use one status-label map. S, low-med.
