/* eslint-disable react-hooks/exhaustive-deps */
// FINAL FIXED FormLayout.jsx - Correct updateData usage
import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAutoSave } from '../../hooks/useAutoSave'
import { supabase } from '../../lib/supabase'
import Navbar from '../layout/Navbar'
import FormSidebar from './FormSidebar'
import FormNavigation from './FormNavigation'

export default function FormLayout({ children }) {
  const { sectionId } = useParams()
  const { user } = useAuth()
  const [applicationId, setApplicationId] = useState(null)
  const [loading, setLoading] = useState(true)

  // ✅ Use useAutoSave hook with correct variable names
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

      // Look for in-progress application
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

      // Ensure application_data row exists
      let { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('id')
        .eq('application_id', app.id)
        .maybeSingle()

      if (dataError && dataError.code !== 'PGRST116') throw dataError

      if (!appData) {
        console.log('📝 Creating application_data row...')
        const { error: insertError } = await supabase
          .from('application_data')
          .insert({
            application_id: app.id,
            data: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (insertError) throw insertError
        console.log('✅ Application_data created')
      }

      // Set applicationId - hook will load data automatically
      setApplicationId(app.id)
      console.log('✅ Application initialized, hook will load data')
    } catch (error) {
      console.error('Error initializing application:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ FIX: Pass updates object directly, not a function
  const handleDataUpdate = (updates) => {
    console.log('🔵 handleDataUpdate called with:', updates)
    
    // ✅ CORRECT: Pass updates object directly
    // Hook's updateData expects an object, not a function
    updateData(updates)
  }

  // Provide context to children
  const contextValue = {
    applicationData,
    handleDataUpdate,
    applicationId,
    saveStatus,
    lastSaved
  }

  if (loading || autoSaveLoading) {
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
      <Navbar />
      
      <div className="flex">
        {/* Sidebar */}
        <FormSidebar 
          currentSection={parseInt(sectionId) || 1} 
          applicationData={applicationData}
        />
        
        {/* Main Content */}
        <div className="flex-1 lg:ml-64">
          <div className="max-w-4xl mx-auto p-6">
            {/* Auto-Save Status Indicator */}
            <div className="mb-4 flex items-center justify-end space-x-2 text-sm">
              {saveStatus === 'saving' && (
                <div className="flex items-center text-blue-600">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </div>
              )}
              
              {saveStatus === 'saved' && lastSaved && (
                <div className="flex items-center text-green-600">
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Saved {new Date(lastSaved).toLocaleTimeString()}
                  </span>
                </div>
              )}
              
              {saveStatus === 'error' && (
                <div className="flex items-center text-red-600">
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>Save failed - please try again</span>
                </div>
              )}
            </div>

            {/* Section Content */}
            {React.Children.map(children, child =>
              React.cloneElement(child, contextValue)
            )}
            
            {/* Navigation */}
            <FormNavigation 
              currentSection={parseInt(sectionId) || 1}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
