# C. Recruiter records and insights: UI audit

Scope: sidebar/shell, Requirements, Candidates, Requirement detail, Candidate detail, Dashboard, KPI (Overview / Charts / Reports), charts.
All paths are relative to ``src/` (snapshot at a529b28)`. Line numbers are from the read-only copy.

Cross-screen issues (they show up in several tables below):
- **The same number appears up to four times.** "Open requirements" is on Requirements (stat card + segment count), Dashboard and KPI. "Open positions" is on Requirements, Dashboard and KPI. "Active pipeline" is on Candidates (stat card + segment count) and KPI. "Overdue" is on Requirements, Dashboard, KPI "Needs action now", the KPI age chart and the On-time column of the progress table.
- **The same label is calculated in different ways.** "Conversion" has three formulas. Candidates page (`RecruiterCandidatesPage.jsx:106`): joined / all live candidates, including candidates never contacted. KPI card and scorecard: the cohort contacted in the selected period. Export summary, weekly PDF and productivity CSV (`utils/kpiTracker.js:476`): joined / contacted, all time. "Avg days to join" is all-time on Candidates but follows the period filter on KPI. "Joined" means junction rows on Requirements and Requirement detail, but candidates on Candidates and KPI.
- **Clicking a count opens a list that shows a different number.** Dashboard "Overdue" (`RecruiterDashboardSimple.jsx:214`) opens all open requirements, and "Follow-ups due" (`:216`) opens all active candidates. KPI "Closed, this month" (`RecruiterKpiPage.jsx:624`) opens all closed requirements. "Joined, this month" and "Joined vs required" (`:626`, `:669`) open all joined candidates. "Invites not claimed" (`:598`) opens the active pipeline.
- **The UI says "prospect" but the sidebar says "Candidates".** Examples: "Linked prospects", "Prospects attached to this requirement", "Open prospect", "Back to prospects", "Prospect not found", "Prospect Snapshot".
- **Each page has three or four export paths.** Requirements and Candidates have a page-level "Export CSV". Each detail page has its own one-row CSV plus a PDF. KPI has "Export summary" in the header plus four report cards on the Reports tab.
- **Conflicts with recruitment case v1 (noted only, no redesign):**
  - The requirement and candidate pages show junction statuses (Shortlisted / Submitted / Joined) next to, or instead of, case status.
  - Dashboard "Interviews and tests" and KPI "events today" come from application-scheduled events.
  - KPI "Time sitting in current stage" and "awaiting review" use application statuses.
  - The candidate page lets you send an invite at any stage, but the long form is meant only for after a passed interview.

---

## Sidebar / shell
(`components/recruiter/RecruiterSidebar.jsx`, `RecruiterTopbar.jsx`, `components/ui/PageHeader.jsx`)

Verdict: lean and fine. There are only two small cleanups.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Account menu header (name, email, role) | RecruiterSidebar.jsx:263-267 | The button right above it already shows the name and role (`:253-254`), so the menu repeats them. The only extra is the email. | SIMPLIFY: in the menu, show only the email and "Sign out". | S | low |
| `RecruiterTopbar` wrapper | RecruiterTopbar.jsx:1-6 (imported by 13 files) | A one-line pass-through to `RecruiterSidebar`. The name is now misleading (there is no top bar). This is code-only and invisible to users. | MERGE: import `RecruiterSidebar` directly whenever a page is next touched. Not urgent. | S | low |

Checked and kept:
- Nav groups (Recruit / Insights / Schedule)
- Visibility gates on KPI, Expiry and Settings
- Collapse/expand, mobile drawer, "H" home mark, active-match rules
- PageHeader (already title + actions only)

---

## Requirements list
(`/recruiter/requirements`: `pages/RecruiterRequirementsPage.jsx`, `components/recruiter/RequirementForm.jsx`)

