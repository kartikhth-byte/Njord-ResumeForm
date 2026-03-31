import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useAutoSave(applicationId, initialData = {}) {
  const [data, setData] = useState(initialData)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [lastSaved, setLastSaved] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const debounceTimerRef = useRef(null)
  const isSavingRef = useRef(false)
  const latestDataRef = useRef(initialData)
  const hasLocalEditsRef = useRef(false)

  useEffect(() => {
    latestDataRef.current = data
  }, [data])

  // Load initial data from database
  useEffect(() => {
    const loadData = async () => {
      if (!applicationId) {
        setIsLoading(false)
        return
      }

      try {
        const { data: appData, error } = await supabase
          .from('application_data')
          .select('data')
          .eq('application_id', applicationId)
          .single()

        if (error) throw error

        if (appData && appData.data) {
          console.log('useAutoSave: Loaded data from DB:', appData.data)
          const mergedData = hasLocalEditsRef.current
            ? { ...appData.data, ...latestDataRef.current }
            : appData.data

          setData(mergedData)
          latestDataRef.current = mergedData
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    hasLocalEditsRef.current = false
    loadData()
  }, [applicationId])

  // Save function
  const saveToDatabase = useCallback(async (dataToSave) => {
    if (!applicationId) return

    try {
      isSavingRef.current = true
      setSaveStatus('saving')

      console.log('useAutoSave: Saving to database:', dataToSave)

      // Update application_data
      const { error: dataError } = await supabase
        .from('application_data')
        .update({
          data: dataToSave,
          updated_at: new Date().toISOString()
        })
        .eq('application_id', applicationId)

      if (dataError) throw dataError

      // Update applications.updated_at
      const { error: appError } = await supabase
        .from('applications')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (appError) throw appError

      setSaveStatus('saved')
      setLastSaved(new Date())
      hasLocalEditsRef.current = false
      
      console.log('useAutoSave: Save successful')
    } catch (error) {
      console.error('Auto-save error:', error)
      setSaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [applicationId])

  // Immediate save
  const saveImmediately = useCallback(async (options = {}) => {
    const { timeout = 5000 } = options
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    return Promise.race([
      saveToDatabase(data),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save timeout')), timeout)
      )
    ])
  }, [data, saveToDatabase])

  // Debounced save
  const debouncedSave = useCallback((newData) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('useAutoSave: Debounce timer fired, saving...')
      saveToDatabase(newData)
      debounceTimerRef.current = null
    }, 2000) // 2 seconds

    console.log('useAutoSave: Auto-save scheduled in 2 seconds')
  }, [saveToDatabase])

  // Update data and trigger debounced save
  const updateData = useCallback((updates) => {
    console.log('useAutoSave: updateData called with:', updates)
    
    setData(prevData => {
      const newData = { ...prevData, ...updates }
      hasLocalEditsRef.current = true
      console.log('useAutoSave: New data state:', newData)
      debouncedSave(newData)
      return newData
    })
  }, [debouncedSave])

  // Session expiry handler
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event in useAutoSave:', event)
        
        if (event === 'SIGNED_OUT' || !session) {
          console.log('Session expiry detected - triggering immediate save')
          
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
          }
          
          if (!isSavingRef.current && applicationId && Object.keys(data).length > 0) {
            try {
              await saveImmediately({ timeout: 5000 })
              console.log('Final save before logout completed')
            } catch (error) {
              console.error('Final save failed:', error)
            }
          }
        }
      }
    )
    
    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [applicationId, data, saveImmediately])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
        if (applicationId && Object.keys(latestDataRef.current || {}).length > 0) {
          saveToDatabase(latestDataRef.current)
        }
      }
    }
  }, [applicationId, saveToDatabase])

  return {
    data,
    updateData,
    saveStatus,
    lastSaved,
    saveImmediately,
    isLoading
  }
}
