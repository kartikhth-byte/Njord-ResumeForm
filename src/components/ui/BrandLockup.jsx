// Holmes wordmark (text only). The Njord logo is no longer shown in the app.
export default function BrandLockup({ compact = false, align = 'left' }) {
  const rootClass = [
    'brand-lockup',
    compact ? 'brand-lockup--compact' : '',
    align === 'center' ? 'brand-lockup--center' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass}>
      <span className="brand-lockup__wordmark">Holmes</span>
    </div>
  )
}
