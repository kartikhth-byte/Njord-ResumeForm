import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

// Left sidebar shell for applicant pages: same structure as RecruiterSidebar,
// light theme. `children` is the page-specific nav (e.g. form sections),
// `footer` sits above the account row (e.g. "Review & submit").
// The page's root element becomes the inset content panel (.recruiter-panel-shell).
export default function ApplicantSidebar({ children, footer }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const asideRef = useRef(null)

  useLayoutEffect(() => {
    const html = document.documentElement
    const panel = asideRef.current?.parentElement
    html.dataset.shell = 'sidebar'
    html.dataset.rail = 'expanded'
    panel?.classList.add('recruiter-panel-shell')
    return () => {
      delete html.dataset.shell
      panel?.classList.remove('recruiter-panel-shell')
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Applicant'
  const onDashboard = pathname === '/dashboard'

  return (
    <>
      <div className="recruiter-mobilebar">
        <button
          type="button"
          className="recruiter-sidebar__icon-button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="recruiter-sidebar__wordmark">Holmes</span>
      </div>

      {mobileOpen ? (
        <div className="recruiter-sidebar__backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      ) : null}

      <aside ref={asideRef} className={`recruiter-sidebar applicant-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Main">
        <div className="recruiter-sidebar__brand">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex min-w-0 items-center gap-2.5 rounded-control"
            aria-label="Holmes home"
          >
            <span className="recruiter-sidebar__mark" aria-hidden="true">H</span>
            <span className="recruiter-sidebar__wordmark">Holmes</span>
          </button>
          {mobileOpen ? (
            <button
              type="button"
              className="recruiter-sidebar__icon-button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <nav className="recruiter-sidebar__nav min-h-0 flex-1 overflow-y-auto" aria-label="Application">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className={`recruiter-sidebar__item ${onDashboard ? 'is-active' : ''}`}
              aria-current={onDashboard ? 'page' : undefined}
            >
              <FileText className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
              <span className="truncate">Your application</span>
            </button>
          </div>
          {children}
        </nav>

        <div className="recruiter-sidebar__footer flex-none">
          {footer ? <div className="pb-2">{footer}</div> : null}
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <span className="recruiter-sidebar__avatar" aria-hidden="true">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{displayName}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="recruiter-sidebar__icon-button"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
