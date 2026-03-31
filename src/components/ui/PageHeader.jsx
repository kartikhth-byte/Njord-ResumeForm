export default function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="recruiter-page-header">
      <div className="recruiter-page-header__body">
        {eyebrow && <p className="recruiter-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="recruiter-page-header__title">{title}</h1>
        {description && <p className="recruiter-page-header__description">{description}</p>}
        {children}
      </div>

      {actions ? <div className="recruiter-page-header__actions">{actions}</div> : null}
    </div>
  )
}
