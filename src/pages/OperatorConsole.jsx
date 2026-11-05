import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterIntegrationsSection from '../components/recruiter/RecruiterIntegrationsSection'
import OperatorHealthSection from '../components/operator/OperatorHealthSection'
import { aiSearchEnabled } from '../lib/needle'
import PageHeader from '../components/ui/PageHeader'

// Operator console (docs/needle-in-holmes-design.md section 5). Platform
// settings moved here from organization Settings → Integrations.
const TABS = [
  { key: 'health', label: 'Health' },
  { key: 'platform', label: 'Platform settings' },
  { key: 'ai', label: 'AI' },
]

export default function OperatorConsole() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, role, signOut } = useAuth()
  const requested = searchParams.get('section')
  const activeTab = TABS.some((tab) => tab.key === requested) ? requested : 'health'

  return (
    <div className="recruiter-shell">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader title="Operator" />

          <div role="tablist" aria-label="Operator" className="flex gap-1 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setSearchParams(tab.key === 'health' ? {} : { section: tab.key })}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? 'border-teal-700 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section role="tabpanel" className="recruiter-panel p-6">
            {activeTab === 'health' && <OperatorHealthSection />}
            {activeTab === 'platform' && <RecruiterIntegrationsSection />}
            {activeTab === 'ai' && (aiSearchEnabled() ? <div className="space-y-4">
              <p className="text-sm text-slate-600">Review conversion issues and pending facts against the original résumé. Approval remains an operator action.</p>
              <div className="flex flex-wrap gap-3">
                <Link className="underline" to="/recruiter/ai/review">Review queue</Link>
                <Link className="underline" to="/recruiter/ai/admin/facts-review">Facts approval</Link>
                <Link className="underline" to="/recruiter/ai/admin/settings">AI settings</Link>
                <Link className="underline" to="/recruiter/ai/admin/evals">Evaluations</Link>
              </div>
            </div> : <p className="text-sm text-slate-600">AI search is not enabled in this environment.</p>)}
          </section>
        </div>
      </div>
    </div>
  )
}
