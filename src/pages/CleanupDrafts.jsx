import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Wrench, ArrowLeft, Sparkles } from 'lucide-react'

export default function CleanupDrafts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const cleanupDuplicates = async () => {
    if (!user) {
      setStatus('❌ Please login first')
      return
    }

    try {
      setLoading(true)
      setStatus('🔍 Checking for duplicate drafts...')

      // Get all in-progress applications
      const { data: drafts, error } = await supabase
        .from('applications')
        .select('id, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'new')
        .is('submitted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      setStatus(`Found ${drafts?.length || 0} draft(s)`)

      if (!drafts || drafts.length <= 1) {
        setStatus('✅ No duplicate drafts found!')
        return
      }

      setStatus(`🗑️ Deleting ${drafts.length - 1} duplicate draft(s)...`)

      // Keep the most recent, delete the rest
      const draftsToDelete = drafts.slice(1)

      for (const draft of draftsToDelete) {
        console.log('Deleting:', draft.id)

        // Delete application_data first
        await supabase
          .from('application_data')
          .delete()
          .eq('application_id', draft.id)

        // Delete application
        await supabase
          .from('applications')
          .delete()
          .eq('id', draft.id)
      }

      setStatus(`✅ Success! Deleted ${draftsToDelete.length} duplicate draft(s). You can now go back to Dashboard.`)
    } catch (error) {
      console.error('Error:', error)
      setStatus(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="applicant-shell">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Applicant Utility"
          title="Clean Up Duplicate Drafts"
          description="Use this recovery tool if multiple in-progress application drafts were created for the same applicant."
          actions={
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="applicant-action applicant-action--secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          }
        />

        <div className="utility-card mt-8 overflow-hidden">
          <div className="utility-card__header">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Draft recovery</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  The tool keeps the most recent `new` draft with no `submitted_at` value and removes older duplicates.
                </p>
              </div>
            </div>
          </div>

          <div className="utility-card__body">
            {status ? (
              <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="whitespace-pre-wrap text-sm text-blue-900">{status}</p>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                <div className="text-sm leading-6 text-amber-900">
                  <p className="font-semibold">What this does</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Finds all draft applications with status `new` and no submission timestamp.</li>
                    <li>Keeps the most recently created draft.</li>
                    <li>Deletes older duplicate rows from `application_data` and `applications`.</li>
                    <li>Safe to run more than once.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={cleanupDuplicates}
                disabled={loading}
                className="applicant-action applicant-action--primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Processing...' : 'Clean Up Duplicates'}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="applicant-action applicant-action--secondary"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
