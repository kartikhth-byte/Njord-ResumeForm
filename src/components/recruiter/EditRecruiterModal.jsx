import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Loader2 } from 'lucide-react'

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
        .from('roles')  // ✅ Fixed: Changed from 'recruiter_roles' to 'roles'
        .select('*')
        .order('name')  // ✅ Fixed: Changed from 'level' to 'name'

      if (error) throw error
      setRoles(data || [])
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

      console.log('=== UPDATE REQUEST ===')
      console.log('Member:', member)
      console.log('Form data:', formData)
      console.log('Sending body:', updateBody)
      console.log('=====================')

      // Call edge function to update recruiter
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-recruiter',
        {
          body: updateBody
        }
      )

      console.log('=== RESPONSE ===')
      console.log('Data:', data)
      console.log('Error:', functionError)
      console.log('================')

      if (functionError) {
        const errorMessage = data?.error || functionError.message || 'Failed to update recruiter'
        console.error('Function error:', errorMessage)
        throw new Error(errorMessage)
      }

      if (data?.error) {
        console.error('Data error:', data.error)
        throw new Error(data.error)
      }

      // Build success message
      const changes = []
      if (formData.fullName && formData.fullName !== member.full_name) changes.push('name')
      if (formData.password) changes.push('password')
      if (formData.roleId && formData.roleId !== member.role_id) changes.push('role')

      alert(`✅ Updated successfully: ${changes.join(', ')}`)
      
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleClose}></div>
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Edit Team Member</h2>
            <p className="text-sm text-gray-600 mb-6">{member.email}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Keep current role</option>
{roles
  .filter(role => role.name !== 'Applicant')
  .map(role => (
    <option key={role.id} value={role.id}>
      {role.name}
    </option>
  ))}                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Current: {member.role_name}  {/* ✅ Fixed: Changed from role_display_name to role_name */}
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Leave empty to keep current"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Only fill if you want to reset the password
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
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
      </div>
    </div>
  )
}