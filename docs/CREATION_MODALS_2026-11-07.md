# Creation modal UI follow-up — 2026-11-07

The pending platform candidate now includes the accepted matching/review-only
phase in `MATCHING_REVIEW_RELEASE_2026-11-07.md`: New requirement is available;
New candidate is intentionally disabled until intake is connected. Earlier
synthetic creation tests below qualify the modal implementation, not permission
to enable intake in this phase. The independent UI-only branch remains separate.

## Scope and release state

The isolated `codex/recruiter-creation-modals` branch starts at production Holmes
`747d434` and changes presentation only. No schema, Function, permission or save
service change is required. This UI change can be promoted independently of the
platform intake service after review. It is not yet committed or deployed.

The same wrapper is carried into the pending `codex/platform-resume-intake`
checkout, preserving its résumé/identity/upload/Draft behavior. Refreeze that
amended checkout before its eventual production promotion; the older frozen
commit does not contain this follow-up. Backend approved source bytes are unchanged.

## Behavior

New requirement and New candidate open native modal dialogs over their tracker.
The background is inert and scroll-locked; long forms scroll inside the dialog.
Close, Cancel and Escape return to the tracker without saving. While saving
(or uploading in the platform candidate), dismissal is disabled. Failures retain
the entered form and error; successful saves close, reload the tracker and return
keyboard focus to the creation button. The explicit focus loop handles browser
Tab/Shift+Tab differences. Existing inline edit forms keep their current behavior.

## Verification

- Synthetic fixture uses the actual pages, forms and modal with a local Supabase
  stub, no database/hosted model connection. Requirement and candidate saves pass;
  requirement save failure retains values; Escape cannot dismiss pending saves.
- Tab/Shift+Tab wraps; Cancel/Escape restores focus and body scrolling. Save focus
  survives the tracker's loading/re-render cycle. Both Coordinator creation
  actions stay absent under the existing permission checks.
- Native Chrome desktop visual check passes. At 311 × 780 CSS pixels the
  candidate modal fits without horizontal overflow; its footer is reachable
  while the header remains visible. The in-app browser screenshot API clips
  overridden desktop viewports, so desktop proof uses native Chrome instead.
- Existing normal staging Master session: both pending platform forms open as
  modals; company/ship/Draft and résumé-review controls remain. Cancel only;
  no staging or production data was submitted by those checks.
- Lint/build and final diff checks are recorded with the release handoff. The
  broad CLI browser suite was not run; actual interactive CUA evidence above
  is the focused UI smoke, not a new persistence/schema qualification.

## Other observations

The live AI Search tab was refreshed to load the already deployed sidebar-label
hotfix. Its keyboard focus labels were observed after refresh. No replacement
hover-expansion implementation is included here.

Match resumes is absent from production because its compatible Needle, bridge,
schema and Holmes release has not been promoted. It is visible on the pending
staging **requirement detail** for an open, reviewed company/ship requirement
with the permitted operator/search role. Closed, Draft, unreviewed and denied
role requirements do not offer it. Both approved production test requirements
were closed; no open production requirement is currently provided for matching.
Do not expose a button backed by the old bridge or waive intake/attachment gates.

## Rollback

Revert only the UI commit on its production base. Preserve the deployed sidebar
labels and all existing data/save contracts. No database rollback or intake flag
change is part of this UI follow-up.
