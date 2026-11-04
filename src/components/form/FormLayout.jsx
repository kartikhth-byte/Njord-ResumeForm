/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAutoSave } from '../../hooks/useAutoSave'
import { supabase } from '../../lib/supabase'
import FormSidebar from './FormSidebar'
import FormNavigation from './FormNavigation'
import { clearActiveDraftId, getActiveDraftId, setActiveDraftId } from '../../utils/draftSession'

export default function FormLayout({ children }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [applicationId, setApplicationId] = useState(null)
  const [loading, setLoading] = useState(true)

  const {
    data: applicationData,
    updateData,
    saveStatus,
    lastSaved,
    isLoading: autoSaveLoading
  } = useAutoSave(applicationId)

  // Load application on mount
  useEffect(() => {
    if (user) {
      initializeApplication()
    }
  }, [user])

  const initializeApplication = async () => {
    try {
      setLoading(true)

      const persistedDraftId = getActiveDraftId()
      let app = null

      if (persistedDraftId) {
        const { data: persistedApp, error: persistedError } = await supabase
          .from('applications')
          .select('*')
          .eq('id', persistedDraftId)
          .eq('user_id', user.id)
          .eq('status', 'new')
          .is('submitted_at', null)
          .maybeSingle()

        if (persistedError && persistedError.code !== 'PGRST116') throw persistedError
        app = persistedApp
      }

      if (!app && persistedDraftId) {
        clearActiveDraftId()
      }

      if (!app) {
        const { data: latestApp, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'new')
          .is('submitted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (appError) throw appError
        app = latestApp
      }

      if (!app) {
        clearActiveDraftId()
        navigate('/dashboard')
        return
      }

      setActiveDraftId(app.id)

      // Ensure application_data row exists
      let { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('id')
        .eq('application_id', app.id)
        .maybeSingle()

      if (dataError && dataError.code !== 'PGRST116') throw dataError

      if (!appData) {
        const { error: insertError } = await supabase
          .from('application_data')
          .insert({
            application_id: app.id,
            data: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (insertError) throw insertError
      }

      // Set applicationId - hook will load data automatically
      setApplicationId(app.id)
    } catch (error) {
      console.error('Error initializing application:', error)
    } finally {
      setLoading(false)
    }
  }

  // updateData expects an updates object, not a function.
  const handleDataUpdate = (updates) => {
    updateData(updates)
  }

  // Provide context to children
  const contextValue = {
    currentData: applicationData,
    onDataUpdate: handleDataUpdate,
    applicationId,
    saveStatus,
    lastSaved
  }

  if (loading || autoSaveLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-raised">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-fg-secondary">Loading application...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="applicant-shell">
      <FormSidebar applicationData={applicationData} />

      <div className="flex min-w-0">
        {/* Main Content */}
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-5xl p-6">
            {/* Save status: shown only while saving, after a save, or on failure */}
            <div className="mb-3 flex min-h-5 justify-end text-xs" aria-live="polite">
              {saveStatus === 'saving' && <span className="text-fg-muted">Saving…</span>}
              {saveStatus === 'saved' && lastSaved && (
                <span className="text-fg-muted">Saved {new Date(lastSaved).toLocaleTimeString()}</span>
              )}
              {saveStatus === 'error' && <span className="text-danger">Not saved. Check your connection.</span>}
            </div>

            {/* Section Content */}
            <div className="applicant-panel p-6 md:p-8">
              {React.Children.map(children, child =>
                React.cloneElement(child, contextValue)
              )}
            </div>
            
            {/* Navigation */}
            <div className="mt-6">
              <FormNavigation />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
