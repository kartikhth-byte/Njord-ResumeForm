import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import CreateRecruiterModal from './CreateRecruiterModal'
import EditRecruiterModal from './EditRecruiterModal'
import { Plus, Trash2, Edit, Mail } from 'lucide-react'

const getRoleTone = roleName => {
  if (roleName === 'Master Recruiter') return 'bg-progress-soft text-progress'
  if (roleName === 'Recruiter') return 'bg-accent-soft text-accent-text'
  if (roleName === 'Coordinator') return 'bg-success-soft text-success'
  return 'bg-raised text-fg-secondary'
}

export default function RecruiterTeamSection({ currentUserId }) {
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [resettingMemberId, setResettingMemberId] = useState(null)

  useEffect(() => {
    loadTeamMembers()
  }, [])

  const masterRecruiterCount = teamMembers.filter(member => member.role_name === 'Master Recruiter').length

  const loadTeamMembers = async () => {
    try {
      setLoading(true)

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

      const transformedData =
        data?.map(member => ({
          user_id: member.id,
          full_name: member.full_name || 'Unknown',
          email: member.email || 'Unknown',
          role_id: member.user_roles?.[0]?.roles?.id || '',
          role_name: member.user_roles?.[0]?.roles?.name || 'Unknown',
          created_at: member.created_at,
        })) || []

      setTeamMembers(transformedData)
    } catch (error) {
      console.error('Error loading team members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMember = async (memberId, memberEmail) => {
    const member = teamMembers.find(entry => entry.user_id === memberId)

    if (member?.role_name === 'Master Recruiter' && masterRecruiterCount <= 1) return

    if (!confirm(`Remove ${memberEmail} from the recruiter team? This cannot be undone.`)) {
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-recruiter', {
        body: {
          action: 'delete',
          user_id: memberId,
        },
      })

      if (error) {
        throw new Error(data?.error || error.message || 'Failed to remove team member')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      loadTeamMembers()
    } catch (error) {
      console.error('Error deleting member:', error)
      alert(`Failed to remove team member: ${error.message}`)
    }
  }

  const handleEditMember = member => {
    setSelectedMember(member)
    setShowEditModal(true)
  }

  const handleSendResetEmail = async (member) => {
    if (!member?.email) {
      alert('This recruiter account does not have an email address to send a reset link to.')
      return
    }

    if (!confirm(`Send a password reset email to ${member.email}?`)) {
      return
    }

    try {
      setResettingMemberId(member.user_id)

      const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
        redirectTo: `${window.location.origin}/recruiter/reset-password`,
      })

      if (error) throw error

      alert(`Password reset email sent to ${member.email}.`)
    } catch (error) {
      console.error('Error sending recruiter reset email:', error)
      alert(`Failed to send reset email: ${error.message}`)
    } finally {
      setResettingMemberId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="workspace-action-button workspace-action-button--primary"
        >
          <Plus className="h-4 w-4" />
          Add member
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[10rem] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-fg" aria-label="Loading" />
        </div>
      ) : (
        <div className="divide-y divide-line/70 rounded-card border border-line">
          {teamMembers.map(member => {
            const isSelf = member.user_id === currentUserId
            const isLastMaster = member.role_name === 'Master Recruiter' && masterRecruiterCount <= 1
            return (
              <article key={member.user_id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-fg">{member.full_name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleTone(member.role_name)}`}>
                        {member.role_name}
                      </span>
                      {isSelf ? (
                        <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-fg-secondary">{member.email}</p>
                  </div>

                  {isSelf ? null : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendResetEmail(member)}
                        disabled={resettingMemberId === member.user_id}
                        className="workspace-action-button workspace-action-button--secondary"
                      >
                        <Mail className="h-4 w-4" />
                        {resettingMemberId === member.user_id ? 'Sending...' : 'Send reset email'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditMember(member)}
                        className="workspace-action-button workspace-action-button--secondary"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member.user_id, member.email)}
                        disabled={isLastMaster}
                        title={isLastMaster ? 'Make someone else a Master Recruiter first' : undefined}
                        className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-[14px] border border-danger-line bg-danger-soft px-4 py-3 font-semibold text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <CreateRecruiterModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadTeamMembers}
      />

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
