import { useAuth } from '../components/auth/AuthContext'

export function usePermissions() {
  const {
    permissions = [],
    role = null,
    loading,
    hasPermission: authHasPermission,
  } = useAuth()

  const hasPermission = (permissionName) => {
    return authHasPermission(permissionName)
  }

  const canManageTeam = () => hasPermission('manage_team')
  const canViewApplications = () => hasPermission('view_applications')
  const canManageApplications = () => hasPermission('manage_applications')
  const canScheduleInterviews = () => hasPermission('schedule_interviews')
  const canExportData = () => hasPermission('export_data')
  const canViewAnalytics = () => hasPermission('view_analytics')
  const canDeleteApplications = () => hasPermission('delete_applications')
  const canManageSettings = () => hasPermission('manage_settings')
  const canViewTeam = () => hasPermission('view_team')

  return {
    permissions,
    role,
    loading,
    hasPermission,
    canManageTeam,
    canViewApplications,
    canManageApplications,
    canScheduleInterviews,
    canExportData,
    canViewAnalytics,
    canDeleteApplications,
    canManageSettings,
    canViewTeam
  }
}
