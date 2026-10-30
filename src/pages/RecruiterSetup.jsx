import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, CheckCircle, AlertCircle, Loader2, Lock } from 'lucide-react'

export default function RecruiterSetup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [setupComplete, setSetupComplete] = useState(false)
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
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-recruiter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
      setError('Failed to check setup status. Please try again.')
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
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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

      // Success!
      setSuccess(true)
      
      // Wait 3 seconds then redirect to recruiter login
      setTimeout(() => {
        navigate('/recruiter/login')
      }, 3000)

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
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="recruiter-panel w-full max-w-lg p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-accent-fill text-on-accent">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">
            Preparing recruiter setup
          </h1>
          <p className="mt-3 text-sm leading-6 text-fg-secondary">
            Checking setup…
          </p>
        </div>
      </div>
    )
  }

  if (setupComplete) {
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="recruiter-panel w-full max-w-xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-success-soft text-success">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
            Setup already complete
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-fg-secondary">
            Setup is complete. This page is locked.
          </p>
          <div className="recruiter-note recruiter-note--info mx-auto mt-6 max-w-md text-left">
            <p className="recruiter-note__title">Next step</p>
          </div>
          <button
            onClick={() => navigate('/recruiter/login')}
            className="workspace-action-button workspace-action-button--primary mt-8"
          >
            Go to Recruiter Login
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="recruiter-panel w-full max-w-xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-card bg-success-soft text-success">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
            Setup complete
          </h2>
          <p className="mt-4 text-sm leading-6 text-fg-secondary">
            Master Recruiter account created successfully.
          </p>
          <div className="recruiter-note recruiter-note--info mx-auto mt-6 max-w-md text-left">
            <p className="recruiter-note__title">Account ready</p>
            <p className="recruiter-note__body">
              <strong>Email:</strong> {formData.email}
            </p>
          </div>
          <p className="mt-6 text-sm text-fg-muted">
            Redirecting to login page in 3 seconds...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="recruiter-shell min-h-screen px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="recruiter-panel p-8 lg:p-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-accent-fill text-on-accent">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-fg">
            Create the master recruiter account
          </h1>

          <div className="mt-8 space-y-4">
            <div className="recruiter-note recruiter-note--warning">
              <p className="recruiter-note__title">Locked after completion</p>
              <p className="recruiter-note__body">
                This page locks once the account is created.
              </p>
            </div>
          </div>
        </section>

        <section className="recruiter-panel p-8">
          <div className="border-b border-line/70 pb-5">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">Account details</h2>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="recruiter-form-field">
              <label className="recruiter-form-label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                className="recruiter-form-input"
                placeholder="John Doe"
              />
            </div>

            <div className="recruiter-form-field">
              <label className="recruiter-form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="recruiter-form-input"
                placeholder="admin@njordships.com"
              />
            </div>

            <div className="recruiter-form-grid">
              <div className="recruiter-form-field">
                <label className="recruiter-form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                  className="recruiter-form-input"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="recruiter-form-field">
                <label className="recruiter-form-label" htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="recruiter-form-input"
                  placeholder="Re-enter password"
                />
              </div>
            </div>

            {error && (
              <div className="recruiter-note recruiter-note--danger">
                <p className="recruiter-note__title">Setup failed</p>
                <p className="recruiter-note__body">{error}</p>
              </div>
            )}

            <div className="recruiter-note recruiter-note--info">
              <p className="recruiter-note__title">Access level</p>
              <p className="recruiter-note__body">
                Full admin access, including managing recruiters.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="workspace-action-button workspace-action-button--primary w-full justify-center"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create Master Recruiter'
              )}
            </button>
          </form>

        </section>
      </div>
    </div>
  )
}
