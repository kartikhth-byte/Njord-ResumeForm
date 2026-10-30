import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import CreateRecruiterModal from './CreateRecruiterModal'
import EditRecruiterModal from './EditRecruiterModal'
import StatCard from '../ui/StatCard'
import EmptyState from '../ui/EmptyState'
import {
  Users,
  Plus,
  Shield,
  AlertCircle,
  Trash2,
  Edit,
  Mail,
  UserRound,
  BadgeCheck,
} from 'lucide-react'

const getRoleTone = roleName => {
  if (roleName === 'Master Recruiter') return 'bg-progress-soft text-progress'
  if (roleName === 'Recruiter') return 'bg-accent-soft text-accent-text'
  if (roleName === 'Coordinator') return 'bg-success-soft text-success'
  return 'bg-raised text-fg-secondary'
}

export default function RecruiterTeamSection({ currentUserId, embedded = false }) {
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
  const recruiterCount = teamMembers.filter(member => member.role_name === 'Recruiter').length
  const coordinatorCount = teamMembers.filter(member => member.role_name === 'Coordinator').length

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

    if (member?.role_name === 'Master Recruiter' && masterRecruiterCount <= 1) {
      alert('You cannot remove the last Master Recruiter. Promote another user first.')
      return
    }

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

      alert('Team member removed successfully')
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
    <div className={embedded ? 'space-y-6' : ''}>
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-start ${embedded ? 'sm:justify-end' : 'sm:justify-between'}`}>
        {embedded ? null : (
          <div>
            <h2 className="text-2xl font-semibold text-fg">Team</h2>
          </div>
        )}

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
        <div className="recruiter-panel flex min-h-[16rem] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-fg" />
            <p className="text-fg-secondary">Loading team workspace...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Team Members"
              value={teamMembers.length}
              icon={Users}
            />
            <StatCard
              label="Master Recruiters"
              value={masterRecruiterCount}
              tone="accent"
              icon={Shield}
            />
            <StatCard
              label="Recruiters"
              value={recruiterCount}
              tone="success"
              icon={BadgeCheck}
            />
            <StatCard
              label="Coordinators"
              value={coordinatorCount}
              icon={BadgeCheck}
            />
          </div>

          <section className="recruiter-panel overflow-hidden">
            <div className="border-b border-line/70 px-6 py-5">
              <h2 className="mt-2 text-xl font-semibold text-fg">Recruiter accounts</h2>
            </div>

            <div className="divide-y divide-line/70">
              {teamMembers.map(member => (
                <article key={member.user_id} className="px-6 py-5 transition-colors hover:bg-surface/60">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-card bg-accent-fill text-on-accent">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-fg">{member.full_name}</h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleTone(member.role_name)}`}
                            >
                              {member.role_name}
                            </span>
                            {member.user_id === currentUserId ? (
                              <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                                You
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-fg-secondary">
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {member.email}
                            </span>
                            <span>
                              Joined{' '}
                              {new Date(member.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-center">
                      {member.role_name === 'Master Recruiter' ? (
                        <button
                          type="button"
                          onClick={() => handleSendResetEmail(member)}
                          disabled={resettingMemberId === member.user_id}
                          className="workspace-action-button workspace-action-button--secondary"
                        >
                          <Mail className="h-4 w-4" />
                          {resettingMemberId === member.user_id ? 'Sending...' : 'Send reset email'}
                        </button>
                      ) : null}
                      {member.user_id !== currentUserId ? (
                        <>
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
                            disabled={member.role_name === 'Master Recruiter' && masterRecruiterCount <= 1}
                            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-[14px] border border-danger-line bg-danger-soft px-4 py-3 font-semibold text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                          {member.role_name === 'Master Recruiter' && masterRecruiterCount <= 1 ? (
                            <p className="text-xs font-medium text-fg-muted">Promote another master recruiter first.</p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}

              {teamMembers.length === 0 ? (
                <div className="px-6 py-8">
                  <EmptyState
                    icon={Users}
                    title="No recruiter accounts yet"
                    action={
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className="workspace-action-button workspace-action-button--primary"
                      >
                        <Plus className="h-4 w-4" />
                        Add First Team Member
                      </button>
                    }
                  />
                </div>
              ) : null}
            </div>
          </section>
        </>
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
