const njordLogoSrc = new URL('../../../njord_logo.png', import.meta.url).href

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
      <div className="brand-lockup__row">
        <img className="brand-lockup__logo" src={njordLogoSrc} alt="Njord Mariners First" />

        <div className="brand-lockup__product">
          <span className="brand-lockup__product-label">Njord Holmes</span>
          <span className="brand-lockup__product-copy">Recruitment Intelligence Workspace</span>
        </div>
      </div>
    </div>
  )
}