Verdict: the table is good. The stat row, the footer text and a few form fields repeat or confuse.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Stat card "Open requirements" | RecruiterRequirementsPage.jsx:241 | Exactly the same number as the "Open (n)" segment 10 lines below. Also shown on Dashboard and KPI. | REMOVE | S | low |
| Stat card "Candidates joined" | :243 (`joinedTotal` from `filteredRows`, :98) | The only card that changes with the filters; the other three always count all open rows. Users get mixed scopes on one row. | REMOVE, or compute it from open rows like the others | S | low |
| Stat card "Overdue requirements" | :244 | Uses a `CheckCircle2` (tick) icon for a warning. The number is also on Dashboard and KPI. | KEEP the number; change the icon to `AlertTriangle`. Or remove the whole stat row (see Top 10). | S | low |
| Header button order | :167-195 | "Export CSV" is the filled/primary button while "New requirement" is grey. The main job on this page is creating or finding a requirement. | SIMPLIFY: make "New requirement" primary and "Export CSV" secondary. | S | low |
| "Refresh" button | :178-185 (same on Candidates :187, Dashboard :173, KPI :473) | Data already loads on open. A full text button on four pages adds noise. | SIMPLIFY: make it icon-only with a "Refresh" tooltip. | S | low |
| Columns "Required / Joined / Open" | :320-322 | Three number columns for one idea. The Dashboard/KPI progress table shows the same thing as "Filled 1 / 2". | MERGE into one "Filled" column ("1 / 2"), and keep the open count highlighted. | S | low |
| Columns "Days open / Target" | :324-325 | Shown as two columns here but as "12 / 30" in the progress table. The same data looks different on each screen. | MERGE into "Days open" shown as "12 / 30" | S | low |
| Footer "N requirements shown · days to close for closed rows: X average" | :376-385 | Wordy. The average is a KPI number and does not belong on the list. | SIMPLIFY to "N shown", or remove. | S | low |
| Form "Requirement status" on **New** | RequirementForm.jsx:77 | Creating a requirement that is already closed or cancelled is not a real task. On **Edit** the field repeats the Close / Cancel buttons on the detail page. | REMOVE from New (always open). Keep on Edit only for reopening. | S | low |
| Form "Logged by" | RequirementForm.jsx:82 | The same field is called "Recruiter" in the list, "Owner" in the progress table and "Owner/Recruiter" in the CSV. | RENAME to "Recruiter" everywhere | S | low |
| Form "Remarks / notes" | RequirementForm.jsx:89; services/recruiterRecordService.js:58-61, 73-79 | On Edit it is always empty but *adds* a new remark. It does not edit the old ones. If status is "Cancelled" the text silently becomes the closure reason instead. This is the only way to add a requirement remark. | RENAME to "Add remark". Note: hidden behaviour when status is Cancelled. | S | med |
| Submit "+ Save requirement" / "+ Update requirement" | RequirementForm.jsx:92-95 | A plus icon on an update button; long label. | RENAME to "Save" (no icon) | S | low |

Checked and kept:
- Status segments with counts
- Search, Recruiter and Opened from/to filters, URL presets
- Req ID link with return state; Archived pill
- Status, On-time and Remarks columns
- Empty state "No requirements match"
- Error/retry block
- CSV column set (matches the tracker workbook)

---

## Candidates list
(`/recruiter/candidates`: `pages/RecruiterCandidatesPage.jsx`, `components/recruiter/CandidateForm.jsx`)

