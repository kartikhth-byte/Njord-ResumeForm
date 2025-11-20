import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import Navbar from '../layout/Navbar'
import FormSidebar from './FormSidebar'
import FormNavigation from './FormNavigation'

export default function FormLayout({ children }) {
  const { sectionId } = useParams()
  const { user } = useAuth()
  const [applicationData, setApplicationData] = useState({})
  const [applicationId, setApplicationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [saveTimeout, setSaveTimeout] = useState(null)

  // Load application data on mount
  useEffect(() => {
    loadApplicationData()
  }, [user])

  const loadApplicationData = async () => {
    try {
      setLoading(true)

      // Get draft application
      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .single()

      if (appError) {
        console.error('Error loading application:', appError)
        return
      }

      setApplicationId(app.id)

      // Get application data
      const { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('*')
        .eq('application_id', app.id)
        .single()

      if (dataError) throw dataError

      console.log('Loaded existing data:', appData?.data)
      setApplicationData(appData?.data || {})
    } catch (error) {
      console.error('Error loading application data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-save function with debouncing
  const handleDataUpdate = (updates) => {
    // Update local state immediately for responsiveness
    setApplicationData(prev => ({
      ...prev,
      ...updates
    }))

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    // Set new timeout for auto-save (debounce)
    const timeout = setTimeout(() => {
      saveData({
        ...applicationData,
        ...updates
      })
    }, 2000) // Save after 2 seconds of no changes

    setSaveTimeout(timeout)
  }

  const saveData = async (dataToSave) => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('application_data')
        .update({
          data: dataToSave,
          updated_at: new Date().toISOString()
        })
        .eq('application_id', applicationId)

      if (error) throw error

      // Also update applications table timestamp
      await supabase
        .from('applications')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      setLastSaved(new Date())
      console.log('Auto-saved successfully')
    } catch (error) {
      console.error('Error saving data:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile: Show Navbar */}
      <div className="lg:hidden">
        <Navbar />
      </div>

      {/* Desktop & Mobile Layout */}
      <div className="flex h-screen">
        {/* Desktop: Left Sidebar - Hidden on mobile */}
        <div className="hidden lg:block">
          <FormSidebar applicationData={applicationData} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile: Horizontal Section Navigation */}
          <div className="lg:hidden sticky top-0 z-10 bg-white border-b">
            <FormNavigation applicationData={applicationData} />
          </div>

          {/* Form Content - Scrollable */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Auto-save Indicator */}
              <div className="mb-4 flex items-center justify-end gap-2 text-sm">
                {saving ? (
                  <span className="text-gray-500 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    Saving...
                  </span>
                ) : lastSaved ? (
                  <span className="text-green-600 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Saved {formatTimeSince(lastSaved)}
                  </span>
                ) : null}
              </div>

              {/* Section Content */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
                {React.cloneElement(children, {
                  data: applicationData[`section${sectionId}`] || {},
                  onUpdate: handleDataUpdate,
                  currentData: applicationData
                })}
              </div>

              {/* Bottom Navigation */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => {
                    const prevSection = Math.max(1, parseInt(sectionId) - 1)
                    window.location.href = `/application/form/section/${prevSection}`
                  }}
                  disabled={parseInt(sectionId) === 1}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    parseInt(sectionId) === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <button
                  onClick={() => {
                    const nextSection = Math.min(20, parseInt(sectionId) + 1)
                    window.location.href = `/application/form/section/${nextSection}`
                  }}
                  disabled={parseInt(sectionId) === 20}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    parseInt(sectionId) === 20
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Next
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

// Helper function
function formatTimeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}