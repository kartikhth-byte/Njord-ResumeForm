import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth/AuthContext'
import { Calendar, Clock, Link as LinkIcon, Loader2, PencilLine, X } from 'lucide-react'

export default function TestSchedulingModal({ application, onScheduled, onCancel }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    testDate: '',
    testTime: '10:00',
    testUrl: '',
    notes: ''
  })

  // Hardcoded values (not shown in UI)
  const testType = 'Competency Assessment'
  const platform = 'Custom Test Portal'
  const duration = '60' // 1 hour

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.testDate) {
      alert('Please select a test date')
      return
    }

    if (!formData.testUrl) {
      alert('Please provide a test URL/link')
      return
    }

    setLoading(true)

    try {
      // Combine date and time for scheduled_date
      const scheduledDateTime = new Date(`${formData.testDate}T${formData.testTime}:00`)
      
      // 1. Update application status to TEST_SCHEDULED
      const { error: statusError } = await supabase
        .from('applications')
        .update({
          status: 'test_scheduled',
          test_attempt_number: 1,
          test_max_attempts: 2
        })
        .eq('id', application.id)

      if (statusError) throw statusError

      // 2. Create scheduled event
      const { data: eventData, error: eventError } = await supabase
        .from('scheduled_events')
        .insert({
          application_id: application.id,
          scheduled_by: user?.id,
          event_type: 'test',
          event_title: `${testType} - ${application.reference_number}`,
          event_description: formData.notes,
          scheduled_date: scheduledDateTime.toISOString().split('T')[0],
          scheduled_time: formData.testTime,
          duration_minutes: parseInt(duration),
          timezone: 'UTC',
          location_type: 'online',
          location_details: formData.testUrl,
          platform: platform,
          status: 'scheduled'
        })
        .select()
        .single()

      if (eventError) throw eventError

      // Create reminder entry (24 hours before test)
const testDateTime = new Date(`${formData.testDate}T${formData.testTime}:00`)
const reminderTime = new Date(testDateTime)
reminderTime.setHours(reminderTime.getHours() - 24)

const { error: reminderError } = await supabase
  .from('scheduled_reminders')
  .insert({
    event_id: eventData.id,
    reminder_type: 'test_reminder',
    scheduled_for: reminderTime.toISOString(),
    sent: false
  })

if (reminderError) {
  console.error('Failed to create reminder:', reminderError)
  // Don't throw - reminder is optional, continue with test scheduling
}

      // 3. Send email notification via edge function
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        // Extract email from application_data JSON
        const applicantEmail = application.application_data?.data?.section2?.email || 
                               application.application_data?.data?.section4?.email
        
        console.log('Sending test invitation to:', applicantEmail)
        
        // Calculate expiry date (7 days from test date)
        const testDateObj = new Date(formData.testDate)
        const expiryDateObj = new Date(testDateObj)
        expiryDateObj.setDate(expiryDateObj.getDate() + 7)
        const expiryDate = expiryDateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        
        const emailResponse = await fetch(
          'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/send-test-invitation',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`
            },
            body: JSON.stringify({
              applicantEmail: String(applicantEmail || ''),
              applicantName: `${application.application_data?.data?.section2?.firstName || ''} ${application.application_data?.data?.section2?.surname || ''}`.trim(),
              referenceNumber: application.reference_number,
              testLink: formData.testUrl,
              expiryDate: expiryDate
            })
          }
        )

        if (!emailResponse.ok) {
          console.error('Failed to send email:', await emailResponse.text())
          // Don't throw - test was scheduled successfully even if email failed
        } else {
          console.log('Test invitation email sent successfully')
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError)
        // Don't throw - test was scheduled successfully even if email failed
      }

      console.log('Test scheduled successfully:', eventData)
      
      // Success callback
      if (onScheduled) {
        onScheduled('test_scheduled')
      }

    } catch (error) {
      console.error('Error scheduling test:', error)
      alert('Failed to schedule test: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

  return createPortal(
    (
      <div className="recruiter-modal-backdrop">
        <div className="recruiter-modal max-w-2xl">
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <PencilLine className="h-6 w-6" />
            </div>
            <div>
              <p className="recruiter-modal__eyebrow">Assessment workflow</p>
              <h3 className="recruiter-modal__title">Schedule competency test</h3>
              <p className="recruiter-modal__subtitle">
                {application.application_data?.data?.section2?.firstName} {application.application_data?.data?.section2?.surname} - {application.reference_number} - {application.applied_rank}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="recruiter-modal__close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="recruiter-modal__body space-y-5">
              {/* Date and Time Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Test Date */}
                <div>
                  <label className="block text-sm font-medium text-fg-secondary mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Test Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={today}
                    value={formData.testDate}
                    onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                    className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>

                {/* Test Time */}
                <div>
                  <label className="block text-sm font-medium text-fg-secondary mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Test Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.testTime}
                    onChange={(e) => setFormData({ ...formData, testTime: e.target.value })}
                    className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                </div>
              </div>

              {/* Test URL */}
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  Test Link/URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.testUrl}
                  onChange={(e) => setFormData({ ...formData, testUrl: e.target.value })}
                  placeholder="https://test.njord.com/assessment/xyz123"
                  className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
                <p className="text-xs text-fg-muted mt-1">
                  This link will be sent to the candidate
                </p>
              </div>

              {/* Notes for Candidate */}
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  Instructions for Candidate (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instructions for the candidate"
                  rows={3}
                  className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>

              {/* Info Box */}
              <div className="recruiter-note recruiter-note--info">
                <p className="recruiter-note__title">What happens next</p>
                <p className="recruiter-note__body">
                  The candidate gets an email with the details.
                </p>
              </div>
            </div>

          <div className="recruiter-modal__footer">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="workspace-action-button workspace-action-button--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="workspace-action-button workspace-action-button--primary min-w-[12rem] justify-center disabled:bg-fg-muted"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Test & Notify'
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    ),
    document.body
  )
}