Verdict: the stat row repeats the segments and uses a different conversion formula. The filters overlap.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Stat cards "Active pipeline", "Joined" | RecruiterCandidatesPage.jsx:253-254 | Same numbers as the "Active pipeline (n)" and "Joined (n)" segments directly below. "Active pipeline" is also on KPI. | REMOVE | S | low |
| Stat card "Contact-to-join conversion" | :255 (formula :104-106) | The denominator includes candidates never contacted, so it disagrees with KPI "Conversion" and with the export's "Contact-to-join conversion". | REMOVE (KPI owns conversion), or use the KPI formula | S | med |
| Stat card "Avg days to join" | :256 | All-time here but period-based on KPI. Same label, different number. | REMOVE (KPI owns it) | S | low |
| "Stage" dropdown | :280-292 | Overlaps the segments: Joined, Rejected and Withdrawn are in both, so "Joined" + "Contacted" gives an empty list. The `?stage=` URL preset (:59) is never used by any link (grep). | SIMPLIFY: list only the active stages (Contacted→Approved) and drop the unused URL param | S | low |
| "Unassigned" in Requirement column vs "Unattached" segment | :376 vs :36 | Two words for the same state. | RENAME to one word (e.g. "Unattached") | S | low |
| Column "Pipeline" | :348, :391-401 | "Active / Completed / Closed" can be worked out from Stage next to it. The only extra information is the days since contact. | SIMPLIFY: replace with "Since contact" (e.g. "12d") for active rows only | S | low |
| Columns "Joined on" + "Days to join" | :346-347 | Two columns that are "—" for almost every row. | MERGE into "Joined" (date + "(n d)") | S | low |
| Footer "N candidates shown of M tracked." | :412-414 | "tracked" is jargon. | SIMPLIFY to "N shown" | S | low |
| Header button order | :176-204 | Same as Requirements: Export is primary, New is grey. | SIMPLIFY: make "New candidate" primary | S | low |
| Form "Added by" | CandidateForm.jsx:163 | Shown to everyone. RequirementForm hides its version behind `canChooseRecruiter`. Any recruiter can credit a candidate to someone else, and that changes the scorecard (candidates are credited to whoever added them, kpiTracker.js:509-511). | SIMPLIFY: show it only when `canChooseRecruiter` (same gate as the requirement form). Otherwise default to self. | S | med |
| Toggle help "If checked, previous employer stays optional." | CandidateForm.jsx:192 | Repeats the field placeholder "Required unless first time at sea" (:175). | REMOVE the description | S | low |
| Label "Attach to requirement (optional)" | CandidateForm.jsx:181 | The placeholder already says "Leave unattached for now". | RENAME to "Requirement" | S | low |
| Label "Candidate name" | CandidateForm.jsx:160 | The form is already titled "New candidate". | RENAME to "Name" | S | low |

Checked and kept:
- View segments with counts
- Search, Recruiter and Contacted from/to filters
- Name link + email
- Requirement link, Rank, Vessel type, Stage pill + Archived, Notes column
- Empty state
- CSV columns (match the workbook)
- Form fields DOB, contacted date, rank, vessel type, nationality, experience, phone, email, previous employer, lead source, notes

---

## Requirement detail
(`/recruiter/workspace/requirements/:id`: `pages/RecruiterRequirementDetail.jsx`, `components/recruiter/RecruitmentCasePanel.jsx`)

