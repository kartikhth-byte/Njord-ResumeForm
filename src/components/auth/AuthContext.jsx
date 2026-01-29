import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const AuthContext = createContext({})

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
  const [session, setSession] = useState(null)

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Get initial session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        
        if (error) throw error
        
        if (mounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initializeAuth()

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setLoading(false)
      }
    })

    // 3. Periodic session refresh (Every 5 mins)
    const refreshInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.auth.refreshSession()
      }
    }, 5 * 60 * 1000)

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
      clearInterval(refreshInterval)
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
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext;