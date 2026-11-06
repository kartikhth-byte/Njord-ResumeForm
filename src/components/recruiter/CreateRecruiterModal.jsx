import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Loader2, ShieldPlus, Wand2 } from 'lucide-react'

const ALLOWED_RECRUITER_ROLES = ['Master Recruiter', 'Recruiter', 'Coordinator']

export default function CreateRecruiterModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    roleId: ''
  })
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load roles when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRoles()
    }
  }, [isOpen])

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .in('name', ALLOWED_RECRUITER_ROLES)

      if (error) throw error
      const orderedRoles = ALLOWED_RECRUITER_ROLES
        .map(roleName => (data || []).find(role => role.name === roleName))
        .filter(Boolean)

      setRoles(orderedRoles)
      
      const defaultRole = orderedRoles.find(r => r.name === 'Recruiter')
      if (defaultRole) {
        setFormData(prev => ({ ...prev, roleId: defaultRole.id }))
      }
    } catch (error) {
      console.error('Error loading roles:', error)
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
  }

const handleSubmit = async (e) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

  try {
    // Call edge function to create recruiter
    const { data, error: functionError } = await supabase.functions.invoke(
      'create-recruiter',
      {
        body: {
          action: 'create',
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
          role_id: formData.roleId
        }
      }
    )


    // Check for errors
    if (functionError) {
      // Extract actual error message from the response
      const errorMessage = data?.error || functionError.message || 'Unknown error occurred'
      console.error('Function failed:', errorMessage)
      throw new Error(errorMessage)
    }

    if (data?.error) {
      console.error('Data contains error:', data.error)
      throw new Error(data.error)
    }

    // Success!
    alert(`Added ${formData.email}.\nPassword: ${formData.password}\nShare it with them securely.`)
    
    onSuccess()
    handleClose()
  } catch (error) {
    console.error('Error creating recruiter:', error)
    setError(error.message || 'Failed to create recruiter')
  } finally {
    setLoading(false)
  }
}


  const handleClose = () => {
    setFormData({ email: '', fullName: '', password: '', roleId: '' })
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="recruiter-modal-backdrop overflow-y-auto">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="recruiter-modal recruiter-modal--narrow relative my-auto flex flex-col">
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <ShieldPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="recruiter-modal__title">Add member</h2>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="recruiter-modal__close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="recruiter-modal__body flex-1">
            <div className="recruiter-form-grid">
              <div className="recruiter-form-field recruiter-form-field--full">
                <label className="recruiter-form-label">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="recruiter-form-input"
                />
              </div>

              <div className="recruiter-form-field recruiter-form-field--full">
                <label className="recruiter-form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="recruiter-form-input"
                />
              </div>

              <div className="recruiter-form-field recruiter-form-field--full">
                <label className="recruiter-form-label">Password *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    minLength={8}
                    className="recruiter-form-input font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="workspace-action-button workspace-action-button--secondary whitespace-nowrap"
                  >
                    <Wand2 className="h-4 w-4" />
                    Generate
                  </button>
                </div>
                <p className="recruiter-form-hint">At least 8 characters.</p>
              </div>

              <div className="recruiter-form-field recruiter-form-field--full">
                <label className="recruiter-form-label">Role *</label>
                <select
                  required
                  value={formData.roleId}
                  onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                  className="recruiter-form-select"
                >
                  <option value="">Select role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {formData.roleId ? (
                  <p className="recruiter-form-hint">
                    {roles.find(role => role.id === formData.roleId)?.description}
                  </p>
                ) : null}
              </div>

              {error ? (
                <div className="recruiter-form-field recruiter-form-field--full">
                  <div className="recruiter-note recruiter-note--danger">
                    <p className="recruiter-note__title">Unable to create recruiter</p>
                    <p className="recruiter-note__body">{error}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="recruiter-modal__footer">
            <button
              type="button"
              onClick={handleClose}
              className="workspace-action-button workspace-action-button--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="workspace-action-button workspace-action-button--primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add member'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
