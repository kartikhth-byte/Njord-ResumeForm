/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

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

    const writeAuthorizationCache = ({ userId, profile: nextProfile, userType: nextUserType, role: nextRole, permissions: nextPermissions }) => {
      try {
        window.localStorage.setItem(AUTHZ_CACHE_KEY, JSON.stringify({
          userId,
          profile: nextProfile,
          userType: nextUserType,
          role: nextRole,
          permissions: nextPermissions,
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

    const loadAuthorization = async currentUser => {
      if (!currentUser) {
        if (mounted) {
          setProfile(null)
          setUserType(null)
          setRole(null)
          setPermissions([])
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

        let { data: profileData, error: profileError } = profileResponse

        if (profileError) throw profileError

        if (!profileData && getLoginIntent() === 'applicant') {
          profileData = await ensureApplicantProfile(currentUser)
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

        if (mounted) {
          setProfile(profileData ?? null)
          setUserType(profileData?.user_type ?? null)
          setRole(roleRows?.[0]?.roles?.name ?? null)
          setPermissions(permissionNames)
          setAuthorizationLoading(false)
        }

        writeAuthorizationCache({
          userId: currentUser.id,
          profile: profileData ?? null,
          userType: profileData?.user_type ?? null,
          role: roleRows?.[0]?.roles?.name ?? null,
          permissions: permissionNames,
        })
      } catch (error) {
        console.error('Authorization load error:', error)
        if (mounted) {
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
        if (mounted) {
          setProfile(null)
          setUserType(null)
          setRole(null)
          setPermissions([])
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
        setAuthorizationLoading(false)
      } else if (applicantIntent && mounted) {
        // Applicant login should not block on profile bootstrap after Google returns.
        setProfile(buildApplicantProfileSnapshot(currentUser))
        setUserType('applicant')
        setRole(null)
        setPermissions([])
        setAuthorizationLoading(false)
      } else if (mounted) {
        setAuthorizationLoading(true)
      }

      if (applicantIntent) {
        loadAuthorization(currentUser).catch((error) => {
          console.warn('Applicant authorization refresh failed:', error)
        })
        return
      }

      try {
        await withTimeout(loadAuthorization(currentUser), 12000, 'Authorization bootstrap')
      } catch (error) {
        console.warn('Authorization bootstrap fallback:', error)
        if (mounted) {
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
          setAuthorizationLoading(false)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setLoading(false)
      }

      await hydrateAuthState(newSession, { skipInitialLoading: true })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signOut = async () => {
    const clearLocalAuthState = () => {
      hydratedSessionKeyRef.current = null
      setUser(null)
      setSession(null)
      setProfile(null)
      setUserType(null)
      setRole(null)
      setPermissions([])
      setAuthorizationLoading(false)
      window.localStorage.removeItem(AUTHZ_CACHE_KEY)
      clearLoginIntent()
    }

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
    isApplicant: userType === 'applicant',
    isRecruiter: userType === 'recruiter',
    hasPermission: permissionName => permissions.includes(permissionName),
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext
