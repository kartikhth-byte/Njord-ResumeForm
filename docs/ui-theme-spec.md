# UI Theme Spec — Warm Compact

Status: draft · 2026-10-30 · not implemented

## 1. Goal

Restyle the whole app with one token-based theme:

- **Recruiter surfaces → dark** (warm, compact).
- **Applicant surfaces → light** (cream).
- Every text/UI pairing passes WCAG AA (verified ratios in §4).

The palette is a Claude-inspired adaptation using system fonts. These are not Njord brand tokens.

Out of scope: layout or IA changes, new components, logo changes.

Decided: recruiter surfaces are **dark only**. There is no light/dark toggle and no "System" option (decided 2026-10-30). The light tokens apply only to applicant/public surfaces and print.

## 2. Theme scoping

| Surface | Routes | Theme |
|---|---|---|
| Recruiter | `/recruiter/*`, `/dashboard/expiry`, `/dashboard/calendar`, `/cleanup-drafts` | dark |
| Applicant | `/applicant/login`, `/dashboard`, `/application/form/*`, `/application/review`, `/application/success` | light |
| Public | `/privacy-policy`, `/terms-conditions`, `/unauthorized`, auth callbacks | light |
| Shared | `/application/view/:publicToken` | dark if `userType === 'recruiter'`, else light |
| Print / PDF | `@media print`, jsPDF exports | always light |

Mechanism:

- Set `data-theme="dark|light"` on `<html>`. Because it sits on the root, portals and modals inherit it.
- An inline script in `index.html` sets the initial value from `location.pathname` to avoid a flash on first paint.
- A small `useThemeForRoute()` hook in `App.jsx` updates it on navigation. `ViewApplication` overrides it once `userType` is known.
- `:root` holds the dark tokens. `[data-theme="light"]` overrides them. `@media print` forces the light values.

Careful: `/dashboard` is applicant (light), but `/dashboard/expiry` and `/dashboard/calendar` are recruiter (dark). Match exact prefixes.

## 3. Tokens

Tokens are stored as RGB channels so Tailwind opacity modifiers still work (`--bg: 23 22 20;` → `rgb(var(--bg) / <alpha-value>)`).

### 3.1 Neutrals and accent

| Token | Use | Dark | Light |
|---|---|---|---|
| `bg` | page | `#171614` | `#faf9f5` |
| `surface` | cards, tables, modals | `#1d1c1a` | `#ffffff` |
| `raised` | hover, active nav, table header, secondary button | `#262523` | `#f0eee6` |
| `line` | dividers, card borders | `#33322e` | `#e5e2d9` |
| `line-strong` | emphasized dividers | `#44423d` | `#cfccc2` |
| `line-input` ⚑ | input/select/checkbox borders | `#737069` | `#86837a` |
| `fg` | primary text | `#ffffff` | `#1f1e1d` |
| `fg-secondary` | body/secondary text | `#cbc8c0` | `#63615a` |
| `fg-muted` ⚑ | hints, placeholders, meta | `#8f8c84` | `#6f6c64` |
| `accent` | icons, focus ring, active indicators | `#d97757` | `#c15f3c` |
| `accent-text` ⚑ | links, accent text | `#d97757` | `#a94e2c` |
| `accent-fill` ⚑ | primary button background | `#b75a39` | `#b75a39` |
| `accent-fill-hover` ⚑ | primary button hover | `#a95334` | `#a95334` |
| `on-accent` | text on `accent-fill` | `#ffffff` | `#ffffff` |
| `accent-soft` | selected row, accent chip background | `#302520` | `#faf2ef` |

⚑ = changed or added versus the source palette, for visibility:

- **Light `fg-muted`:** the source `#8f8c83` is 2.9–3.4:1 and fails AA. Darkened to `#6f6c64`.
- **Primary button:** white on `#d97757` is 3.1:1 and fails. Buttons use the deeper `#b75a39` (4.6:1) in both themes. `#d97757` stays for icons and links in dark.
- **Light `accent-text`:** `#c15f3c` as text on `raised` is 3.6:1 and fails. Link and accent text use `#a94e2c`.
- **`line-input`:** the source borders are 1.2–1.8:1, so inputs would be invisible. Input borders need at least 3:1 (WCAG 1.4.11). Card and divider borders stay subtle (decorative).

