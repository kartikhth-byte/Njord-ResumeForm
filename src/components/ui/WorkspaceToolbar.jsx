// Title, chips and actions; `subtitle` is intentionally not rendered (docs/ui-theme-spec.md §12).
export default function WorkspaceToolbar({ title, actions, chips = [] }) {
  return (
    <div className="workspace-toolbar">
      <div className="workspace-toolbar__content">
        <div>
          <div className="workspace-toolbar__title-row">
            <h2 className="workspace-toolbar__title">{title}</h2>
          </div>

          {chips.length > 0 ? (
            <div className="workspace-toolbar__chips">
              {chips.map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onRemove}
                  className="workspace-chip"
                >
                  <span>{chip.label}</span>
                  {chip.dismissible !== false ? <span className="workspace-chip__remove">×</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {actions ? <div className="workspace-toolbar__actions">{actions}</div> : null}
      </div>
    </div>
  )
}
