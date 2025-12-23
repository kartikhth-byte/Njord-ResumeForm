import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Loader2 } from 'lucide-react'

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
        .from('roles')  // ✅ Fixed table name
        .select('*')
        .order('name')  // ✅ Fixed order column

      if (error) throw error
      setRoles(data || [])
      
      // Set default role to 'Recruiter'
      const defaultRole = data?.find(r => r.name === 'Recruiter')
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
    console.log('Sending request with data:', {
      action: 'create',
      full_name: formData.fullName,
      email: formData.email,
      role_id: formData.roleId
    })

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

    console.log('=== FULL RESPONSE ===')
    console.log('Data:', JSON.stringify(data, null, 2))
    console.log('Error:', JSON.stringify(functionError, null, 2))
    console.log('====================')

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
    alert(`✅ Recruiter Created Successfully!\n\n📧 Email: ${formData.email}\n🔑 Password: ${formData.password}\n\n⚠️ Please save these credentials and share them securely with the new team member.`)
    
    onSuccess()
    handleClose()
  } catch (error) {
    console.error('=== ERROR CAUGHT ===')
    console.error('Error object:', error)
    console.error('Error message:', error.message)
    console.error('==================')
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Team Member</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="recruiter@example.com"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select role</option>
{roles
  .filter(role => role.name !== 'Applicant')
  .map(role => (
    <option key={role.id} value={role.id}>
      {role.name}
    </option>
  ))}
                </select>
                {formData.roleId && (
                  <p className="text-xs text-gray-500 mt-1">
                    {roles.find(r => r.id === formData.roleId)?.description}
                  </p>
                )}
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
                      Creating...
                    </>
                  ) : (
                    'Create Recruiter'
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