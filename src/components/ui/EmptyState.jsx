export default function EmptyState({ title, description, action, icon: Icon }) {
  return (
    <div className="workspace-empty-state">
      {Icon ? (
        <div className="workspace-empty-state__icon">
          <Icon className="w-6 h-6" />
        </div>
      ) : null}
      <h3 className="workspace-empty-state__title">{title}</h3>
      {description ? <p className="workspace-empty-state__description">{description}</p> : null}
      {action ? <div className="workspace-empty-state__action">{action}</div> : null}
    </div>
  )
}
