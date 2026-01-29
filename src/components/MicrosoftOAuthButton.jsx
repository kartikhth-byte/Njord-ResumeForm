import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth/AuthContext'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function MicrosoftOAuthButton({ onSuccess }) {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConnection()
  }, [user])

  const checkConnection = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('microsoft_oauth_tokens')
      .select('expires_at')
      .eq('user_id', user.id)
      .single()

    if (data && new Date(data.expires_at) > new Date()) {
      setIsConnected(true)
      if (onSuccess) onSuccess()
    }
    setLoading(false)
  }

  const connect = () => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID
    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID
    const redirectUri = import.meta.env.VITE_MICROSOFT_REDIRECT_URI

// Define scopes as array for clarity
const scopes = [
  'OnlineMeetings.ReadWrite',
  'User.Read',
  'offline_access'
].join(' ')

const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `response_mode=query&` +
  `scope=${encodeURIComponent(scopes)}&` +
  `prompt=consent&` +  // ← ADD THIS!
  `state=${user.id}`

    window.location.href = authUrl
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking connection...</span>
      </div>
    )
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Teams Connected</span>
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      <svg className="w-5 h-5" viewBox="0 0 23 23">
        <path d="M11 0H0V11H11V0Z" fill="#F25022"/>
        <path d="M23 0H12V11H23V0Z" fill="#7FBA00"/>
        <path d="M11 12H0V23H11V12Z" fill="#00A4EF"/>
        <path d="M23 12H12V23H23V12Z" fill="#FFB900"/>
      </svg>
      <span>Connect Microsoft Teams</span>
    </button>
  )
}