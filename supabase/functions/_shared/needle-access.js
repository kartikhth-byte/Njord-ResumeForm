// Who may open AI search (Needle), and as which Needle role.
// Design: docs/needle-in-holmes-design.md sections 4.2 and 5.
// Shared by the needle-token edge function and its tests (plain JS so Node
// can import it).

export const DEFAULT_NEEDLE_ORG_ID = '00000000-0000-4000-8000-0000000000a1'

// access: "off" | "operator" | "on" (NEEDLE_AI_SEARCH_ACCESS).
// Operators -> Needle "admin". Master Recruiters and Recruiters -> "user"
// when access is "on". Coordinators never get a token.
export function needleRoleFor({ access, isOperator, roleNames = [], userType }) {
  const mode = String(access || 'off').trim().toLowerCase()
  if (mode !== 'operator' && mode !== 'on') return null
  if (isOperator) return 'admin'
  if (mode !== 'on') return null
  if (userType !== 'recruiter') return null
  const names = new Set(roleNames)
  // Coordinators never search, even if they also hold another role row.
  if (names.has('Coordinator')) return null
  if (names.has('Master Recruiter') || names.has('Recruiter')) return 'user'
  return null
}

// One server-side caller lookup shared by the hosted handlers and local
// integration rehearsal. Service-role credentials never reach the browser.
export async function needleCallerAccess(admin, userId, accessMode) {
  const [profile, roles, operator, view, edit] = await Promise.all([
    admin.from('profiles').select('full_name,email,user_type').eq('id', userId).maybeSingle(),
    admin.from('user_roles').select('roles(name)').eq('user_id', userId),
    admin.from('platform_operators').select('user_id').eq('user_id', userId).maybeSingle(),
    admin.rpc('has_permission', { user_uuid: userId, permission_name: 'view_prospects' }),
    admin.rpc('has_permission', { user_uuid: userId, permission_name: 'create_prospects' }),
  ])
  if ([profile, roles, operator, view, edit].some(result => result.error)) throw new Error('Authorization unavailable')
  const roleNames = (roles.data || []).map(row => row.roles?.name).filter(Boolean)
  const role = needleRoleFor({ access: accessMode, userType: profile.data?.user_type, roleNames, isOperator: Boolean(operator.data) })
  return { operator: Boolean(operator.data), view: Boolean(view.data), edit: Boolean(edit.data),
    coordinator: roleNames.includes('Coordinator'), search: Boolean(role), role, profile: profile.data }
}
