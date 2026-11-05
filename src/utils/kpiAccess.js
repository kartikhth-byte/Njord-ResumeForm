const KPI_VIEWER_ROLES = new Set(['Master Recruiter', 'Recruiter', 'Coordinator'])

export function canViewKpi(role, permissions = []) {
  return KPI_VIEWER_ROLES.has(role)
    || permissions.includes('view_audit_log')
    || permissions.includes('view_analytics')
}