### 3.2 Status tones

Seven tones. These replace all ad-hoc red/green/amber/blue/purple/indigo/orange/teal/emerald/rose usage.

| Tone | Dark fg / soft bg / border | Light fg / soft bg / border | Used for |
|---|---|---|---|
| `success` | `#7cc08a` / `#2a332a` / `#3e5541` | `#2f6f3e` / `#ecf2ee` / `#c1d4c5` | compliance green, passed, accepted, joined |
| `offer` | `#5cc4b4` / `#263430` / `#335750` | `#0f6e64` / `#e9f2f1` / `#b7d4d0` | offered (pending candidate decision) |
| `warning` | `#e0b45a` / `#383123` / `#615130` | `#8a5a00` / `#f4f0e8` / `#dcceb2` | compliance amber, under review, expiring |
| `danger` | `#f08a7e` / `#3b2b28` / `#67423d` | `#b3261e` / `#f8ebeb` / `#e8bebc` | compliance red, failed, rejected, errors, destructive |
| `info` | `#8ab4f0` / `#2c3138` / `#435165` | `#2457a6` / `#ebf0f7` / `#bdcde4` | new, submitted, info banners |
| `progress` | `#b9a3f0` / `#332f38` / `#544b65` | `#5b45a8` / `#f0eef7` / `#cec7e5` | test/interview scheduled or completed |
| `neutral` | `#cbc8c0` / `#353431` / `#5a5854` | `#63615a` / `#f1f1f0` / `#d0d0ce` | draft, withdrawn, archived |

Tailwind names: `text-success`, `bg-success-soft`, `border-success-line`, and so on.

Rules:

- `offered` uses its own `offer` (teal) tone: distinct from final outcomes, and not orange, so it can't be confused with the accent.
- Status is never shown by color alone. Badges keep their text label; RAG compliance keeps its label or icon.

### 3.2.1 Status → tone mapping

| Source | Values → tone |
|---|---|
| `StatusBadge` | `new`, `submitted` → info · `under_review`, `documents_pending` → warning · `test_scheduled`, `test_completed`, `interview_scheduled`, `interview_completed`, `second_interview_scheduled`, `second_interview_completed` → progress · `test_passed`, `interview_passed`, `offer_accepted`, `hired` → success · `offered` → offer · `test_failed`, `rejected` → danger · `draft`, `withdrawn`, unknown → neutral |
| Compliance (`applicationCompliance.js`, `ApplicationCompliancePanel`) | `green` → success · `amber` → warning · `red` → danger |
| `ConfidenceBadge` | high → success · medium → warning · low → danger |
| Expiry dashboard | expired → danger · expiring soon → warning · valid → success |
| KPI buckets | on track → success · past 50% → warning · overdue → danger |

The tone map lives in one place (`src/constants/statusTones.js`), and every badge imports it instead of carrying its own class strings.

### 3.3 Charts

| Series | Dark | Light |
|---|---|---|
| 1 | `#d97757` | `#c15f3c` |
| 2 | `#8ab4f0` | `#2f6fbf` |
| 3 | `#7cc08a` | `#2f8a4a` |
| 4 | `#e0b45a` | `#b07a00` |
| 5 | `#b9a3f0` | `#7055c8` |
| 6 | `#8f8c84` | `#8f8c83` |

- Gridlines use `line`; axis labels use `fg-muted`.
- Charts read colors from CSS variables, not hardcoded hex. This applies to `SimpleCharts.jsx` and `RecruiterKpiPage.jsx`, which currently have about 30 hex values.
- Funnel steps use series 1–5 plus `danger` and `neutral`, not a single-hue ramp.

## 4. Verified contrast (WCAG 2.1)

Targets: text 4.5:1. Non-text (input borders, icons, focus ring, chart marks) 3:1.

