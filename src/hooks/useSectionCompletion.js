import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSectionCompletion(applicationId) {
  const [completedSections, setCompletedSections] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch completed sections
  const fetchCompletedSections = useCallback(async () => {
    if (!applicationId) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('application_sections')
        .select('section_number, is_complete')
        .eq('application_id', applicationId)

      if (error) throw error

      const completed = data
        ?.filter(section => section.is_complete)
        .map(section => section.section_number) || []

      setCompletedSections(completed)
    } catch (error) {
      console.error('Error fetching section completion:', error)
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  // Mark section as complete/incomplete
  const updateSectionCompletion = useCallback(async (sectionNumber, isComplete) => {
    if (!applicationId) return

    try {
      const { error } = await supabase
        .from('application_sections')
        .update({
          is_complete: isComplete,
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('application_id', applicationId)
        .eq('section_number', sectionNumber)

      if (error) throw error

      // Update local state
      if (isComplete) {
        setCompletedSections(prev => [...new Set([...prev, sectionNumber])])
      } else {
        setCompletedSections(prev => prev.filter(num => num !== sectionNumber))
      }

      console.log(`Section ${sectionNumber} marked as ${isComplete ? 'complete' : 'incomplete'}`)
    } catch (error) {
      console.error('Error updating section completion:', error)
    }
  }, [applicationId])

  // Initial fetch
  useEffect(() => {
    fetchCompletedSections()
  }, [fetchCompletedSections])

  return {
    completedSections,
    loading,
    updateSectionCompletion,
    refetch: fetchCompletedSections
  }
}