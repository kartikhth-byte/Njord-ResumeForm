import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Loader2, UserCog, Wand2 } from 'lucide-react'

const ALLOWED_RECRUITER_ROLES = ['Master Recruiter', 'Recruiter', 'Coordinator']

export default function EditRecruiterModal({ isOpen, onClose, onSuccess, member }) {
  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    roleId: ''
  })
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load roles and populate form when modal opens
  useEffect(() => {
    if (isOpen && member) {
      loadRoles()
      setFormData({
        fullName: member.full_name || '',
        password: '',
        roleId: member.role_id || ''
      })
    }
  }, [isOpen, member])

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
      const updateBody = {
        action: 'update',
        user_id: member.user_id,
        ...(formData.fullName && formData.fullName !== member.full_name && { full_name: formData.fullName }),
        ...(formData.password && { password: formData.password }),
        ...(formData.roleId && formData.roleId !== member.role_id && { role_id: formData.roleId })
      }


      // Call edge function to update recruiter
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-recruiter',
        {
          body: updateBody
        }
      )


      if (functionError) {
        const errorMessage = data?.error || functionError.message || 'Failed to update recruiter'
        console.error('Function error:', errorMessage)
        throw new Error(errorMessage)
      }

      if (data?.error) {
        console.error('Data error:', data.error)
        throw new Error(data.error)
      }

      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error updating recruiter:', error)
      setError(error.message || 'Failed to update recruiter')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ fullName: '', password: '', roleId: '' })
    setError(null)
    onClose()
  }

  if (!isOpen || !member) return null

  return (
    <div className="recruiter-modal-backdrop overflow-y-auto">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="recruiter-modal recruiter-modal--narrow relative my-auto flex flex-col">
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h2 className="recruiter-modal__title">Edit member</h2>
              <p className="recruiter-modal__subtitle">{member.email}</p>
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
                <label className="recruiter-form-label">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="recruiter-form-input"
                />
              </div>

              <div className="recruiter-form-field recruiter-form-field--full">
                <label className="recruiter-form-label">Role</label>
                <select
                  value={formData.roleId}
                  onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                  className="recruiter-form-select"
                >
                  {member.role_id ? null : <option value="">Select role</option>}
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="recruiter-form-field recruiter-form-field--full">
                <label className="recruiter-form-label">New Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="recruiter-form-input font-mono text-sm"
                    placeholder="Leave empty to keep current password"
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
              </div>

              {error ? (
                <div className="recruiter-form-field recruiter-form-field--full">
                  <div className="recruiter-note recruiter-note--danger">
                    <p className="recruiter-note__title">Unable to update recruiter</p>
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
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