| Pairing | Dark | Light |
|---|---|---|
| `fg` on bg / surface / raised | 18.1 / 17.0 / 15.3 | 15.8 / 16.6 / 14.3 |
| `fg-secondary` on bg / surface / raised | 10.8 / 10.2 / 9.2 | 5.9 / 6.2 / 5.3 |
| `fg-muted` on bg / surface / raised | 5.4 / 5.1 / 4.6 | 5.0 / 5.2 / 4.5 |
| `accent-text` on surface / raised | 5.5 / 4.9 | 5.5 / 4.7 |
| `on-accent` on `accent-fill` / hover | 4.6 / 5.3 | 4.6 / 5.3 |
| `accent-text` on `accent-soft` | 4.8 | 5.0 |
| `line-input` on bg / surface / raised | 3.7 / 3.5 / 3.1 | 3.6 / 3.8 / 3.3 |
| `accent` (focus ring) on surface | 5.5 | 4.2 |
| status fg on own soft bg (min) | 5.5 | 5.2 |
| status fg on surface (min) | 7.0 | 5.9 |
| chart series on surface (min) | 5.1 | 3.4 |

Rules that keep these numbers true:

- Text sits only on `bg`, `surface`, `raised`, `accent-soft`, or a status soft bg. No extra hover shades darker or lighter than `raised`: `fg-muted` drops below 4.5 on anything beyond it.
- Never put `fg-muted` on a status soft bg; use that tone's fg.
- Disabled controls use `opacity-50` and are exempt from AA, but keep the label.

## 5. Typography

