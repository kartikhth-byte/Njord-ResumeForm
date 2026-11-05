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
