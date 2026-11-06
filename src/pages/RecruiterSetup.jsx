import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout, { AuthLoading, authButtonClass, authInputClass, authLabelClass } from '../components/auth/AuthLayout'
import { supabaseApiKey } from '../lib/supabaseKey'

export default function RecruiterSetup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [setupComplete, setSetupComplete] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      setLoading(true)
      setStatusError(false)
      setError(null)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-recruiter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseApiKey,
          },
          body: JSON.stringify({ action: 'status' }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to check setup status')
      }

      setSetupComplete(Boolean(data?.setup_complete))
    } catch (error) {
      console.error('Error checking setup status:', error)
      setStatusError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Validation
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (formData.password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-recruiter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseApiKey,
          },
          body: JSON.stringify({
            action: 'bootstrap',
            full_name: formData.fullName,
            email: formData.email,
            password: formData.password,
          }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data?.error === 'Initial setup is already complete.') {
          setSetupComplete(true)
          return
        }

        throw new Error(data?.error || 'Failed to create the initial master recruiter')
      }

      if (data?.error) {
        if (data.error === 'Initial setup is already complete.') {
          setSetupComplete(true)
          return
        }

        throw new Error(data.error)
      }

      setSuccess(true)
    } catch (error) {
      console.error('Setup error:', error)
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  if (loading) {
    return <AuthLoading />
  }

  if (setupComplete || success) {
    return (
      <AuthLayout
        title={success ? 'Admin account created' : 'Setup already complete'}
        subtitle={success ? formData.email : undefined}
      >
        <button type="button" onClick={() => navigate('/recruiter/login')} className={authButtonClass}>
          Sign in
        </button>
      </AuthLayout>
    )
  }

  if (statusError) {
    return (
      <AuthLayout title="Unable to check setup">
        <p role="alert" className="text-sm text-danger">The setup service is unavailable. Please try again later.</p>
        <button type="button" onClick={checkSetupStatus} className={authButtonClass}>
          Retry
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create admin account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={authLabelClass} htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            type="text"
            name="fullName"
            required
            value={formData.fullName}
            onChange={handleChange}
            className={authInputClass}
          />
        </div>

        <div>
          <label className={authLabelClass} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            className={authInputClass}
          />
        </div>

        <div>
          <label className={authLabelClass} htmlFor="password">Password (min 8)</label>
          <input
            id="password"
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            className={authInputClass}
          />
        </div>

        <div>
          <label className={authLabelClass} htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={authInputClass}
          />
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={submitting} className={authButtonClass}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
