import React, { useState, useEffect, useRef } from 'react'
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
  const saveTimeoutRef = useRef(null)
  const applicationDataRef = useRef({})

  // Keep ref in sync with state
  useEffect(() => {
    applicationDataRef.current = applicationData
  }, [applicationData])

  // Load application data on mount
  useEffect(() => {
    if (user) {
      loadApplicationData()
    }
  }, [user])

  const loadApplicationData = async () => {
    try {
      setLoading(true)

      // BUG FIX 2: Look for in-progress applications (status='new' AND not submitted)
      // This finds the application that Dashboard.jsx just created
      let { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'new')
        .is('submitted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (appError) throw appError

      // Create application if it doesn't exist
      if (!app) {
        console.log('📝 Creating new draft application...')
        const { data: newApp, error: createError } = await supabase
          .from('applications')
          .insert({
            user_id: user.id,
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) throw createError
        app = newApp
        console.log('✅ Application created:', app.id)
      } else {
        console.log('✅ Found existing in-progress application:', app.id)
      }

      setApplicationId(app.id)

      // Get or create application_data
      let { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('*')
        .eq('application_id', app.id)
        .maybeSingle()

      if (dataError && dataError.code !== 'PGRST116') throw dataError

      // Create application_data if it doesn't exist
      if (!appData) {
        console.log('📝 Creating application_data row...')
        const { data: newData, error: insertError } = await supabase
          .from('application_data')
          .insert({
            application_id: app.id,
            data: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) throw insertError
        appData = newData
        console.log('✅ Application_data created')
      } else {
        console.log('✅ Found existing application_data')
      }

      const loadedData = appData?.data || {}
      setApplicationData(loadedData)
      applicationDataRef.current = loadedData
      console.log('Loaded existing data with', Object.keys(loadedData).length, 'sections')
    } catch (error) {
      console.error('Error loading application data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-save function with debouncing - FIXED VERSION
  const handleDataUpdate = (updates) => {
    console.log('🔵 handleDataUpdate called with:', updates)
    
    // Update local state immediately for responsiveness
    setApplicationData(prev => {
      const newData = {
        ...prev,
        ...updates
      }
      applicationDataRef.current = newData
      return newData
    })

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto-save (debounce)
    const timeout = setTimeout(() => {
      // Use ref to get latest data (fixes stale closure!)
      saveData(applicationDataRef.current)
    }, 2000) // Save after 2 seconds of no changes

    saveTimeoutRef.current = timeout
  }

  const saveData = async (dataToSave) => {
    if (!applicationId) {
      console.error('❌ Cannot save: applicationId is null')
      return
    }

    try {
      setSaving(true)
      console.log('💾 Saving data:', dataToSave)

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
      console.log('✅ Auto-saved successfully')
    } catch (error) {
      console.error('❌ Error saving data:', error)
    } finally {
      setSaving(false)
    }
  }

  // Save on unmount (when leaving page)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        // Force immediate save on unmount
        if (applicationDataRef.current && applicationId) {
          saveData(applicationDataRef.current)
        }
      }
    }
  }, [applicationId])

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
      <div className="md:hidden">
        <Navbar />
      </div>

      {/* Desktop & Mobile Layout */}
      <div className="flex h-screen">
        {/* Desktop & Tablet: Left Sidebar - Hidden only on mobile phones */}
        <div className="hidden md:block">
          <FormSidebar applicationData={applicationData} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile: Horizontal Section Navigation */}
          <div className="md:hidden sticky top-0 z-10 bg-white border-b">
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
                  onDataUpdate: handleDataUpdate,
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
                    if (parseInt(sectionId) === 20) {
                      window.location.href = '/application/review'
                    } else {
                      const nextSection = Math.min(20, parseInt(sectionId) + 1)
                      window.location.href = `/application/form/section/${nextSection}`
                    }
                  }}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    parseInt(sectionId) === 20
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {parseInt(sectionId) === 20 ? (
                    <>
                      Review & Submit
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Next
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
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