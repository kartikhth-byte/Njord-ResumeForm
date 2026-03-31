export default function StatCard({ label, value, tone = 'default', icon: Icon, hint }) {
  return (
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
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
    </div>
  )
}
