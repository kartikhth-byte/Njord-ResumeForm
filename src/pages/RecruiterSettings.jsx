import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import RecruiterTeamSection from '../components/recruiter/RecruiterTeamSection'
import RecruiterIntegrationsSection from '../components/recruiter/RecruiterIntegrationsSection'
import RecruiterWorksheetMappingsSection from '../components/recruiter/RecruiterWorksheetMappingsSection'
import PageHeader from '../components/ui/PageHeader'
import { Users, KeyRound, ArrowRight, FileSpreadsheet } from 'lucide-react'

export default function RecruiterSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { role, loading, permissions, canManageTeam } = usePermissions()
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || null)
  const teamSectionRef = useRef(null)
  const integrationsSectionRef = useRef(null)
  const worksheetSectionRef = useRef(null)

  useEffect(() => {
    const section = searchParams.get('section')
    setActiveSection(section || null)
  }, [searchParams])

  useEffect(() => {
    if (activeSection === 'team' && teamSectionRef.current) {
      teamSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (activeSection === 'integrations' && integrationsSectionRef.current) {
      integrationsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (activeSection === 'worksheets' && worksheetSectionRef.current) {
      worksheetSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeSection])

  const openSection = (section) => {
    setSearchParams(section ? { section } : {})
  }

  if (loading) {
    return (
      <div className="recruiter-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-fg" />
          <p className="text-fg-secondary">Loading settings workspace...</p>
        </div>
      </div>
    )
  }

  if (role !== 'Master Recruiter' && !permissions.includes('manage_runtime_settings') && !permissions.includes('manage_settings')) {
    return <Navigate to="/recruiter/dashboard" replace />
  }

  const settingsCards = [
    {
      key: 'team',
      title: 'Team',
      icon: Users,
      onClick: () => openSection(activeSection === 'team' ? null : 'team'),
      visible: canManageTeam()
    },
    {
      key: 'integrations',
      title: 'Integrations',
      icon: KeyRound,
      onClick: () => openSection(activeSection === 'integrations' ? null : 'integrations'),
      visible: true
    },
    {
      key: 'worksheets',
      title: 'Worksheet templates',
      icon: FileSpreadsheet,
      onClick: () => openSection(activeSection === 'worksheets' ? null : 'worksheets'),
      visible: true
    }
  ].filter(card => card.visible)

  return (
    <div className="recruiter-shell">
      <RecruiterTopbar
        user={user}
        profile={profile}
        role={role}
        signOut={signOut}
      />
      <RecruiterWorkspaceNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            title="Settings"
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {settingsCards.map(card => {
              const CardIcon = card.icon
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  aria-pressed={activeSection === card.key}
                  className={`flex items-center gap-3 rounded-card border p-4 text-left transition ${
                    activeSection === card.key ? 'border-accent bg-raised' : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <CardIcon className="h-5 w-5 text-accent" />
                  <span className="flex-1 text-base font-medium text-fg">{card.title}</span>
                  <ArrowRight className="h-4 w-4 text-fg-muted" />
                </button>
              )
            })}
          </div>

          {canManageTeam() && activeSection === 'team' ? (
            <section ref={teamSectionRef} className="recruiter-panel p-6">
              <RecruiterTeamSection currentUserId={user?.id} embedded />
            </section>
          ) : null}

          {activeSection === 'integrations' ? (
            <section ref={integrationsSectionRef} className="recruiter-panel p-6">
              <RecruiterIntegrationsSection />
            </section>
          ) : null}

          {activeSection === 'worksheets' ? (
            <section ref={worksheetSectionRef} className="recruiter-panel p-6">
              <RecruiterWorksheetMappingsSection />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
