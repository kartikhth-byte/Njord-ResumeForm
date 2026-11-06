/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { endNeedleSession } from '../../lib/needle'

const AuthContext = createContext({})
const AUTHZ_CACHE_KEY = 'njord-authz-cache'
const APPLICANT_LOGIN_INTENT_KEY = 'njord-login-intent'

function getLoginIntent() {
  try {
    return window.sessionStorage.getItem(APPLICANT_LOGIN_INTENT_KEY)
  } catch {
    return null
  }
}

function clearLoginIntent() {
  try {
    window.sessionStorage.removeItem(APPLICANT_LOGIN_INTENT_KEY)
  } catch {
    // Ignore sessionStorage clear failures
  }
}

function buildApplicantProfileSnapshot(currentUser) {
  const fallbackName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    currentUser?.email?.split('@')[0] ||
    'Applicant'

  return {
    id: currentUser?.id ?? null,
    full_name: fallbackName,
    email: currentUser?.email || null,
    user_type: 'applicant',
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authorizationLoading, setAuthorizationLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userType, setUserType] = useState(null)
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  // Platform operator flag (platform_operators table), separate from roles.
  const [isOperator, setIsOperator] = useState(false)
  const hydratedSessionKeyRef = useRef(null)

  useEffect(() => {
    let mounted = true

    const getSessionKey = currentSession => {
      if (!currentSession?.user) return 'signed-out'
      return `${currentSession.user.id}:${currentSession.access_token ?? 'no-token'}`
    }

    const withTimeout = async (promise, timeoutMs, label) => {
      let timeoutId

      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error(`${label} timed out after ${timeoutMs}ms`))
            }, timeoutMs)
          }),
        ])
      } finally {
        if (timeoutId) {
          window.clearTimeout(timeoutId)
        }
      }
    }

    const readAuthorizationCache = userId => {
      try {
        const raw = window.localStorage.getItem(AUTHZ_CACHE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw)
        if (parsed?.userId !== userId) return null

        return parsed
      } catch {
        return null
      }
    }

    const writeAuthorizationCache = ({ userId, profile: nextProfile, userType: nextUserType, role: nextRole, permissions: nextPermissions, isOperator: nextIsOperator = false }) => {
      try {
        window.localStorage.setItem(AUTHZ_CACHE_KEY, JSON.stringify({
          userId,
          profile: nextProfile,
          userType: nextUserType,
          role: nextRole,
          permissions: nextPermissions,
          isOperator: Boolean(nextIsOperator),
          cachedAt: Date.now(),
        }))
      } catch {
        // Ignore cache write failures
      }
    }

    const clearAuthorizationCache = () => {
      try {
        window.localStorage.removeItem(AUTHZ_CACHE_KEY)
      } catch {
        // Ignore cache clear failures
      }
    }

    const ensureApplicantProfile = async currentUser => {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(buildApplicantProfileSnapshot(currentUser), { onConflict: 'id' })
        .select('id, full_name, email, user_type')
        .single()

      if (error) throw error

      return data
    }

    const loadAuthorization = async (currentUser, sessionKey) => {
      const isActive = () => mounted && hydratedSessionKeyRef.current === sessionKey
      if (!currentUser) {
        if (mounted) {
          setProfile(null)
          setUserType(null)
          setRole(null)
          setPermissions([])
          setIsOperator(false)
          setAuthorizationLoading(false)
        }
        clearAuthorizationCache()
        return
      }

      try {
        const profileResponse = await supabase
          .from('profiles')
          .select('id, full_name, email, user_type')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (!isActive()) return
        let { data: profileData, error: profileError } = profileResponse

        if (profileError) throw profileError

        if (!profileData && getLoginIntent() === 'applicant') {
          profileData = await ensureApplicantProfile(currentUser)
          if (!isActive()) return
        }

        if (profileData) {
          clearLoginIntent()
        }

        // Applicants do not need recruiter role/permission bootstrap.
        if (profileData?.user_type === 'applicant') {
          if (mounted) {
            setProfile(profileData)
            setUserType('applicant')
            setRole(null)
            setPermissions([])
            setIsOperator(false)
            setAuthorizationLoading(false)
          }

          writeAuthorizationCache({
            userId: currentUser.id,
            profile: profileData,
            userType: 'applicant',
            role: null,
            permissions: [],
          })
          return
        }

        const { data: roleRows, error: roleError } = await supabase
          .from('user_roles')
          .select(`
            role_id,
            roles (
              name
            )
          `)
          .eq('user_id', currentUser.id)

        if (roleError) throw roleError

        const roleIds = (roleRows || [])
          .map(row => row.role_id)
          .filter(Boolean)

        let permissionNames = []

        if (roleIds.length > 0) {
          const { data: permissionRows, error: permissionError } = await supabase
            .from('role_permissions')
            .select(`
              permission_id,
              permissions (
                name
              )
            `)
            .in('role_id', roleIds)

          if (permissionError) throw permissionError

          permissionNames = [
            ...new Set(
              (permissionRows || [])
                .map(row => row.permissions?.name)
                .filter(Boolean)
            )
          ]
        }

        // Operator console access. Missing function (before the migration
        // is applied) or any error means "not an operator".
        // A transient error keeps the last known value instead of bouncing an
        // operator out of the console.
        const previousOperatorFlag = Boolean(readAuthorizationCache(currentUser.id)?.isOperator)
        let operatorFlag = previousOperatorFlag
        try {
          const { data: operatorData, error: operatorError } = await supabase.rpc('is_platform_operator')
          if (!operatorError) operatorFlag = operatorData === true
        } catch {
          operatorFlag = previousOperatorFlag
        }

        if (!isActive()) return
        if (mounted) {
          setProfile(profileData ?? null)
          setUserType(profileData?.user_type ?? null)
          setRole(roleRows?.[0]?.roles?.name ?? null)
          setPermissions(permissionNames)
          setIsOperator(operatorFlag)
          setAuthorizationLoading(false)
        }

        writeAuthorizationCache({
          userId: currentUser.id,
          profile: profileData ?? null,
          userType: profileData?.user_type ?? null,
          role: roleRows?.[0]?.roles?.name ?? null,
          permissions: permissionNames,
          isOperator: operatorFlag,
        })
      } catch (error) {
        console.error('Authorization load error:', error?.code || error?.name || 'unknown', error?.message || 'No diagnostic message')
        if (isActive()) {
          setAuthorizationLoading(false)
        }
      }
    }

    const hydrateAuthState = async (newSession, { skipInitialLoading = false } = {}) => {
      if (!mounted) return
      const sessionKey = getSessionKey(newSession)

      if (hydratedSessionKeyRef.current === sessionKey) {
        if (mounted && !skipInitialLoading) {
          setLoading(false)
        }
        return
      }

      hydratedSessionKeyRef.current = sessionKey

      setSession(newSession)

      const currentUser = newSession?.user ?? null
      setUser(currentUser)

      if (mounted && !skipInitialLoading) {
        setLoading(false)
      }

      if (!currentUser) {
        // Signed out (here, by expiry, or in another tab): end the AI search session too.
        endNeedleSession()
        if (mounted) {
          setProfile(null)
          setUserType(null)
          setRole(null)
          setPermissions([])
          setIsOperator(false)
          setAuthorizationLoading(false)
        }
        clearAuthorizationCache()
        return
      }

      const cachedAuthorization = readAuthorizationCache(currentUser.id)
      const applicantIntent = getLoginIntent() === 'applicant'

      if (cachedAuthorization && mounted) {
        setProfile(cachedAuthorization.profile ?? null)
        setUserType(cachedAuthorization.userType ?? null)
        setRole(cachedAuthorization.role ?? null)
        setPermissions(cachedAuthorization.permissions ?? [])
        setIsOperator(Boolean(cachedAuthorization.isOperator))
        // Cached recruiter permissions may predate an operator grant or removal.
        // Hold protected routes until the bounded live refresh completes.
        setAuthorizationLoading(cachedAuthorization.userType !== 'applicant' && !applicantIntent)
      } else if (applicantIntent && mounted) {
        // Applicant login should not block on profile bootstrap after Google returns.
        setProfile(buildApplicantProfileSnapshot(currentUser))
        setUserType('applicant')
        setRole(null)
        setPermissions([])
        setIsOperator(false)
        setAuthorizationLoading(false)
      } else if (mounted) {
        setAuthorizationLoading(true)
      }

      if (applicantIntent) {
        loadAuthorization(currentUser, sessionKey).catch((error) => {
          console.warn('Applicant authorization refresh failed:', error)
        })
        return
      }

      try {
        await withTimeout(loadAuthorization(currentUser, sessionKey), 12000, 'Authorization bootstrap')
      } catch (error) {
        console.warn('Authorization bootstrap fallback:', error)
        if (mounted && hydratedSessionKeyRef.current === sessionKey) {
          setAuthorizationLoading(false)
        }
      }
    }

    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
          error
        } = await supabase.auth.getSession()

        if (error) throw error

        if (!mounted) return
        await hydrateAuthState(initialSession)
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setUserType(null)
          setRole(null)
          setPermissions([])
          setIsOperator(false)
          setAuthorizationLoading(false)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user && getSessionKey(newSession) !== hydratedSessionKeyRef.current) {
          const cached = readAuthorizationCache(newSession.user.id)
          setAuthorizationLoading(getLoginIntent() !== 'applicant' && cached?.userType !== 'applicant')
        }
        setLoading(false)
      }

      // Auth callbacks must return before a new Supabase query can acquire the auth lock.
      window.setTimeout(() => {
        if (mounted) {
          hydrateAuthState(newSession, { skipInitialLoading: true }).catch((error) => {
            console.error('Auth state refresh error:', error)
          })
        }
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const clearLocalAuthState = () => {
      hydratedSessionKeyRef.current = null
      setUser(null)
      setSession(null)
      setProfile(null)
      setUserType(null)
      setRole(null)
      setPermissions([])
      setIsOperator(false)
      setAuthorizationLoading(false)
      window.localStorage.removeItem(AUTHZ_CACHE_KEY)
      clearLoginIntent()
    }

    // End the embedded AI search session too (best effort).
    endNeedleSession()

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })

      if (error && error.name !== 'AuthSessionMissingError') {
        throw error
      }

      clearLocalAuthState()
    } catch (error) {
      if (error?.name === 'AuthSessionMissingError') {
        clearLocalAuthState()
        return
      }

      console.error('Sign out error:', error)
      throw error
    }
  }

  const value = {
    user,
    session,
    loading,
    authorizationLoading,
    profile,
    userType,
    role,
    permissions,
    isOperator,
    isApplicant: userType === 'applicant',
    isRecruiter: userType === 'recruiter',
    hasPermission: permissionName => permissions.includes(permissionName),
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
