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

  const hasAnyPermission = (...permissionNames) => permissionNames.some((permissionName) => hasPermission(permissionName))

  const canManageTeam = () => role === 'Master Recruiter' || hasAnyPermission('manage_runtime_settings', 'manage_settings')
  const canViewApplications = () => hasAnyPermission('view_requirements', 'view_prospects')
  const canManageApplications = () => hasAnyPermission('manage_applications', 'edit_requirements', 'transition_requirements', 'edit_requirement_owner', 'edit_junction_status')
  const canViewProspects = () => hasPermission('view_prospects')
  const canManageProspects = () => hasAnyPermission('create_prospects', 'edit_prospects', 'transition_prospects', 'archive_prospects', 'delete_prospects')
  const canViewRequirements = () => hasPermission('view_requirements')
  const canManageRequirements = () => hasAnyPermission('edit_requirements', 'create_requirements', 'transition_requirements', 'edit_requirement_owner')
  const canScheduleInterviews = () => hasAnyPermission('transition_requirements', 'edit_requirements')
  const canExportData = () => hasAnyPermission('export_data', 'export_csv', 'export_pdf')
  const canViewAnalytics = () => hasAnyPermission('view_audit_log', 'view_analytics')
  const canDeleteApplications = () => hasAnyPermission('delete_applications', 'delete_prospects', 'archive_prospects')
  const canManageSettings = () => hasAnyPermission('manage_runtime_settings', 'manage_settings')
  const canViewTeam = () => role === 'Master Recruiter' || hasAnyPermission('manage_runtime_settings', 'manage_settings')

  return {
    permissions,
    role,
    loading,
    hasPermission,
    canManageTeam,
    canViewApplications,
    canManageApplications,
    canViewProspects,
    canManageProspects,
    canViewRequirements,
    canManageRequirements,
    canScheduleInterviews,
    canExportData,
    canViewAnalytics,
    canDeleteApplications,
    canManageSettings,
    canViewTeam
  }
}
