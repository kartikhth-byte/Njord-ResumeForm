// Route → theme mapping. Keep in sync with the inline script in index.html.
// See docs/ui-theme-spec.md §2. Recruiter surfaces are dark-only; everything else is light.
const DARK_PREFIXES = ['/recruiter', '/dashboard/expiry', '/dashboard/calendar', '/cleanup-drafts']
// Pages that choose their own theme once the viewer's role is known.
const SELF_THEMED_PREFIXES = ['/application/view/']

const matchesPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)

export function themeForPath(pathname = '/') {
  if (SELF_THEMED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null
  return DARK_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix)) ? 'dark' : 'light'
}

export function applyTheme(theme) {
  if (typeof document === 'undefined' || !theme) return
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme
  }
}