Verdict: the most duplicated screen. The same candidates appear three times: stat cards, "Prospects attached" and cases. The same remarks appear twice: Remarks and Activity feed. There are eight header buttons.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Activity feed" panel | RecruiterRequirementDetail.jsx:192-225, 698-718 | Every remark is repeated from the Remarks panel, and every junction is repeated from "Prospects attached" (labelled "Junction shortlisted", which is internal jargon). The only new item is "Requirement created… entered the live requirement pool." Case history is already in the cases panel. | REMOVE | S | low |
| Stat cards "Linked prospects / Shortlisted / Submitted / Joined" | :522-527 | They count the rows and status pills of the list on the same page. They use junction statuses (old flow), not cases. | REMOVE. Put the joined count into the header pill instead, e.g. "1 / 2 filled". | S | low |
| "Prospects attached to this requirement" vs "Recruitment cases" | :578-658 | Already recorded for later: same candidates, two status systems. Noted only. | (recorded) | – | – |
| Inside attached rows: "Joined: —", "Withdrawn: —" | :628-633 | Show a dash on almost every row. | SIMPLIFY: show only when set | S | low |
| "Last transition by:" label | :626 | Jargon. | RENAME to "By" | S | low |
| "Open prospect →" button | :642-651 | Takes extra space; the cases panel already makes the name a link. | SIMPLIFY: make the name a link and remove the button | S | low |
| Header "Export CSV" | :442-450, :237-280 | A one-row CSV whose fields are a subset of the Requirements page "Export CSV". | REMOVE | S | low |
| Header "Export PDF" | :451-459; footerNote :325 | Keep the snapshot. The footer "Generated from the live recruiter requirement detail page." says the obvious, and the PDF table is titled "Linked prospects". | KEEP; REWORD: drop footerNote, rename "Linked candidates" | S | low |
| Header "Back to requirements" | :460-467 | The label is wrong when opened from KPI, Dashboard or a candidate page (`backTo` = any origin). | RENAME to "Back" (or a ← icon) | S | low |
| Header Close / Cancel requirement / Archive / Delete / Edit | :468-492 | Five action buttons + two exports + Back = eight. Close/Cancel repeat the Edit form's status field. "Cancel requirement" via the button saves no closure reason, but via the form it saves the notes text as the reason. | SIMPLIFY: keep Edit + Close as visible buttons; put Cancel / Archive / Delete in a small "More" menu or one row; one cancel path | M | med |
| Delete confirm "…This is a restricted action." | :415 | Tells the user nothing useful. Archive has no confirm at all (:484). | REWORD to "Delete requirement X?"; consider a confirm on Archive | S | med |
| Details grid: "Closure reason: Not set" | :553-556 | Shown on every open requirement. | SIMPLIFY: show only when closed or cancelled | S | low |
| Details grid: no Vessel name | :532-557 (vessel_name loaded :98) | Vessel is the second column on the list but never appears on the detail page (the title is the Req ID). | MOVE: add the existing `vessel_name` to the grid or the header pill | S | low |
| Details panel stray `mt-4` | :532 | Top margin left over from a removed heading. | SIMPLIFY (layout only) | S | low |
| Remarks: "Internal" badge on every remark | :681-685 | Every remark is internal, so the badge is noise. Only "Master only" carries meaning. | REMOVE the "Internal" badge | S | low |
| Empty-state descriptions | :594, :669 ("This requirement does not have any … recorded yet.") | They repeat their titles. | REMOVE the descriptions | S | low |
| Error/not-found text "Requirement detail could not load", "Back to requirements" | :352, :383 | Wordy / origin-unaware. | REWORD: "Could not load requirement", "Back" | S | low |
| Cases panel empty description "Start a case for a candidate linked to this requirement." | RecruitmentCasePanel.jsx:287 | The "Linked candidates without an active case" chips below already show how to do it. | REMOVE the description | S | low |
| Cases panel "Linked candidates without an active case" | RecruitmentCasePanel.jsx:295 | Long label for a row of "+ Name" buttons. | RENAME to "Start case:" | S | low |
| Cases panel `canOpen` includes `create_prospects` | RecruitmentCasePanel.jsx:44, :274 | If Coordinators hold `create_prospects`, they can open cases, and the header still says "read only" (that check ignores `canOpen`). This conflicts with the decision that Coordinators are read-only. | Verify Coordinator permissions; gate on `edit_junction_status` only | S | high |

Checked and kept:
- Title (Req ID), status pill and positions pill
- Edit (inline RequirementForm), notice/error banners
- Customer, Rank, Vessel type, Open date, Target days
- Nationality preferences chips
- Remarks list (author, Transition note, Master only, date)
- Cases panel: status pill, Cycle, Source/Updated line, History toggle, next-action buttons, "Place on new flow", "Close case" with reason, Show/Hide closed

---

## Candidate detail
(`/recruiter/workspace/prospects/:id`: `pages/RecruiterProspectDetail.jsx`)