- **Sans:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif`. Drop `Inter` (it was never loaded).
- **Mono:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. Use it for IDs, tokens, CDC/passport numbers and other technical values.
- **Base:** `html` stays at 16px so rem spacing is unchanged. `body` is 14px with line height 1.6.
- **Tailwind `fontSize` remap:**

  | Class | Size |
  |---|---|
  | `xs` | 12px |
  | `sm` | 13px |
  | `base` | 14px |
  | `lg` | 16px |
  | `xl` | 18px |
  | `2xl` | 22px |
  | `3xl` | 26px |

- **Weights:** 400 for UI text, 500 for labels and nav, 600 for headings. No 700 or above except stat values.
- **Applicant inputs on mobile (<640px) stay at 16px.** iOS Safari zooms into any input under 16px.

## 6. Shape, spacing, depth

| Item | Value |
|---|---|
| Card / panel / modal radius | 8px (`rounded-card`) |
| Button / input / nav item / chip radius | 6px (`rounded-control`) |
| Pills, avatars, dots | `rounded-full` (unchanged) |
| Spacing | Tailwind default 4px scale; card padding 16px, dense tables 8×12px |
| Borders | 1px; `line` for cards, `line-input` for form controls |
| Shadows | none on cards; a single `shadow-overlay` for modals, dropdowns and popovers only |
| Gradients | none; remove the body radial and linear gradients and the 4 `bg-gradient-*` |

## 7. Components

| Component | Spec |
|---|---|
| Primary button | `accent-fill` bg, `on-accent` text, 6px radius, 32px height (36px on applicant) |
| Secondary button | transparent, `line-strong` border, `fg` text, hover `raised` |
| Destructive button | `danger` fg on `danger-soft`, `danger-line` border |
| Input / select / textarea | `surface` bg, `line-input` border, `fg` text, `fg-muted` placeholder, focus = 2px `accent` ring |
| Card / panel | `surface` bg, 1px `line`, 8px radius, no shadow |
| Table | header `raised` + `fg-secondary` 12px/500; rows `surface`; divider `line`; hover `raised`; selected `accent-soft` |
| Nav item | 16px outline icon tinted `accent`; label `fg-secondary`; active = `raised` bg + `fg` |
| Badge | tone soft bg + tone fg + tone border, 6px radius, 12px/500 |
| Modal | `surface`, 1px `line`, 8px radius, `shadow-overlay`, backdrop `rgb(0 0 0 / .6)` dark, `rgb(31 30 29 / .4)` light |
| Focus | `focus-visible:ring-2 ring-accent ring-offset-2 ring-offset-bg` on every interactive element |
| Scrollbar | track `bg`, thumb `line-strong`, hover `fg-muted` |
| Native controls | `color-scheme: dark` / `light` on `<html>` so selects, date inputs and checkboxes render correctly |

## 8. Migration map (Tailwind classes → tokens)

| From | To |
|---|---|
| `text-gray/slate-900/800` | `text-fg` |
| `text-gray/slate-700/600` | `text-fg-secondary` |
| `text-gray/slate-500/400` | `text-fg-muted` |
| `bg-white` | `bg-surface` |
| `bg-gray/slate-50/100` | `bg-raised` |
| `border-gray/slate-100/200` | `border-line` |
| `border-gray/slate-300` (on inputs) | `border-line-input` |
| `border-gray/slate-300` (elsewhere) | `border-line-strong` |
| `bg-blue-600`, `primary-*` buttons | `bg-accent-fill text-on-accent hover:bg-accent-fill-hover` |
| `text-blue-600/700` links | `text-accent-text` |
| `ring-blue-*`, `focus:border-blue-*` | `ring-accent` |
| `text-white` on colored buttons | `text-on-accent` |
| red / green / amber / blue / purple / indigo / teal / emerald / rose / orange | the matching §3.2 tone (orange `offered` → `offer`) |
| `rounded-2xl` / `rounded-3xl` / `rounded-xl` | `rounded-card` |
| `rounded-lg` / `rounded-md` / `rounded` on controls | `rounded-control` |
| `shadow-*` on cards | remove |
| `--recruiter-*`, `--applicant-*` vars | the new tokens; delete the old vars |

Also: remove the default `primary` blue scale from `tailwind.config.js` once nothing references it.

Skip and don't migrate: `*_old.jsx`, `*.backup*`.

## 9. Third-party and special cases

- **`react-datepicker`:** override its CSS with the tokens (calendar bg, selected day = `accent-fill`, today = `accent-text`).
- **Print (`ViewApplication` `@media print`) and jsPDF exports:** force light tokens. jsPDF keeps its own hardcoded colors; no change needed.
- **`MicrosoftOAuthButton`:** keep Microsoft's brand colors (vendor requirement).
- **Logo (`BrandLockup`):** check that it is visible on dark `bg`. If not, use a light variant or a `surface` chip behind it. This is the only logo action.
- **`InterviewSchedulingModal`:** has hardcoded hex; tokenize it.

## 10. Implementation phases

1. **Foundation (small).** Tokens in `index.css`, Tailwind config (colors, fontSize, radius, shadow), theme scoping (inline script + hook), base body, scrollbar and `color-scheme`, shared component classes in `index.css` (`recruiter-*`, `workspace-*`, `stat-card`, `segmented-control`, modal).
2. **Recruiter pages (large, mechanical).** In order: `RecruiterTopbar` / `RecruiterWorkspaceNav`, `RecruiterApplications` + `ApplicationFilters`, `ViewApplication` + `ApplicationCompliancePanel`, Dashboard, Workspace, KPI, Requirements, Candidates, Expiry, Calendar, Team, Settings, all recruiter modals.
3. **Status and data viz (medium).** `StatusBadge`, `ConfidenceBadge`, compliance RAG, charts, datepicker.
4. **Applicant (medium).** Login, applicant `Dashboard`, `FormLayout` / `FormSidebar` / `FormNavigation` / sections, review, success, privacy, terms.

Each phase passes `npm run lint` and `npm run build`. Work happens on branch `ui/warm-theme`. Phases 1–3 merge to `main` together (recruiter turns dark only when every recruiter page is migrated, so it never looks half-dark). Phase 4 merges separately.

## 11. Acceptance criteria

- Recruiter routes render dark and applicant/public routes render light, with no flash on hard reload. `ViewApplication` follows the viewer's role. Print is light.
- No raw Tailwind palette classes remain in migrated files. This check returns nothing:
  `grep -rEn '\b(bg|text|border|ring|from|to|divide)-(gray|slate|zinc|neutral|stone|blue|indigo|sky|red|green|emerald|amber|yellow|orange|purple|violet|teal|cyan|rose|pink|primary)-[0-9]' src --include=*.jsx | grep -v -E '_old|backup'`
- No hex colors in JSX except `MicrosoftOAuthButton` and jsPDF code.
- Every pairing in §4 holds. Spot-check with a browser contrast tool on Applications, ViewApplication, KPI, the applicant form, and one modal per theme.
- All inputs, checkboxes and selects have visible borders and a visible focus ring in both themes.
- Status badges and compliance RAG are readable in both themes and keep their text labels.
- Applicant form inputs don't trigger zoom on iOS Safari.
- No card shadows and no gradients remain.
