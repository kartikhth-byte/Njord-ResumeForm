import { Link } from 'react-router-dom'

// Label + value only; `hint` is intentionally not rendered (docs/ui-theme-spec.md §12).
export default function StatCard({ label, value, tone = 'default', icon: Icon, to }) {
  const card = (
    <div className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__header">
        <div>
          <p className="stat-card__label">{label}</p>
          <p className="stat-card__value">{value}</p>
        </div>
        {Icon ? (
          <div className="stat-card__icon">
            <Icon className="w-5 h-5" />
          </div>
        ) : null}
      </div>
    </div>
  )
  // `to`: the count opens the list behind it.
  if (!to) return card
  return (
    <Link to={to} className="block rounded-card transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
      {card}
    </Link>
  )
}