Verdict: a stat row of list counts, an activity feed that repeats three panels, jargon headings, and an invite panel that conflicts with case v1.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Activity feed" panel | RecruiterProspectDetail.jsx:204-246, 859-879 | Repeats Notes, the junction list ("Junction shortlisted") and Applications. The only new item is "Prospect created … entered the live prospect pool." | REMOVE | S | low |
| Stat cards "Notes / Linked requirements / Applications / Last activity" | :607-612 | The first three count the lists on the same page. | REMOVE the row; move "Last activity" into the header pills | S | low |
| Header status pill (Open / Contacted / Approved / Rejected) | :558-561 | Shows raw `prospect.status`. The Candidates list shows the derived Stage (e.g. "Interviewed", kpiTracker.js:381-395). The same candidate shows two different statuses. | SIMPLIFY: show the same Stage as the list | M | med |
| Heading "Requirement matches and junction history" | :655 | Jargon. | RENAME to "Requirements" | S | low |
| Row label "Requirement:" (shows the customer name) | :692-693 | Wrong label for what it shows. | RENAME to "Customer:" | S | low |
| Row "Last transition by:", "Joined: —" | :698-703 | Jargon / mostly empty. | RENAME to "By"; show Joined only when set | S | low |
| "Open requirement →" button | :706-715 | Same as on the requirement page. | SIMPLIFY: make the Req ID a link and remove the button | S | low |
| No case status on this page | :653-722 | Only junction status is shown. Once cases go live, this page shows the old status. Case v1 conflict; noted only. | (note for case v1) | – | – |
| Heading "Internal and transition notes" | :726 | Wordy. | RENAME to "Notes" | S | low |
| Notes "Internal" badge | :747-751 | Same noise as on Remarks. | REMOVE | S | low |
| Notes empty description | :734 | Repeats the title. | REMOVE | S | low |
| Invite panel heading "Send a new invite or correct the email before resending" | :765 | A sentence used as a heading. | RENAME to "Invite" | S | low |
| Invite panel shown with no `send_prospect_invites` | :764-809 | Users without the permission (e.g. Coordinators) still see an editable message box and a disabled "Send invite". | SIMPLIFY: hide the panel when `!canSendInvite` | S | low |
| Invite panel is the only place to change the email | :368-382 | Editing the email here silently updates the candidate record. That coupling is hidden. | Note only; label the field "Email" | S | med |
| Invite panel vs case v1 | :764-809 | Sends an invite at any stage. Under case v1 the long form follows a passed interview (the case has its own `form_invited` event). Noted only. | (note for case v1) | – | high |
| "Bounce flag is set" | :801 | Technical wording. | RENAME to "Email bounced" | S | low |
| Applications: "Application access required to open the live record." | :848 | Explains a permission on every card. | REMOVE (the card simply isn't clickable) | S | low |
| Header "Export CSV" | :514-522, :411-454 | A one-row CSV; the Candidates page export already includes these fields. | REMOVE | S | low |
| Header "Export PDF" | :523-531; :486, :496 | Title "Prospect Snapshot"; footer "Generated from the live recruiter prospect detail page." | KEEP; REWORD: "Candidate snapshot", drop footerNote | S | low |
| Header "Back to prospects" | :532-539, :298 | Wrong word, and wrong when opened from elsewhere. | RENAME to "Back" | S | low |
| Empty-state "Attach to requirement" shown disabled | :664-672 | A disabled primary button for users who can't attach. | SIMPLIFY: hide when `!canAttach` | S | low |
| Error/not-found "Prospect detail could not load" / "Prospect not found" | :267, :291 | Wrong term. | RENAME to "Candidate" | S | low |
| Delete confirm "…This is a restricted action."; Archive has no confirm | :353, :546 | Same as on the requirement page. | REWORD; consider a confirm on Archive | S | med |
| Full-screen spinner without sidebar while loading | :252-258 (same on requirement detail :337-343) | The sidebar flashes away on every detail open. The list pages keep it. | SIMPLIFY: render the sidebar in the loading state | S | low |

Checked and kept:
- Title (name), Archived and Deleted pills
- Attach to requirement picker
- Archive and Delete actions (permission and same-day gates)
- Details grid: rank, vessel type, nationality, experience, phone, email, lead source, first contacted
- Personal message + Send invite
- Applications list with reference, date, status badge and link

---

## Dashboard
(`/recruiter/dashboard`: `pages/RecruiterDashboardSimple.jsx`)

Verdict: the right home screen, but two stat cards repeat the sections below them and some cards link to the wrong place.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Header "Open KPI" (primary button) | RecruiterDashboardSimple.jsx:164-172 | Repeats the sidebar's "KPI" link right next to it. | REMOVE | S | low |
| Subtitle "Whole team" / "Your requirements, follow-ups and schedule" | :138-140, :202 | For managers the dropdown already says "Whole team". For recruiters the sentence explains the obvious. | REMOVE | S | low |
| Stat "Follow-ups due" | :216 | The same count as the "Follow-ups" section below. The link opens all active candidates, not the overdue follow-ups. | REMOVE (the section is the place) | S | low |
| Stat "Interviews and tests, 14 days" | :217 | The same count as the "Interviews and tests" section below. | REMOVE | S | low |
| Stat "Overdue" link | :214 | Opens the same unfiltered "open requirements" list as two other cards. | SIMPLIFY: link to the Requirements list sorted/filtered by on-time, or drop the link | S | low |
| Stat scope vs target list | :88-90 vs RecruiterRequirementsPage.jsx:74 | The Dashboard scopes a recruiter by `ownerId` (owner, else creator). The list's `?recruiter=` matches owner **or** creator. After an owner transfer, the counts differ. | SIMPLIFY: use one rule | S | low |
| Section subtitle "Most at risk first." | :224 | Says the obvious. | REMOVE | S | low |
| Section subtitle "Candidates in the pipeline with no activity for over 7 days." | :241 | Defines the rule, which is useful, but long. | REWORD to "No activity > 7 days" | S | low |
| Empty-state descriptions ("Every active candidate has had recent activity.", "No interviews or tests in the next 14 days.", "Every requirement is closed or cancelled.") | :232, :245, :283 | Repeat the titles. | REMOVE the descriptions | S | low |
| "Interviews and tests" section | :275-302 | Based on application-scheduled events. Case v1 moves scheduling to the case. Noted only. | (note for case v1) | – | – |
| Unused route param `:dashboardTab?` | App.jsx:240 | There are no tabs on this page. | REMOVE the param (outside this area; FYI) | S | low |

Checked and kept:
- Recruiter dropdown for managers
- Open requirements and Open positions cards
- "My requirements" progress table (limit 8, owner column for managers)
- Follow-ups list with stage pill and age
- "Showing the 8 longest-waiting of N"
- Upcoming events list
- "All requirements", "All candidates" and "Calendar" links

---

## KPI
(`/recruiter/kpi`: `pages/RecruiterKpiPage.jsx`, `components/charts/SimpleCharts.jsx`, `components/recruiter/RequirementProgressTable.jsx`)

Verdict: it does too much. There are 12 stat cards, a to-do list that belongs on Dashboard, a table that repeats Dashboard, and five export paths that overlap each other and the list pages.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| "Needs action now" section | RecruiterKpiPage.jsx:117-153, 537-619 | A to-do list, not insight. Overdue and near-target overlap the Dashboard. Application, invite, contract and event items ignore the Recruiter filter (they use unscoped `tracker.data`). "events today" is shown but left out of `total`. "All clear — nothing is waiting on you" is wrong for a manager view. | MOVE to Dashboard: only the items it lacks (stale review, unassigned, unclaimed invites, contracts ending). Remove the rest from KPI. | M | med |
| "Invites not claimed" card link | :598 | Opens the whole active pipeline; nothing filters to unclaimed invites. | Fix the link, or show the count without a link | S | low |
| "Requirements progress" table | :674-691 | The same component and rows as the Dashboard "Requirements" section. It also overlaps the overdue/near-target cards and the "Open requirements by age" chart. | REMOVE from KPI (keep on Dashboard) | S | low |
| Stat "Open requirements" | :623 | The 4th place this number appears (Requirements, Dashboard). | REMOVE | S | low |
| Stat "Active pipeline" | :670 | The same as Candidates "Active pipeline (n)". | REMOVE | S | low |
| Stat "Requirement closure" | :631-642 | All-time, while every card around it follows the period filter, and it has no period in its label. | RENAME to "Closure, all time", or follow the period | S | low |
| Cards linking to unfiltered lists | :624, :626, :669 | "Closed, this month" opens all closed requirements; "Joined, this month" and "Joined vs required" open all joined candidates. The counts don't match the destination. | SIMPLIFY: pass `from=` for period cards or drop the links | S | low |
| "Report date: <now>" box | :504-506 | Shows the current time. Adds no information. | REMOVE | S | low |
| Scorecard footer (4 sentences) | :749-754 | Explanatory text block ("Handling = live applications assigned via the Handled-by selector…"). | SIMPLIFY to one line: "Targets: 15–25 contacts/day, 8–12% conversion." | S | low |
| Header "Export summary" | :462-472, :369-418 | A fifth report sitting outside the Reports tab. | MOVE into the Reports tab as a card | S | low |
| Report "Requirement closure report (CSV)" | :290-318, :823-826 | Almost the same columns as the Requirements page "Export CSV" with status "All". | REMOVE | S | low |
| Report "Funnel drop-off report (CSV)" | :344-367, :835-838 | 8 rows that are already in the "Export summary" CSV ("Pipeline: <stage>") and the "Funnel by stage" chart. | REMOVE | S | low |
| Report "Weekly management report (PDF)" | :245-288 | Not weekly: uses all-time closure/conversion and current counts, ignoring the period. Its scorecard columns (Contacted today, Touched, Handling) differ from the on-screen scorecard. | RENAME to "Management report (PDF)" and align its scorecard columns with the screen | S | med |
| Report "Recruiter productivity report (CSV)" | :320-342 | Different metrics from the on-screen scorecard (all-time touched/conversion vs period). | SIMPLIFY: export exactly the on-screen scorecard columns | S | med |
| Report card titles "(PDF)/(CSV)" + descriptions + footer "All reports respect the recruiter filter above and are logged in the export audit trail. Generated …" | :817-845 | Wordy. The format can go on the button ("Download PDF"). | SIMPLIFY: title + button only; drop the footer | S | low |
| "Export permission required." repeated on every card | :853 | Shown 4 times to users without export permission. | SIMPLIFY: hide the Reports tab when `!canExportData()` | S | low |
| Conversion definitions | :392 (summary), :263 (PDF), :646 (card), :738 (scorecard), :336 (productivity CSV) | Three formulas under the same "Conversion" name. See the top of this file. | SIMPLIFY: one definition (the period cohort) everywhere, including Candidates | M | med |
| Chart subtitle "Where every live candidate currently sits." | :776 | Also inaccurate: it includes Joined, Rejected and Withdrawn. | REMOVE | S | low |
| Chart subtitle "Demand map — where sourcing effort is needed." | :796 | Explains the obvious. | REMOVE | S | low |
| Chart "Open requirements by age" colours | :784-787 | "Near target" uses the neutral accent colour while the milder "Past 50%" is amber, so severity looks reversed. | SIMPLIFY: use an ordered scale (green, amber, orange, red) | S | low |
| Chart "Time sitting in current stage" | :204-219, :803-810 | Uses `updated_at` as the stage start, so any edit resets it. Uses old application statuses (case v1 conflict). Ignores the Recruiter filter. | REMOVE (unreliable), or defer until case v1 | S | low |
| "Activity vs results" legend vs series labels | :763-769 | The legend says "Candidates contacted" / "Joins"; the series say "Contacted" / "Joined". | RENAME to match | S | low |
| Restricted state text | :441-442 | "Your account does not have analytics access. Ask a Master Recruiter if you need this dashboard." | REWORD to "No access to KPI." | S | low |
| Error "Could not load the live dashboard." | :518 | Wrong page name. | REWORD to "Could not load KPI." | S | low |
| `RequirementProgressTable` default empty description | RequirementProgressTable.jsx:56 | "Every requirement in scope is closed or cancelled." repeats the title. | REMOVE | S | low |
| `RequirementProgressTable` "Candidates by stage" bar | RequirementProgressTable.jsx:19-47 | Built from junction statuses; will diverge from cases. Noted only. | (note for case v1) | – | – |

Checked and kept:
- Overview / Charts / Reports tabs
- Recruiter filter and Period segment
- Stat cards: Closed in period, Open positions, Joined vs required, Conversion (with target pill), Avg days to join, Contacted today, Contacted in period, Joined in period, Avg client response
- Recruiter scorecard table (unique to KPI)
- Charts: Activity vs results trend, Funnel by stage, Open requirements by age, Open positions by rank
- Reports: Weekly PDF and Productivity CSV (after fixes)
- SimpleCharts components (HBarChart, TrendChart, ColumnChart, ChartLegend: minimal, no dependencies)

---

## Top 10
Best value for the least effort, in order:

1. **Remove both Activity feeds.** Requirement detail `RecruiterRequirementDetail.jsx:698-718` and Candidate detail `RecruiterProspectDetail.jsx:859-879`. They repeat Remarks/Notes, the junction lists and Applications, with "Junction …" jargon. (S, low)
2. **Remove the stat-card rows on both detail pages.** `RecruiterRequirementDetail.jsx:522-527` and `RecruiterProspectDetail.jsx:607-612`. They only count lists on the same page. Move "Last activity" and "x / y filled" into the header pills. (S, low)
3. **Remove "Requirements progress" from KPI.** `RecruiterKpiPage.jsx:674-691`. It is the same table as the Dashboard. (S, low)
4. **Cut the KPI exports to two or three in the Reports tab.** Remove the Closure CSV (= Requirements "Export CSV") and the Funnel CSV (subset of the summary). Move "Export summary" into the tab. Hide the tab without export permission. Drop the footer text. (S, low)
5. **Remove the one-row "Export CSV" on both detail pages.** Each is a subset of the list-page export. Keep the PDFs and drop their "Generated from the live…" footers. (S, low)
6. **Use "candidate" instead of "prospect" in all UI text.** Includes "Back to prospects/requirements" → "Back", "Prospects attached…", "Open prospect", PDF titles, and the error/not-found states. Rename the jargon headings too ("Requirement matches and junction history" → "Requirements", "Internal and transition notes" → "Notes", "Last transition by" → "By"). (S, low)
7. **Remove stat cards that repeat a segment count or a section on the same page.** Requirements "Open requirements"; Candidates "Active pipeline" and "Joined"; Dashboard "Follow-ups due" and "Interviews and tests"; KPI "Open requirements" and "Active pipeline". Also remove Dashboard "Open KPI" and KPI "Report date". (S, low)
8. **Use one Conversion formula and one Avg-days-to-join scope everywhere.** Remove the Candidates-page versions; align the Weekly PDF and productivity CSV with the on-screen scorecard. (M, med: reported numbers change)
9. **Move "Needs action now" from KPI to Dashboard.** Bring only what the Dashboard lacks (stale review, unassigned, unclaimed invites, contracts ending) and scope it by recruiter. KPI becomes insight-only. (M, med)
10. **Cut the explanatory text.**
    - Scorecard footer → one line of targets.
    - Remove the chart subtitles ("Where every live candidate…", "Demand map…").
    - Remove the empty-state descriptions that repeat titles (requirement detail ×2, candidate detail ×2, Dashboard ×3, cases panel).
    - Remove the "Internal" badges.
    - Remove the toggle help "If checked, previous employer stays optional."
    - Rename the invite heading to "Invite" and hide the panel without permission. (S, low)

Also flagged (not in the top 10 because it needs a decision first): `RecruitmentCasePanel.jsx:44` lets anyone with `create_prospects` open cases, and the "read only" label ignores this. If Coordinators hold that permission, this breaks the rule that Coordinators are read-only. Verify. (S, high)
