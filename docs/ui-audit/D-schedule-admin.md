# D: Schedule, admin, recruiter auth and routes

Scope: Calendar, Expiry, Settings (Team, Integrations, Worksheet templates), recruiter auth pages, Microsoft OAuth callback, Cleanup drafts, and route aliases in `src/App.jsx`. All paths below are relative to `src/`.

---

## Calendar (`/recruiter/calendar`, `/recruiter/events`, `/dashboard/calendar`; pages/CalendarDashboardPage.jsx, components/dashboard/CalendarDashboard.jsx)

Verdict: The screen is useful and read-only, so it is safe for Coordinators. It has a mislabelled person field, two extra routes, three copies of the same role check, and several text lines that repeat each other.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Person line on each event card: `{event.profiles?.full_name \|\| 'Applicant'}` | CalendarDashboard.jsx:130-133, 488 | **Bug.** The data comes from `profiles!scheduled_events_scheduled_by_fkey`, which is the recruiter who scheduled the event, not the applicant. Recruiters read their own name where the applicant's should be. | REWORD to `By {name}`, or REMOVE the line. Do not label it Applicant. | S | low |
| Search placeholder `"Search by applicant, rank, reference, platform..."` | CalendarDashboard.jsx:358 | The applicant name is not in the fetched data, so the promise is false. Search actually matches the scheduler's name and email. | REWORD to `Search reference, rank…` | S | low |
| Event card has no link to the application | CalendarDashboard.jsx:477-552 | The recruiter sees "Test - REF123" and has to find the application by hand. The row could link to the existing `/application/view/:public_token` page, as RecruiterApplications.jsx:1011 does. | SIMPLIFY: add `public_token` to the `applications(...)` select and make the title a link | S | low |
| Subtitle repeats the reference: `… • {reference_number}` | CalendarDashboard.jsx:488 | The title is already `"{type} - {reference_number}"` (set in TestSchedulingModal.jsx:69 and InterviewSchedulingModal.jsx:358), so the reference appears twice. | REMOVE the reference from the subtitle | S | low |
| Month label shown twice | CalendarDashboard.jsx:298 (header nav) and 376 (`<h2>` above the grid) | Duplicate. | REMOVE the h2 at :376 and keep the nav label | S | low |
| `"{n} events in this month"` | CalendarDashboard.jsx:378-380 | The dots in the grid already show this. Low value. | REMOVE | S | low |
| Type chips `All events (n) / Interviews (n) / Tests (n)` | CalendarDashboard.jsx:332-348 | The counts are for every event ever loaded, not the visible month, so they don't match the grid. | SIMPLIFY: drop the counts. Labels become `All / Interviews / Tests` | S | low |
| `"Last synced HH:MM"` / `"Sync pending"` | CalendarDashboard.jsx:362-366 | This is not a sync. It is the time of the last page fetch, and a Refresh button is right next to it. | REMOVE | S | low |
| `Current month` button | CalendarDashboard.jsx:309-317 | It also selects today, so the label undersells what it does. | RENAME to `Today` | S | low |
| Agenda subline `"No scheduled interviews or tests for this date."` plus the empty box `"No events on this date"` | CalendarDashboard.jsx:457-461, 466-469 | Two empty messages on screen at once. | REMOVE the subline on empty days and keep the box (or the reverse) | S | low |
| Dead fallbacks `'Time TBD'`, `'Pending reference'`, `'Rank pending'` | CalendarDashboard.jsx:518, 485, 524 | Events with no date are filtered out (:172), so `Time TBD` can never show. The other two are filler text. | SIMPLIFY: render nothing or `—` | S | low |
| Error box title `"Error Loading Calendar"` and button `"Refresh events"` | CalendarDashboard.jsx:270, 276 | Title Case and wordy. | REWORD to `Couldn't load calendar` and `Retry` | S | low |
| Role checks in three places | App.jsx:197-213 (ProtectedRoute), CalendarDashboardPage.jsx:23-37 (inline "Access Denied" panel), CalendarDashboard.jsx:156-157, 260-262 | The route already allows only these three roles, so the page panel and the component redirect can never run. That is dead UI and duplicated logic. | REMOVE the page and component checks; keep the route guard | S | low |
| Loading text `"Loading calendar workspace..."` (twice) | CalendarDashboardPage.jsx:17, CalendarDashboard.jsx:254 | Two loaders in a row, and "workspace" is leftover wording. | SIMPLIFY to one spinner with no text | S | low |
| No-show outcome not shown | CalendarDashboard.jsx:493-507 | InterviewResultModal.jsx:115 sets `outcome: 'no_show'`, but the calendar shows the event as a plain "Past event". | KEEP for now and note it. Recruitment case v1 will own outcomes; see the conflict note | — | — |
| Event date can land on the wrong day | TestSchedulingModal.jsx:49/72, InterviewSchedulingModal.jsx:319/362, TestResultModal.jsx:213/221 | `scheduled_date` is stored as `toISOString()` (a UTC date), but `scheduled_time` is stored as local time. In IST, slots before 05:30 are saved on the previous day, and the calendar (:65-68) shows them there. The bug is outside this screen but shows up here. | Fix in the scheduling modals: build the date from the form string, not from the ISO value | S | med (data) |
| **v1 conflict** | CalendarDashboard.jsx:122-136 | The calendar reads only `scheduled_events` keyed by `application_id`. Once test and interview scheduling moves to the recruitment case, case-scheduled events will not appear unless they also write `scheduled_events` or the calendar reads the case. | Note only. Do not redesign | — | — |

