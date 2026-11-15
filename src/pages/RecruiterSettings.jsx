import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterTeamSection from '../components/recruiter/RecruiterTeamSection'
import RecruiterWorksheetMappingsSection from '../components/recruiter/RecruiterWorksheetMappingsSection'
import PageHeader from '../components/ui/PageHeader'
import SegmentedControl from '../components/ui/SegmentedControl'

const TABS = [
  { key: 'team', label: 'Team' },
  { key: 'worksheets', label: 'Worksheet templates' },
]

export default function RecruiterSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut, isOperator } = useAuth()
  const { role, loading, canManageSettings } = usePermissions()
  const requested = searchParams.get('section')
  const activeTab = TABS.some((tab) => tab.key === requested) ? requested : 'team'

  if (loading) {
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-fg" aria-label="Loading" />
      </div>
    )
  }

  if (requested === 'integrations') {
    return <Navigate to={isOperator ? '/operator?section=platform' : '/recruiter/settings'} replace />
  }

  if (role !== 'Master Recruiter' && !canManageSettings()) {
    return <Navigate to="/recruiter/dashboard" replace />
  }

  return (
    <div className="recruiter-shell">
      <RecruiterTopbar
        user={user}
        profile={profile}
        role={role}
        signOut={signOut}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader title="Settings" />

          <SegmentedControl label="Settings sections" value={activeTab} onChange={key => setSearchParams(key === 'team' ? {} : { section: key })} options={TABS.map(tab => ({ value: tab.key, label: tab.label }))} size="sm" />

          <section role="tabpanel" className="recruiter-panel p-6">
            {activeTab === 'team' && <RecruiterTeamSection currentUserId={user?.id} />}
            {activeTab === 'worksheets' && <RecruiterWorksheetMappingsSection />}
          </section>
        </div>
      </div>
    </div>
  )
}
