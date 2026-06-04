import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import RecruiterTeamSection from '../components/recruiter/RecruiterTeamSection'
import RecruiterIntegrationsSection from '../components/recruiter/RecruiterIntegrationsSection'
import RecruiterWorksheetMappingsSection from '../components/recruiter/RecruiterWorksheetMappingsSection'
import PageHeader from '../components/ui/PageHeader'
import { Users, KeyRound, ArrowRight, X, FileSpreadsheet } from 'lucide-react'

export default function RecruiterSettings() {
  const navigate = useNavigate()
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
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900" />
          <p className="text-slate-600">Loading settings workspace...</p>
        </div>
      </div>
    )
  }

  if (role !== 'Master Recruiter' && !permissions.includes('manage_runtime_settings') && !permissions.includes('manage_settings')) {
    navigate('/recruiter/dashboard', { replace: true })
    return null
  }

  const settingsCards = [
    {
      key: 'team',
      eyebrow: 'Access Control',
      title: 'Team Management',
      description: 'Manage recruiter accounts, role coverage, and access across the hiring team.',
      icon: Users,
      onClick: () => openSection('team'),
      visible: canManageTeam()
    },
    {
      key: 'integrations',
      eyebrow: 'Runtime Config',
      title: 'Integrations & Secrets',
      description: 'Manage Microsoft, mail, AI, and app runtime values without editing environment files.',
      icon: KeyRound,
      onClick: () => openSection('integrations'),
      visible: true
    },
    {
      key: 'worksheets',
      eyebrow: 'Customer Documents',
      title: 'Worksheet Templates & Mappings',
      description: 'Upload customer worksheet templates and adjust the field-to-cell mapping section by section.',
      icon: FileSpreadsheet,
      onClick: () => openSection('worksheets'),
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
            eyebrow="Recruiter Admin"
            title="Settings"
            description="Manage the recruiter workspace entry points and admin surfaces from one place."
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {settingsCards.map(card => {
              const CardIcon = card.icon
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  className="recruiter-panel p-6 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">{card.eyebrow}</p>
                      <h2 className="mt-3 text-xl font-semibold text-gray-900">{card.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-gray-600">{card.description}</p>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      <CardIcon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    Open section
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              )
            })}
          </div>

          {canManageTeam() && activeSection === 'team' ? (
            <section ref={teamSectionRef} className="recruiter-panel p-6">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Active Section</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Team Management</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openSection(null)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                  Close section
                </button>
              </div>
              <RecruiterTeamSection currentUserId={user?.id} embedded />
            </section>
          ) : null}

          {activeSection === 'integrations' ? (
            <section ref={integrationsSectionRef} className="recruiter-panel p-6">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Active Section</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Integrations &amp; Secrets</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openSection(null)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                  Close section
                </button>
              </div>
              <RecruiterIntegrationsSection />
            </section>
          ) : null}

          {activeSection === 'worksheets' ? (
            <section ref={worksheetSectionRef} className="recruiter-panel p-6">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Active Section</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Worksheet Templates &amp; Mappings</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openSection(null)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                  Close section
                </button>
              </div>
              <RecruiterWorksheetMappingsSection />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