Checked and kept: the month grid, prev/next buttons, Refresh, type filter (without counts), search box, per-day dots and count badge, agenda card (icon, type badge, relative time, time, rank, meeting link, notes), and Coordinator access (the page is read-only).

---

## Expiry (`/dashboard/expiry`; pages/ExpiryDashboardPage.jsx, components/dashboard/ExpiryDashboard.jsx)

Verdict: The screen is needed. It should move to a `/recruiter/...` URL, lose its duplicate checks and extra columns, and fix one crash path.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Route `/dashboard/expiry` | App.jsx:191-195, RecruiterSidebar.jsx:76, lib/theme.js:3 | This is a recruiter screen inside the applicant `/dashboard` namespace, and theme.js needs a special case for it. | MOVE to `/recruiter/expiry`. Update the sidebar and theme.js and drop the prefix (theme.js says to keep index.html's inline script in sync) | S | low |
| Severity badge `config.badgeColor` | ExpiryDashboard.jsx:321, 354 | If the view returns an `urgency_level` outside the 4 known keys (null or a new tier), `config` is undefined and the whole page throws. | SIMPLIFY: fall back with `URGENCY_CONFIG[x] \|\| URGENCY_CONFIG.all` | S | low |
| Row not linked to the application | ExpiryDashboard.jsx:325-358 | The recruiter can't open the seafarer's documents from the row. | SIMPLIFY: link the applicant name to `/application/view/:public_token`. This needs `public_token` in `v_expiring_documents` | M | low |
| `Type` column | ExpiryDashboard.jsx:313, 333-338 | Mostly repeats `Document` (for example "Passport" / "Passport"). | MERGE into the Document cell, showing the type only when it differs from the name | S | low |
| Per-cell icons (FileText, Calendar, Clock) | ExpiryDashboard.jsx:335, 341, 347 | Decoration in every row, which is noise on a compact dark table. | REMOVE | S | low |
| `"{n} days remaining"` / `"{n} days overdue"` | ExpiryDashboard.jsx:348-350 | Wordy in a column already headed "Days". | REWORD to `{n}` and `{n} overdue` | S | low |
| Reference fallback `'N/A'` | ExpiryDashboard.jsx:329 | — | REWORD to `—` | S | low |
| Card subtext `All: "Next 90 days"` | ExpiryDashboard.jsx:14 | Wrong: "All" also counts already-expired documents. | REWORD to `≤ 90 days` or drop all five descriptions; the labels are enough | S | low |
| Critical and Urgent use the same colour | ExpiryDashboard.jsx:22-33 | Both are `warning`, so the two tiers look identical. | SIMPLIFY: merge them into one "Due ≤ 60 d" tier in the UI, or give one a different tone | S | low |
| `"{n} documents"` h2 above the table | ExpiryDashboard.jsx:273-275 | Repeats the count on the selected filter card. | REMOVE | S | low |
| `"Last synced HH:MM"` | ExpiryDashboard.jsx:217-221 | Same as Calendar: fetch time shown next to a Refresh button. | REMOVE | S | low |
| `Send expiry warnings` button | ExpiryDashboard.jsx:226-234 | One click sends emails to seafarers, with no confirm. If `process-expiry-warnings` already runs on a schedule (not visible in this copy), the button is a duplicate. | KEEP only if there is no cron and add `confirm()`. Otherwise REMOVE | S | med (sends email) |
| Result banner (raw function message) | ExpiryDashboard.jsx:239-243 | Shows whatever the function returns. | KEEP, but make it a short "Sent n" message | S | low |
| Role checks in four places | App.jsx:191 (route), ExpiryDashboardPage.jsx:16-22 (`!user` effect), :37-51 ("Access Denied" panel), ExpiryDashboard.jsx:176-178 | The route already enforces login and role, so the other three can never run. | REMOVE all but the route | S | low |
| Loading text `"Loading expiry workspace..."` and `"Loading expiring documents..."` | ExpiryDashboardPage.jsx:30, ExpiryDashboard.jsx:170, 185 | Three loaders in a row. | SIMPLIFY to one spinner | S | low |
| `"Error Loading Expiry Data"` / `"Refresh data"` | ExpiryDashboard.jsx:197, 203 | Title Case. | REWORD to `Couldn't load` and `Retry` | S | low |
| Coordinator access | App.jsx:192, RecruiterSidebar.jsx:76 | Coordinators are fully blocked, even though the list is read-only data. | Open question for the owner. If they should see it, allow the route and hide only "Send expiry warnings" | S | med (permissions) |

Checked and kept: the page title "Document expiry", Refresh, the urgency filter cards (as filters), search, the Applicant / Reference / Document / Expiry / Days / Severity columns, the "All clear" empty state, and the "No matching documents" state.

---

## Settings (`/recruiter/settings`, `/recruiter/team`; pages/RecruiterSettings.jsx, pages/RecruiterTeam.jsx)

Verdict: Three cards that each toggle a hidden panel, so the page opens empty. Two of the three permission checks are no-ops, and `/recruiter/team` is an unlinked redirect.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Card grid that opens and closes sections; nothing open by default | RecruiterSettings.jsx:38-40, 57-115 | You always need an extra click, and clicking the active card closes it again. Three big cards for three links. | SIMPLIFY to a 2-3 item tab row with Team open by default (`?section=` still works) | S | low |
| `visible: canManageTeam()` and `canManageTeam() &&` | RecruiterSettings.jsx:63, 117 | `canManageTeam` is the same check as `canManageSettings` (usePermissions.js:17 vs 28), which is the page's entry check, so these are always true. | REMOVE | S | low |
| Inline permission expression | RecruiterSettings.jsx:53 | Repeats `canManageSettings()` by hand. | SIMPLIFY to `role === 'Master Recruiter' \|\| canManageSettings()` (same as sidebar :54) | S | low |
| Scroll-into-view effect and three refs | RecruiterSettings.jsx:17-36 | Only needed because of the card-then-panel layout. | REMOVE together with the tab change | S | low |
| `"Loading settings workspace..."` | RecruiterSettings.jsx:47 | Leftover "workspace" wording. | SIMPLIFY to a spinner | S | low |
| `/recruiter/team` route and pages/RecruiterTeam.jsx | App.jsx:276-280, RecruiterTeam.jsx:4 | Not linked anywhere (grep). It only redirects to `?section=team`. | REMOVE the route and the file. The catch-all handles old bookmarks | S | low |

Checked and kept: the PageHeader "Settings" title and the sidebar entry (Master or settings permission only).

### Team section (components/recruiter/RecruiterTeamSection.jsx)

Verdict: Too much chrome for a team of a handful of people, and two different ways to reset a password.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| 4 stat cards (Total / Master Recruiters / Recruiters / Coordinators) | RecruiterTeamSection.jsx:183-206 | For 3-6 people the list itself answers this. No value. | REMOVE | S | low |
| `"Recruiter accounts"` h2 | :209-211 | The tab is already "Team". | REMOVE | S | low |
| Same avatar icon tile on every row | :219-221 | Pure decoration. | REMOVE | S | low |
| `"Joined {date}"` | :241-248 | Rarely useful. | REMOVE, or keep it muted. Low priority | S | low |
| `Send reset email` shown only on **Master Recruiter** rows | :255-265 | Other roles get a password reset by typing a new password in Edit. Two different reset paths depending on role, and the reset-email path (the safer one) is the one hidden for most people. | SIMPLIFY: show "Send reset email" on every non-self row and remove the password field from Edit (see below) | S | med (admin workflow) |
| Last-Master guard repeated three times: disabled button, inline text `"Promote another master recruiter first."`, and `alert()` | :279, :285-287, :89-92 | Duplicate guard. | REMOVE the inline text and the alert; keep the disabled button with a `title` | S | low |
| Empty state `"No recruiter accounts yet"` / `"Add First Team Member"` | :295-312 | Can't happen: the signed-in Master is always in the list. | REMOVE | S | low |
| `alert('Team member removed successfully')` | :114 | The list refresh already shows the result. | REMOVE | S | low |
| `"Loading team workspace..."` | :178 | — | SIMPLIFY to a spinner | S | low |
| `embedded` prop and non-embedded header branch | :26, 156-162 | The only caller passes `embedded` (RecruiterSettings.jsx:119). | REMOVE the prop and the dead branch | S | low |

Checked and kept: "Add member", the role badge, the "You" badge, email, Edit, Remove with confirm, and the self-row protection.

### Create member modal (components/recruiter/CreateRecruiterModal.jsx)

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Note `"Credential handoff — A password is shown after creation."` | :148-153 | Explains something that happens anyway. | REMOVE | S | low |
| Success `alert` with emoji and the password: `"✅ Recruiter Created Successfully! 📧 … 🔑 … ⚠️ Please save these credentials…"` | :103 | Wordy, uses emoji, and the password is hard to copy from an alert. | REWORD to a plain short alert (`Created. Password: …`) or show it in the modal with a Copy button | S | low |
| Password hint `"At least 6 characters."` | :200 | Setup and reset require 8 (RecruiterSetup.jsx:66, RecruiterResetPassword.jsx:36), and this modal checks nothing. | REWORD to `Min 8` and add `minLength={8}` | S | low |
| Titles: trigger `Add member`, modal title `Add Team Member`, submit `Create Recruiter` | RecruiterTeamSection.jsx:170, :138, :255 | Three names for one action. | RENAME all three to `Add member` | S | low |
| Placeholders `"recruiter@example.com"`, `"John Doe"` | :164, :176 | Filler. | REMOVE | S | low |
| Debug `console.log` blocks | :63-68, 84-87, 108-111 | Noise in the console. | REMOVE | S | low |

Checked and kept: Email, Full name, Password plus Generate, Role select (defaults to Recruiter), and the role description hint (from `roles.description`; check its wording in the DB).

### Edit member modal (components/recruiter/EditRecruiterModal.jsx)

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| `console.log('Form data:', formData)` / `('Sending body:', updateBody)` | :70-74, 84-87 | **Security: logs the new password in plain text** to the browser console. | REMOVE now | S | low |
| Subtitle `"Update role coverage or reset credentials for {email}."` | :138-140 | Wordy. | REWORD to `{email}` | S | low |
| `Keep current role` option and hint `"Current role: {role}"` | :169, :176 | The select already starts on the current role, so both are redundant. | REMOVE both | S | low |
| `New Password` field, Generate button, hint `"Only enter a value if you want to issue a fresh password."` | :179-199 | The hint repeats the placeholder. If reset email becomes the only reset path (Team section), this whole field goes. | REMOVE (paired with the Team change); at least drop the hint | S | med (admin workflow) |
| `alert('✅ Updated successfully: …')` | :106 | Uses emoji, and shows "Updated successfully: " with an empty list when nothing changed. | REMOVE (the list refresh is enough), or disable Save when nothing changed | S | low |

Checked and kept: Full name, Role, Save / Cancel.

### Integrations section (components/recruiter/RecruiterIntegrationsSection.jsx, services/runtimeSettingsService.js)

Verdict: A developer-level secrets editor (Microsoft, Email, AI, App URLs and keys) inside a recruiter admin screen. A small team's Master Recruiter will not set Graph client IDs or AI keys.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| The whole "Integrations" card and section | RecruiterSettings.jsx:65-71, 123-127 | Values are read at runtime with env fallbacks (runtimeSettingsService.js:32-35). Removing the UI only removes editing, which the owner can do in Supabase. | REMOVE from Settings. Fallback if the owner wants it: Master-only plus the rewording below | S | med (config access) |
| Heading `"Integrations & Secrets"` plus decorative Settings2 icon tile | :190-197 | The card already says "Integrations". | REMOVE (if the section is kept) | S | low |
| Placeholder `"Saved (masked) — enter a value to replace"` | :33 | Wordy, and the Configured badge already says it is saved. | REWORD to `••••••` | S | low |
| `"Settings saved successfully."` | :161 | — | REWORD to `Saved` | S | low |
| `"Loading integration settings..."` | :182 | — | SIMPLIFY to a spinner | S | low |

Checked and kept (if the section stays): per-group Save, Configured/Missing badge, show/hide toggle.

### Worksheet templates section (components/recruiter/RecruiterWorksheetMappingsSection.jsx)

Verdict: Needed for worksheet export, but it shows internals and has fields that are saved and never read.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Heading `"Customer Templates & Mappings"` plus FileSpreadsheet icon tile | :220-227 | The tab is already "Worksheet templates". | REMOVE | S | low |
| `Template notes (optional)` textarea | :302-308 | Saved (worksheetConfigService.js:122) but never displayed anywhere (grep). | REMOVE | S | low |
| `"Source format: .{ext}"` | :289-291 | Uploads accept only `.xlsx` (:315), so it always says .xlsx. | REMOVE | S | low |
| Template status box (label plus a sentence, e.g. `"The uploaded XLSX template is ready for worksheet generation."`, `"Select a customer to manage its worksheet template."`) | :44-72, 292-298 | The file name line above already says whether a template exists. | SIMPLIFY to file name plus a `Ready` / `No template` pill | S | low |
| `Refresh` button on Active Template | :277-285, 183-192 | An upload already reloads the customers (:168). Nothing else changes the status. | REMOVE | S | low |
| Mapping row subline `{sheet_name} · {source_path} · {transform}` | :355-357 | Developer internals (JSON paths, transform names). | SIMPLIFY to the sheet name only | S | low |
| Separate card that holds only `"{Customer} Mapping"` and `Save Mapping` | :325-342 | A whole card for a title and a button. | MERGE: put Save in the section header and drop the title (the customer is in the select) | S | low |
| `"Worksheet mappings saved successfully."`, `"Customer added successfully."`, `"Template uploaded successfully."` | :132, 148, 172 | — | REWORD to `Saved` / `Added` / `Uploaded` | S | low |

Checked and kept: Customer select, Add customer, Upload XLSX, per-field cell inputs grouped by section.

---

## Recruiter sign in (`/recruiter/login`; pages/RecruiterLogin.jsx)

Verdict: Already lean. A few long messages and one off-theme banner.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Applicant banner `"This browser is signed in as an applicant. Recruiter access requires a separate recruiter account."` | :123-127 | Hard-coded `amber-200/amber-50/amber-900` on the dark recruiter theme. Wordy. | REWORD to `Signed in as an applicant.` and use `warning-soft` tokens | S | low |
| Forgot-password error `"This is your applicant account. Applicants sign in with a magic link; enter a recruiter email to reset a recruiter password."` | :94-97 | Long. | REWORD to `That's an applicant email.` | S | low |
| Comment `// ✅ Added useEffect` | :1 | Leftover. | REMOVE | S | low |

Checked and kept: title "Recruiter sign in", Email, Password, "Forgot?", Sign in, errors, the reset message.

## Recruiter setup (`/recruiter/setup`; pages/RecruiterSetup.jsx)

Verdict: A one-time bootstrap page (not linked anywhere) built as a two-panel marketing-style layout with four notes. Keep the route for fresh environments, but cut it down to the same `AuthLayout` card as sign in.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Two-panel layout: left panel with Shield tile, `"Create the master recruiter account"` and the note `"Locked after completion — This page locks once the account is created."` | :204-222 | Explains something the user never needs to act on. | SIMPLIFY to `AuthLayout title="Create admin account"` and REMOVE the note | S | low |
| `"Account details"` h2 | :225-227 | Duplicate heading. | REMOVE | S | low |
| Note `"Access level — Full admin access, including managing recruiters."` | :297-302 | Not needed. | REMOVE | S | low |
| Loading `"Preparing recruiter setup"` / `"Checking setup…"` | :131-147 | Use `AuthLoading`, as the login page does. | SIMPLIFY | S | low |
| Already-complete screen: `"Setup already complete"` plus `"Setup is complete. This page is locked."` plus an **empty** `"Next step"` note (title, no body) | :149-174 | Duplicate lines and a leftover broken note. | SIMPLIFY to the title plus a `Sign in` button | S | low |
| Success screen with `"Account ready"` note and `"Redirecting to login page in 3 seconds..."` | :176-201, 112-114 | Too much ceremony. | SIMPLIFY: navigate to `/recruiter/login` right away (or show the title and a button) | S | low |
| Placeholders `"John Doe"`, `"admin@company.com"`, `"Minimum 8 characters"`, `"Re-enter password"` | :240, 254, 270, 285 | Filler; `minLength` already enforces 8. | REMOVE (keep at most `Min 8`) | S | low |
| Raw `fetch` with anon key | :27-38, 70-86 | Every other edge-function call uses `supabase.functions.invoke`. | SIMPLIFY (maintainability) | S | low |

Checked and kept: Full name, Email, Password, Confirm, submit, server-side lock.

## Reset password (`/recruiter/reset-password`; pages/RecruiterResetPassword.jsx)

Verdict: Lean. Only two long messages.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| `"A verified recruiter recovery session is required. Please request a fresh password reset email for your recruiter account."` | :27 | Long. In practice it is unreachable, because the `!user` branch at :96 already hides the form. | REWORD to `Link expired. Request a new one.` | S | low |
| Applicant text `"This browser is signed in as an applicant. Applicants use emailed magic links. To reset a recruiter password, request a link for a separate recruiter account and open it in a private window."` | :68-70 | Three sentences. | REWORD to `Signed in as an applicant. Open the reset link in a private window.` | S | low |

Checked and kept: title, both fields, "Update password", expired-link message, "Back to sign in", success redirect.

## Unauthorized (`/unauthorized`; pages/Unauthorized.jsx)

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| `"Permission Required"` eyebrow plus `"Access Denied"` plus two explanation lines plus `"If you believe this is an error, contact support."` | :26-55 | Five text lines for "no access". | SIMPLIFY to the title `No access` and the button | S | low |
| Logged-out fallback goes to `/applicant/login` | :15 | Everything else sends logged-out users to `/recruiter/login` (App.jsx:47, 110). | REWORD the target to `/recruiter/login` | S | low |

## Microsoft OAuth callback (`/auth/microsoft/callback`; pages/MicrosoftOAuthCallback.jsx)

Verdict: **This is wired and in use.** InterviewSchedulingModal.jsx:151-180 (opened from SequentialStatusControl on RecruiterApplications and ViewApplication) sends the user to Microsoft. The callback calls the `microsoft-oauth-callback` edge function, then returns to `/recruiter/applications?teams_connected=true`, and RecruiterApplications.jsx:143-167 reopens the modal. Keep it, but trim it.

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Debug `console.log` lines with emoji | :25, 34, 41, 55, 58, 68-70, 74, 78-79, 86 | Noise. | REMOVE | S | low |
| Status text stack: `"Connecting..."` heading, message, `"Please wait..."`, `"Redirecting to applications..."` / `"Redirecting back..."`, plus a `Go to Applications` button and a 2-3 s timer | :114-139, 73-76 | Four lines and a button for an automatic hop. | SIMPLIFY: on success redirect immediately; on error show the title, the message, and one button | S | low |
| Always returns to `/recruiter/applications` | :28, 37, 61, 75, 83, 89, 134 | If scheduling started on ViewApplication, the user lands on the list. The modal reopens only if that application is on the loaded page (RecruiterApplications.jsx:155). | SIMPLIFY: store the return path (not just the app id) before the redirect and go back to it | M | med (workflow) |
| `state` = raw user id, sent to the edge function as `userId` | InterviewSchedulingModal.jsx:178, MicrosoftOAuthCallback.jsx:20, 50 | No CSRF nonce. If the edge function trusts `userId` from the body instead of the caller's JWT, tokens could be bound to the wrong user. The function is not in this copy, so this is unverified. | Open question. The edge function should derive the user from the JWT | M | high (auth) |
| Public route with a light `public-shell` | App.jsx:182, :94 | A recruiter-only flow shown in the applicant (light) theme. | MOVE under `RecruiterRoute`, or add `/auth/microsoft` to the dark prefixes | S | low |
| Hard-coded project URL `https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/refresh-microsoft-token` | InterviewSchedulingModal.jsx:111, 228 | Breaks in any other environment. | SIMPLIFY to `supabase.functions.invoke('refresh-microsoft-token')` | S | low |
| **v1 conflict** | RecruiterApplications.jsx:143-167, InterviewSchedulingModal.jsx:154 | The reopen-after-OAuth handoff (`reopen_interview_modal` plus `teams_connected`) is tied to the application-status scheduling flow. When scheduling moves to the case, it has to move too. | Note only | — | — |

## Cleanup drafts (`/cleanup-drafts`; pages/CleanupDrafts.jsx)

Verdict: **Dead and broken. Remove it.**

| Element | Where (file:line) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|
| Whole page and route | App.jsx:185-189, CleanupDrafts.jsx, lib/theme.js:3 | Not linked anywhere (grep). The route allows only Recruiter and Master, but the code deletes drafts where `user_id = current user` (:28), and recruiters have no applicant drafts, so it does nothing. Its "Back to Dashboard" buttons go to the applicant `/dashboard` (:80, 132), which bounces recruiters. It is styled `applicant-shell` on a dark route, and its copy shows table names and emoji (`"Deletes older duplicate rows from \`application_data\`…"`, `"🔍"`, `"✅"`). | REMOVE the route, the file, and the theme.js prefix | S | low |

---

## src/App.jsx: routes and aliases

Verdict: Six aliases or redirects can go. The catch-all `*` → `/` → RootRedirect already sends logged-out users to `/recruiter/login`, recruiters to `/recruiter/dashboard`, and applicants to `/dashboard`. Two guard components do the same job.

| Element | Where (file:line) | Linked from (grep) | Findings | Decision | Effort | Risk |
|---|---|---|---|---|---|---|
| `/recruiter/events` | App.jsx:203-207 | nowhere | Third copy of the Calendar route; the sidebar won't even highlight on it (RecruiterSidebar.jsx:75, 83). | REMOVE | S | low |
| `/dashboard/calendar` | App.jsx:209-213, theme.js:3 | only theme.js | Legacy alias in the applicant namespace. | REMOVE, and remove the theme prefix | S | low |
| `/login` → `/recruiter/login` | App.jsx:173 | nowhere | The catch-all already gives the same result for logged-out users. | REMOVE | S | low |
| `/application/success` → `/dashboard` | App.jsx:320-321 | nowhere | The catch-all gives the same result for applicants. | REMOVE | S | low |
| `/recruiter/prospects` → `/recruiter/candidates` | App.jsx:288-292, RecruiterSidebar.jsx:61 (match only) | nowhere | Old bookmark alias. Without it, the catch-all lands on the dashboard instead. | REMOVE, and the `match` entry | S | low |
| `/recruiter/workspace` (WorkspaceRedirect) | App.jsx:144-147, 221-226 | nowhere | The Workspace page was merged; this is a bookmark-only alias. | REMOVE | S | low |
| `/recruiter/dashboard/prospects/:id`, `/recruiter/dashboard/requirements/:id` (and their two redirect components) | App.jsx:149-157, 264-274 | nowhere | Old detail URLs. They may sit in old emails; the edge-function templates are not in this copy. | REMOVE once the email templates are confirmed not to use them | S | low |
| `/recruiter/dashboard/:dashboardTab?` optional param | App.jsx:240 | — | RecruiterDashboardSimple never reads it (no `useParams`), so the tab URLs are dead. | SIMPLIFY to `/recruiter/dashboard` | S | low |
| `/recruiter/team` | App.jsx:276-280 | nowhere | See Settings. | REMOVE | S | low |
| `/cleanup-drafts` | App.jsx:185-189 | nowhere | See Cleanup drafts. | REMOVE | S | low |
| `/dashboard/expiry` | App.jsx:191-195 | sidebar | See Expiry. | MOVE to `/recruiter/expiry` | S | low |
| `ProtectedRoute` (used only by cleanup, expiry, and the 3 calendar routes) vs `RecruiterRoute` | App.jsx:38-59 vs components/auth/RecruiterRoute.jsx | — | Two guards. Once the routes above are gone, only Calendar (all 3 roles = RecruiterRoute) and Expiry (no Coordinator) remain. | MERGE: give RecruiterRoute an optional `roles` prop and delete ProtectedRoute | S | med (permissions) |
| `/recruiter/workspace/prospects/:id`, `/recruiter/workspace/requirements/:id` | App.jsx:228-238 | about 10 link sites | These are the live detail URLs but carry the dead "workspace" name. | Optional RENAME to `/recruiter/candidates/:id` and `/recruiter/requirements/:id`. Low value, so not in the Top 10 | M | low |
| Blank/unindented block between routes | App.jsx:183-213 | — | Formatting only. | Tidy along with the removals | S | low |

Checked and kept: `/`, `/applicant/login`, `/auth/callback`, `/privacy-policy`, `/terms-conditions`, `/recruiter/login`, `/recruiter/setup`, `/recruiter/reset-password`, `/unauthorized`, `/auth/microsoft/callback`, `/recruiter/applications`, `/recruiter/kpi`, `/recruiter/requirements`, `/recruiter/candidates`, `/recruiter/settings`, `/application/view/:publicToken`, applicant `/dashboard`, `/application/form/section/:sectionId`, `/application/review`, ErrorBoundary copy, and the catch-all.

Note: the internal storage keys `njord-auth-token`, `njord-authz-cache` and `njord-active-draft-*` (lib/supabase.js:16, AuthContext.jsx:6-7, utils/draftSession.js:1-2) are not visible to users. Renaming them signs everyone out and drops local drafts, so leave them alone.

---

## Top 10

1. **Stop logging new passwords to the console.** Remove the logs in EditRecruiterModal.jsx:70-74 and 84-87, and the debug logs in CreateRecruiterModal and MicrosoftOAuthCallback. S, low.
2. **Fix the calendar person label.** It shows the recruiter who scheduled the event as the "Applicant" (CalendarDashboard.jsx:488). Change it to `By {name}` or remove it, and fix the search placeholder at :358. S, low.
3. **Remove `/cleanup-drafts`** (route, page, theme prefix). It is dead and does nothing for recruiters. S, low.
4. **Remove the dead route aliases** `/recruiter/events`, `/dashboard/calendar`, `/login`, `/application/success`, `/recruiter/prospects`, `/recruiter/workspace`, `/recruiter/team`, and the `:dashboardTab?` param. The catch-all and RootRedirect already cover them. S, low.
5. **Remove the duplicate role checks and inline "Access Denied" panels** in the Calendar and Expiry pages and components, which can never run. S, low.
6. **Settings: replace the toggle cards with tabs, Team open by default.** Remove the 4 team stat cards, the "Recruiter accounts" h2, the avatar tiles, the impossible empty state and the duplicate last-Master guards. S, low.
7. **Remove the Integrations & Secrets section from Settings** (developer config; values already fall back to env). If the owner wants to keep it, make it Master-only. S, med.
8. **Trim the worksheet templates section.** Remove the notes field that is never read, "Source format", the Refresh button, the status sentences and the internal `source_path · transform` text, and move Save into the section header. S, low.
9. **Expiry: move to `/recruiter/expiry`, guard against an unknown `urgency_level` (crash), merge Type into Document, drop the cell icons, "Last synced" and the h2 count, and add a confirm to "Send expiry warnings"** (or remove the button if a cron already sends them). S, low/med.
10. **Recruiter setup: cut it down to a single `AuthLayout` card.** Remove the four notes, including the empty "Next step" box, and the 3-second redirect screens. Also shorten the long applicant messages on login and reset, and the Unauthorized page. S, low.

Open questions for the owner: (a) Does `microsoft-oauth-callback` trust the `userId` from the request body? It should use the caller's JWT. (b) Is `process-expiry-warnings` already on a schedule? (c) Should Coordinators see Expiry read-only? (d) Do any email templates still link `/recruiter/dashboard/prospects/:id` or `/login`?
