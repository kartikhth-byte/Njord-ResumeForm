const njordLogoSrc = new URL('../../../njord_logo.png', import.meta.url).href

export const authLabelClass = 'mb-1.5 block text-sm font-medium text-fg-secondary'
export const authInputClass =
  'w-full rounded-control border border-line-input bg-surface px-3 py-2 text-base text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40'
export const authButtonClass =
  'flex w-full items-center justify-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-base font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:cursor-not-allowed disabled:opacity-50'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          {/* Logo artwork has an opaque white background, so it always sits on a white plate. */}
          <div className="rounded-card bg-white px-4 py-2">
            <img src={njordLogoSrc} alt="Njord" className="h-10 w-auto" />
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-6">
          <h1 className="text-xl font-semibold text-fg">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div> : null}
      </div>
    </div>
  )
}

export function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-label="Loading" />
    </div>
  )
}
