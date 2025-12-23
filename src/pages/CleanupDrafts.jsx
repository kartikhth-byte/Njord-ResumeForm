import { useState } from 'react'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'

export default function CleanupDrafts() {
  const { user } = useAuth()
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          🧹 Cleanup Duplicate Drafts
        </h1>
        
        <p className="text-gray-600 mb-6">
          This tool will remove duplicate draft applications, keeping only the most recent one.
        </p>

        {status && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm whitespace-pre-wrap">{status}</p>
          </div>
        )}

        <button
          onClick={cleanupDuplicates}
          disabled={loading}
          className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '🔄 Processing...' : '🧹 Clean Up Duplicates'}
        </button>

        <button
          onClick={() => window.location.href = '/dashboard'}
          className="w-full mt-3 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          ← Back to Dashboard
        </button>

        <div className="mt-6 text-xs text-gray-500">
          <p className="font-semibold mb-2">What this does:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Finds all draft applications (status='new', not submitted)</li>
            <li>Keeps the most recent one</li>
            <li>Deletes all older duplicates</li>
            <li>Safe to run multiple times</li>
          </ul>
        </div>
      </div>
    </div>
  )
}