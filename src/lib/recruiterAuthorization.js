// Read-only bootstrap. Roles determine the permission query; the operator check
// is independent and can run concurrently. Preserve the existing API/RLS paths.
export async function loadRecruiterAuthorization(client, userId, previousOperatorFlag = false) {
  const loadRoles = async () => {
    const { data: roleRows, error: roleError } = await client
      .from('user_roles')
      .select('role_id, roles (name)')
      .eq('user_id', userId)
    if (roleError) throw roleError

    const roleIds = (roleRows || []).map(row => row.role_id).filter(Boolean)
    let permissionNames = []
    if (roleIds.length) {
      const { data: permissionRows, error: permissionError } = await client
        .from('role_permissions')
        .select('permission_id, permissions (name)')
        .in('role_id', roleIds)
      if (permissionError) throw permissionError
      permissionNames = [...new Set((permissionRows || []).map(row => row.permissions?.name).filter(Boolean))]
    }
    return { roleRows, permissionNames }
  }
  const loadOperator = async () => {
    try {
      const { data, error } = await client.rpc('is_platform_operator')
      return error ? previousOperatorFlag : data === true
    } catch {
      // Preserve the prior transient-error fallback; backend access checks remain.
      return previousOperatorFlag
    }
  }
  try {
    const [roles, operatorFlag] = await Promise.all([loadRoles(), loadOperator()])
    return { ...roles, operatorFlag, error: null }
  } catch (error) {
    // This request may be started before profile finishes. Resolve with its error
    // so an early profile failure/sign-out cannot leave an unhandled rejection.
    return { error }
  }
}
