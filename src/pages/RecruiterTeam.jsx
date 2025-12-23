import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import CreateRecruiterModal from '../components/recruiter/CreateRecruiterModal'
import EditRecruiterModal from '../components/recruiter/EditRecruiterModal'
import { Users, Plus, Shield, AlertCircle, Trash2, Edit } from 'lucide-react'  // Added Edit

export default function RecruiterTeam() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canManageTeam, loading: permLoading } = usePermissions(user)
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
const [showEditModal, setShowEditModal] = useState(false)
const [selectedMember, setSelectedMember] = useState(null)
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false)

  // Check permission once when loading is complete
  useEffect(() => {
    if (!permLoading && !hasCheckedPermission) {
      setHasCheckedPermission(true)
      if (!canManageTeam()) {
        navigate('/dashboard')
      }
    }
  }, [permLoading, hasCheckedPermission, navigate])

  // Load team members when user is available and has permission
  useEffect(() => {
    if (user && !permLoading && canManageTeam() && hasCheckedPermission) {
      loadTeamMembers()
    }
  }, [user, permLoading, hasCheckedPermission])

// ============================================================================
// FIXED loadTeamMembers FUNCTION for RecruiterTeam.jsx
// Replace lines 40-77 with this
// ============================================================================

const loadTeamMembers = async () => {
  try {
    setLoading(true)

    // Get team members with their roles - specify the relationship explicitly!
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        user_type,
        created_at,
        user_roles!user_roles_user_id_fkey(
          role_id,
          assigned_at,
          roles!inner(
            id,
            name
          )
        )
      `)
      .eq('user_type', 'recruiter')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform the data
    const transformedData = data?.map(member => ({
      user_id: member.id,
      full_name: member.full_name || 'Unknown',
      email: member.email || 'Unknown',
      role_id: member.user_roles?.[0]?.roles?.id || '',
      role_name: member.user_roles?.[0]?.roles?.name || 'Unknown',
      created_at: member.created_at
    })) || []

    console.log('Team members loaded:', transformedData.length)
    setTeamMembers(transformedData)
  } catch (error) {
    console.error('Error loading team members:', error)
  } finally {
    setLoading(false)
  }
}

  const handleDeleteMember = async (memberId, memberEmail) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from the team? This cannot be undone.`)) {
      return
    }

    try {
      // Delete user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', memberId)

      if (roleError) throw roleError

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', memberId)

      if (profileError) throw profileError

      // Log audit
      await supabase
        .from('audit_log')
        .insert({
          user_id: user.id,
          action: 'delete_recruiter',
          resource_type: 'user',
          resource_id: memberId,
          details: { email: memberEmail }
        })

      alert('Team member removed successfully')
      loadTeamMembers()
    } catch (error) {
      console.error('Error deleting member:', error)
      alert('Failed to remove team member: ' + error.message)
    }
  }

  const handleEditMember = (member) => {
  setSelectedMember(member)
  setShowEditModal(true)
}

  if (permLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team...</p>
        </div>
      </div>
    )
  }

  if (!canManageTeam()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to manage team members.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
  onClick={() => navigate('/recruiter/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                <p className="text-sm text-gray-600">Manage recruiter team members and roles</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Team Member
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
{/* Stats */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  <div className="bg-white rounded-lg shadow-sm border p-6">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-blue-100 rounded-lg">
        <Users className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <p className="text-sm text-gray-600">Total Team Members</p>
        <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
      </div>
    </div>
  </div>

  <div className="bg-white rounded-lg shadow-sm border p-6">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-purple-100 rounded-lg">
        <Shield className="w-6 h-6 text-purple-600" />
      </div>
      <div>
        <p className="text-sm text-gray-600">Master Recruiters</p>
        <p className="text-2xl font-bold text-gray-900">
          {teamMembers.filter(m => m.role_name === 'Master Recruiter').length}
        </p>
      </div>
    </div>
  </div>

  <div className="bg-white rounded-lg shadow-sm border p-6">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-green-100 rounded-lg">
        <Users className="w-6 h-6 text-green-600" />
      </div>
      <div>
        <p className="text-sm text-gray-600">Regular Recruiters</p>
        <p className="text-2xl font-bold text-gray-900">
          {teamMembers.filter(m => m.role_name === 'Recruiter').length}
        </p>
      </div>
    </div>
  </div>
</div>

        {/* Team Members List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          </div>

          <div className="divide-y">
 {teamMembers.map((member) => (
  <div key={member.user_id} className="p-6 hover:bg-gray-50 transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {member.full_name}
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            member.role_name === 'Master Recruiter' 
              ? 'bg-purple-100 text-purple-800' 
              : member.role_name === 'Recruiter'
              ? 'bg-blue-100 text-blue-800'
              : member.role_name === 'Viewer'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {member.role_name}
          </span>
          {member.user_id === user.id && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
              You
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{member.email}</p>
        <p className="text-xs text-gray-500 mt-1">
          Joined {new Date(member.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </p>
      </div>

      {member.user_id !== user.id && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEditMember(member)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit member"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteMember(member.user_id, member.email)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
))}


            {teamMembers.length === 0 && (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No team members yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add your first team member
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

 {/* Create Modal */}
<CreateRecruiterModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onSuccess={loadTeamMembers}
/>

{/* Edit Modal */}
<EditRecruiterModal
  isOpen={showEditModal}
  onClose={() => {
    setShowEditModal(false)
    setSelectedMember(null)
  }}
  onSuccess={loadTeamMembers}
  member={selectedMember}
/>
    </div>
  )
}