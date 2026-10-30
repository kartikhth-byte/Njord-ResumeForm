// Title + actions only. Eyebrow/description props are intentionally not rendered
// (minimal-text rule, docs/ui-theme-spec.md §12); remove them from call sites during migration.
export default function PageHeader({ title, actions, children }) {
  return (
    <div className="recruiter-page-header">
      <div className="recruiter-page-header__body">
        <h1 className="recruiter-page-header__title">{title}</h1>
        {children}
      </div>

      {actions ? <div className="recruiter-page-header__actions">{actions}</div> : null}
    </div>
  )
}
