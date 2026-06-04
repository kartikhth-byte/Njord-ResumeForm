import { useNavigate, useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../auth/AuthContext'
import { LayoutDashboard, FileText, Search, Calendar, AlertCircle, Settings, Users } from 'lucide-react'

export default function RecruiterWorkspaceNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { permissions, role } = usePermissions()
  const { user } = useAuth()

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
      path: '/recruiter/applications',
      visible: true
    },
    {
      key: 'search',
      label: 'Search',
      icon: Search,
      path: '/recruiter/applications?tab=search',
      visible: true
    },
    {
      key: 'prospects',
      label: 'Prospects',
      icon: Users,
      path: '/recruiter/prospects',
      visible: permissions.includes('view_prospects') || permissions.includes('create_prospects') || permissions.includes('view_requirements')
    },
    {
      key: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      path: '/recruiter/calendar',
      visible: true
    },
    {
      key: 'expiry',
      label: 'Expiry',
      icon: AlertCircle,
      path: '/dashboard/expiry',
      visible: true
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/recruiter/settings',
      visible: role === 'Master Recruiter' || permissions.includes('manage_runtime_settings') || permissions.includes('manage_settings')
    }
  ].filter(item => item.visible)

  const isActive = (item) => {
    if (item.key === 'dashboard') return location.pathname === '/recruiter/dashboard'
    if (item.key === 'workspace') {
      return location.pathname === '/recruiter/applications' && location.search !== '?tab=search'
    }
    if (item.key === 'search') {
      return location.pathname === '/recruiter/applications' && location.search.includes('tab=search')
    }
    if (item.key === 'prospects') return location.pathname.startsWith('/recruiter/prospects')
    return location.pathname.startsWith(item.path)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="recruiter-panel overflow-hidden p-4 sm:p-5">
        <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1">
          <div className="inline-flex w-max flex-nowrap gap-3">
          {items.map(item => {
            const ItemIcon = item.icon
            const active = isActive(item)
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className={`workspace-action-button flex-none whitespace-nowrap ${
                  active ? 'workspace-action-button--primary' : 'workspace-action-button--secondary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <ItemIcon className="w-4 h-4" />
                {item.label}
              </button>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}
