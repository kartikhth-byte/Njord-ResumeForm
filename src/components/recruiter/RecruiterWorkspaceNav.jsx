import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { LayoutDashboard, BarChart3, Calendar, AlertCircle, Search, FileText, ClipboardList, Users } from 'lucide-react'

export default function RecruiterWorkspaceNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { role, canViewAnalytics } = usePermissions()

  if (!user) return null

  const items = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/recruiter/dashboard',
      visible: true
    },
    {
      key: 'workspace',
      label: 'Workspace',
      icon: FileText,
      path: '/recruiter/workspace',
      visible: true
    },
    {
      key: 'requirements',
      label: 'Requirements',
      icon: ClipboardList,
      path: '/recruiter/requirements',
      visible: true
    },
    {
      key: 'candidates',
      label: 'Candidates',
      icon: Users,
      path: '/recruiter/candidates',
      visible: true
    },
    {
      key: 'kpi',
      label: 'KPI',
      icon: BarChart3,
      path: '/recruiter/kpi',
      visible: role === 'Master Recruiter' || canViewAnalytics()
    },
    {
      key: 'expiry',
      label: 'Expiry',
      icon: AlertCircle,
      path: '/dashboard/expiry',
      // Route is ProtectedRoute(['Recruiter', 'Master Recruiter']) — hide it
      // from roles the route would bounce to /unauthorized.
      visible: role === 'Recruiter' || role === 'Master Recruiter'
    },
    {
      key: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      path: '/recruiter/calendar',
      visible: role === 'Recruiter' || role === 'Master Recruiter'
    },
    {
      key: 'search',
      label: 'Applications',
      icon: Search,
      path: '/recruiter/applications',
      visible: true
    }
    // Settings moved to the topbar gear icon next to the user menu.
  ].filter(item => item.visible)

  const isActive = (item) => {
    if (item.key === 'dashboard') return location.pathname.startsWith('/recruiter/dashboard')
    if (item.key === 'workspace') return location.pathname.startsWith('/recruiter/workspace')
    if (item.key === 'search') return location.pathname.startsWith('/recruiter/applications')
    if (item.key === 'kpi') return location.pathname.startsWith('/recruiter/kpi')
    return location.pathname.startsWith(item.path)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <nav className="recruiter-nav-scroll -mx-1 overflow-x-auto overflow-y-hidden border-b border-line px-1 pb-3">
        <div className="inline-flex w-max flex-nowrap gap-1">
          {items.map(item => {
            const ItemIcon = item.icon
            const active = isActive(item)
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className={`recruiter-nav-item ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <ItemIcon className="h-4 w-4 text-accent" />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
