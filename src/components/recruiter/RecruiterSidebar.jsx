import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronsUpDown,
  ClipboardList,
  Clock,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  Search,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../auth/AuthContext'
import { canUseAiSearch } from '../../lib/needle'
import SidebarButton from './SidebarButton'

// Left sidebar shell for recruiter pages. Replaces the old topbar + tab row.
// Pages still render <RecruiterTopbar />, which now renders this. The page's root
// element becomes the inset content panel (see .recruiter-panel-shell in index.css).

const STORAGE_KEY = 'holmes.sidebar.collapsed'

function readCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}

export default function RecruiterSidebar({ user, profile, role, signOut }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { canViewAnalytics, canManageSettings, canViewRequirements } = usePermissions()
  const { isOperator } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const asideRef = useRef(null)
  const menuRef = useRef(null)

  const isRecruiterOrMaster = role === 'Recruiter' || role === 'Master Recruiter'
  const showKpi = canViewAnalytics()
  const showSettings = role === 'Master Recruiter' || canManageSettings()
  const showAiSearch = canUseAiSearch({ isOperator, role })
  const isAiSearch = pathname.startsWith('/recruiter/ai/') || pathname === '/recruiter/ai'
  const effectiveCollapsed = collapsed || isAiSearch

  const groups = [
    {
      label: 'Recruit',
      items: [
        canViewRequirements() && { key: 'companies', label: 'Companies & ships', icon: Building2, path: '/recruiter/companies' },
        { key: 'requirements', label: 'Requirements', icon: ClipboardList, path: '/recruiter/requirements', match: ['/recruiter/requirements', '/recruiter/workspace/requirements'] },
        { key: 'candidates', label: 'Candidates', icon: Users, path: '/recruiter/candidates', match: ['/recruiter/candidates', '/recruiter/workspace/prospects', '/recruiter/prospects'] },
        canViewRequirements() && { key: 'recruitment', label: 'Recruitment', icon: ClipboardList, path: '/recruiter/recruitment' },
        { key: 'applications', label: 'Applications', icon: Inbox, path: '/recruiter/applications', match: ['/recruiter/applications', '/application/view'] },
        showAiSearch && { key: 'ai', label: 'AI search', icon: Search, path: '/recruiter/ai/search', match: ['/recruiter/ai'] },
      ],
    },
    {
      label: 'Insights',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/recruiter/dashboard' },
        showKpi && { key: 'kpi', label: 'KPI', icon: BarChart3, path: '/recruiter/kpi' },
      ],
    },
    {
      label: 'Schedule',
      items: [
        { key: 'calendar', label: 'Calendar', icon: CalendarDays, path: '/recruiter/calendar' },
        isRecruiterOrMaster && { key: 'expiry', label: 'Expiry', icon: Clock, path: '/recruiter/expiry' },
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter(Boolean) }))
    .filter((group) => group.items.length > 0)

  const isActive = (item) => (item.match || [item.path]).some((prefix) => pathname.startsWith(prefix))

  // Mark the page root as the inset panel and tell CSS the shell is on.
  useLayoutEffect(() => {
    const html = document.documentElement
    const panel = asideRef.current?.parentElement
    html.dataset.shell = 'sidebar'
    panel?.classList.add('recruiter-panel-shell')
    return () => {
      delete html.dataset.shell
      delete html.dataset.rail
      panel?.classList.remove('recruiter-panel-shell')
    }
  }, [])

  useLayoutEffect(() => {
    document.documentElement.dataset.rail = effectiveCollapsed ? 'collapsed' : 'expanded'
  }, [effectiveCollapsed])

  useEffect(() => {
    setMobileOpen(false)
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev)
      return !prev
    })
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Recruiter'
  const displayEmail = profile?.email || user?.email || ''
  // On phones the drawer always shows labels.
  const rail = effectiveCollapsed && !mobileOpen

  const navButton = (item) => {
    const Icon = item.icon
    const active = isActive(item)
    return (
      <SidebarButton
        key={item.key}
        label={item.label}
        rail={rail}
        onClick={() => navigate(item.path)}
        className={`recruiter-sidebar__item ${active ? 'is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="h-[18px] w-[18px] flex-none" aria-hidden="true" />
        {!rail ? <span className="truncate">{item.label}</span> : null}
      </SidebarButton>
    )
  }

  return (
    <>
      {/* Phone top bar */}
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

      <aside
        ref={asideRef}
        className={`recruiter-sidebar ${rail ? 'is-rail' : ''} ${mobileOpen ? 'is-open' : ''}`}
        aria-label="Main"
      >
        <div className="recruiter-sidebar__brand">
          <SidebarButton
            label="Holmes home"
            rail={rail}
            onClick={() => navigate('/recruiter/dashboard')}
            className="flex min-w-0 items-center gap-2.5 rounded-control"
          >
            <span className="recruiter-sidebar__mark" aria-hidden="true">H</span>
            {!rail ? <span className="recruiter-sidebar__wordmark">Holmes</span> : null}
          </SidebarButton>
          {!rail ? (
            <button
              type="button"
              className="recruiter-sidebar__icon-button recruiter-sidebar__collapse"
              onClick={mobileOpen ? () => setMobileOpen(false) : toggleCollapsed}
              aria-label={mobileOpen ? 'Close menu' : 'Collapse sidebar'}
              title={mobileOpen ? 'Close menu' : 'Collapse sidebar'}
            >
              {mobileOpen ? <X className="h-[18px] w-[18px]" aria-hidden="true" /> : <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
          ) : null}
        </div>

        {rail && !isAiSearch ? (
          <SidebarButton
            label="Expand sidebar"
            rail={rail}
            className="recruiter-sidebar__icon-button self-center"
            onClick={toggleCollapsed}
          >
            <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </SidebarButton>
        ) : null}

        <nav className="recruiter-sidebar__nav" aria-label="Sections">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              {!rail ? <div className="recruiter-sidebar__group">{group.label}</div> : null}
              {group.items.map(navButton)}
            </div>
          ))}
        </nav>

        <div className="recruiter-sidebar__footer">
          {isOperator
            ? navButton({ key: 'operator', label: 'Operator', icon: Shield, path: '/operator' })
            : null}
          {showSettings
            ? navButton({ key: 'settings', label: 'Settings', icon: Settings, path: '/recruiter/settings' })
            : null}

          <div className="relative" ref={menuRef}>
            <SidebarButton
              label="Account"
              rail={rail}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="recruiter-sidebar__item recruiter-sidebar__account"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="recruiter-sidebar__avatar" aria-hidden="true">
                {displayName.charAt(0).toUpperCase()}
              </span>
              {!rail ? (
                <>
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate text-[13px] text-fg">{displayName}</span>
                    <span className="truncate text-xs text-fg-muted">{role || 'Recruiter'}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 flex-none text-fg-muted" aria-hidden="true" />
                </>
              ) : null}
            </SidebarButton>

            {menuOpen ? (
              <div role="menu" className="recruiter-sidebar__menu">
                <div className="border-b border-line px-4 py-3">
                  <div className="truncate text-sm font-medium text-fg">{displayName}</div>
                  {displayEmail ? <div className="truncate text-xs text-fg-muted">{displayEmail}</div> : null}
                  <div className="mt-1 text-xs font-medium text-accent-text">{role || 'Recruiter'}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}
