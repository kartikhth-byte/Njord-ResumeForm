import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth/AuthContext'
import { CheckCircle, XCircle, RotateCcw, Calendar, Clock, Link as LinkIcon, Loader2, X, AlertTriangle } from 'lucide-react'

export default function TestResultModal({ application, onResultUpdated, onCancel }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('') // 'passed', 'failed', 'retake'
  const [formData, setFormData] = useState({
    testScore: '',
    notes: '',
    rejectionReason: '',
    newTestDate: '',
    newTestTime: '10:00',
    newTestUrl: '',
    retakeMessage: ''
  })

  const currentAttempt = application.test_attempt_number || 1
  const maxAttempts = application.test_max_attempts || 2
  const canRetake = currentAttempt < maxAttempts

  const rejectionReasons = [
    'Insufficient technical knowledge',
    'Failed safety procedures assessment',
    'Did not meet minimum score requirement',
    'Poor communication skills demonstrated',
    'Incomplete test submission',
    'Other (see notes)'
  ]

  // Lock body scroll when modal is open
  useEffect(() => {
    // Save original body overflow
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    
    // Lock scroll
    document.body.style.overflow = 'hidden'
    
    // Prevent scroll on iOS
    const preventScroll = (e) => {
      if (e.target === document.body) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', preventScroll, { passive: false })
    
    // Cleanup
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
      document.removeEventListener('touchmove', preventScroll)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('🔵 handleSubmit called', { result, formData })

    // Validation
    if (!result) {
      console.log('❌ Validation failed: no result selected')
      alert('Please select a test result')
      return
    }

    if (result === 'failed' && !formData.rejectionReason) {
      console.log('❌ Validation failed: no rejection reason')
      alert('Please select a rejection reason')
      return
    }

    if (result === 'retake') {
      if (!canRetake) {
        console.log('❌ Validation failed: cannot retake')
        alert('Maximum test attempts reached. Cannot approve retake.')
        return
      }
      if (!formData.newTestDate || !formData.newTestUrl) {
        console.log('❌ Validation failed: missing retake details')
        alert('Please provide new test date and URL for retake')
        return
      }
    }

    console.log('✅ Validation passed, setting loading...')
    setLoading(true)

    try {
      console.log('🔄 Processing result:', result)
      
      if (result === 'passed') {
        console.log('→ Calling handlePassed')
        await handlePassed()
      } else if (result === 'failed') {
        console.log('→ Calling handleFailed')
        await handleFailed()
      } else if (result === 'retake') {
        console.log('→ Calling handleRetake')
        await handleRetake()
      }

      console.log('✅ Handler completed successfully')

      // Success callback
      if (onResultUpdated) {
        console.log('→ Calling onResultUpdated callback')
        onResultUpdated(result === 'passed' ? 'test_passed' : result === 'failed' ? 'rejected' : 'test_scheduled')
      }

      // Close modal after successful update
      if (onCancel) {
        console.log('→ Calling onCancel to close modal')
        onCancel()
      }

    } catch (error) {
      console.error('❌ Error updating test result:', error)
      alert('Failed to update test result: ' + error.message)
    } finally {
      setLoading(false)
      console.log('🏁 handleSubmit finished')
    }
  }

  const handlePassed = async () => {
    // Update application to TEST_PASSED
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'test_passed',
        updated_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) throw updateError

    // TODO: Send "test passed" email (if edge function exists)
    // Currently no edge function for "test passed" notification
    
    console.log('Test marked as PASSED')
  }

  const handleFailed = async () => {
    // Update application to REJECTED
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) throw updateError

    // Send rejection email via edge function
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const applicantEmail = application.application_data?.data?.section2?.email || 
                             application.application_data?.data?.section4?.email

      console.log('Sending rejection email to:', applicantEmail)

      const emailResponse = await fetch(
        'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/send-rejection-email',
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
            position: application.applied_rank || 'the position',
            reason: formData.rejectionReason
          })
        }
      )

      if (!emailResponse.ok) {
        console.error('Failed to send rejection email:', await emailResponse.text())
      } else {
        console.log('Rejection email sent successfully')
      }
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError)
    }

    console.log('Test marked as FAILED, application REJECTED')
  }

  const handleRetake = async () => {
    const nextAttempt = currentAttempt + 1

    // Update application - increment attempt, keep as TEST_SCHEDULED
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'test_scheduled',
        test_attempt_number: nextAttempt,
        updated_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) throw updateError

    // Create new scheduled event
    const scheduledDateTime = new Date(`${formData.newTestDate}T${formData.newTestTime}:00`)

    const { error: eventError } = await supabase
      .from('scheduled_events')
      .insert({
        application_id: application.id,
        scheduled_by: user?.id,
        event_type: 'test',
        event_title: `Competency Assessment (Attempt ${nextAttempt}) - ${application.reference_number}`,
        event_description: formData.retakeMessage,
        scheduled_date: scheduledDateTime.toISOString().split('T')[0],
        scheduled_time: formData.newTestTime,
        duration_minutes: 60,
        timezone: 'UTC',
        location_type: 'online',
        location_details: formData.newTestUrl,
        platform: 'Custom Test Portal',
        status: 'scheduled'
      })

    if (eventError) throw eventError

    // Send retake approval email via edge function
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const applicantEmail = application.application_data?.data?.section2?.email || 
                             application.application_data?.data?.section4?.email

      // Calculate expiry date (7 days from test date)
      const testDateObj = new Date(formData.newTestDate)
      const expiryDateObj = new Date(testDateObj)
      expiryDateObj.setDate(expiryDateObj.getDate() + 7)
      const expiryDate = expiryDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const emailResponse = await fetch(
        'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/send-test-retake-approved',
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
            testLink: formData.newTestUrl,
            testDate: formData.newTestDate,
            attemptNumber: nextAttempt,
            maxAttempts: maxAttempts,
            expiryDate: expiryDate,
            message: formData.retakeMessage
          })
        }
      )

      if (!emailResponse.ok) {
        console.error('Failed to send retake email:', await emailResponse.text())
      } else {
        console.log('Retake approval email sent successfully')
      }
    } catch (emailError) {
      console.error('Error sending retake email:', emailError)
    }

    console.log(`Retake approved: Attempt ${nextAttempt} of ${maxAttempts}`)
  }

  const today = new Date().toISOString().split('T')[0]

  return createPortal(
    <div className="recruiter-modal-backdrop">
      <div className="recruiter-modal max-w-2xl">
          {/* Header */}
          <div className="recruiter-modal__header">
            <div className="recruiter-modal__header-main">
              <div className="recruiter-modal__icon">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
              <p className="recruiter-modal__eyebrow">Assessment workflow</p>
              <h3 className="recruiter-modal__title">
                Update Test Result
              </h3>
              <p className="recruiter-modal__subtitle">
                Candidate: {application.application_data?.data?.section2?.firstName} {application.application_data?.data?.section2?.surname} • {application.reference_number}
                <br />
                Position: {application.applied_rank} • Attempt: {currentAttempt} of {maxAttempts}
              </p>
            </div>
            </div>
            <button onClick={onCancel} className="recruiter-modal__close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="recruiter-modal__body space-y-5">
              {/* Test Result Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Test Result *
                </label>
                <div className="space-y-3">
                  {/* Passed */}
                  <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    result === 'passed' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                  }`}>
                    <input
                      type="radio"
                      name="result"
                      value="passed"
                      checked={result === 'passed'}
                      onChange={(e) => setResult(e.target.value)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-gray-900">Passed</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Candidate passed the test. Proceed to interview stage.</p>
                    </div>
                  </label>

                  {/* Failed */}
                  <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    result === 'failed' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
                  }`}>
                    <input
                      type="radio"
                      name="result"
                      value="failed"
                      checked={result === 'failed'}
                      onChange={(e) => setResult(e.target.value)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-gray-900">Failed</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Candidate failed the test. Application will be rejected.</p>
                    </div>
                  </label>

                  {/* Retake */}
                  <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    result === 'retake' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  } ${!canRetake ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="result"
                      value="retake"
                      checked={result === 'retake'}
                      onChange={(e) => setResult(e.target.value)}
                      disabled={!canRetake}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">
                          Retake {!canRetake && '(Not Available)'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {canRetake 
                          ? `Allow candidate to retake the test. (Attempt ${currentAttempt + 1} of ${maxAttempts})`
                          : `Maximum attempts (${maxAttempts}) reached. Cannot approve retake.`
                        }
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Test Score */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Score (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.testScore}
                    onChange={(e) => setFormData({ ...formData, testScore: e.target.value })}
                    placeholder="85.5"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-gray-600">%</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes {(result === 'failed' || result === 'retake') && '*'}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any relevant notes about the test performance..."
                  rows={3}
                  required={result === 'failed' || result === 'retake'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Conditional: Failed - Rejection Reason */}
              {result === 'failed' && (
                <div className="recruiter-note recruiter-note--danger">
                  <label className="block text-sm font-medium text-red-900 mb-2">
                    Rejection Reason *
                  </label>
                  <select
                    required
                    value={formData.rejectionReason}
                    onChange={(e) => setFormData({ ...formData, rejectionReason: e.target.value })}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Select a reason...</option>
                    {rejectionReasons.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional: Retake - Scheduling Fields */}
              {result === 'retake' && (
                <div className="recruiter-note recruiter-note--info space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-blue-700" />
                    <h4 className="font-medium text-blue-900">Schedule Retake Test</h4>
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        New Test Date *
                      </label>
                      <input
                        type="date"
                        required={result === 'retake'}
                        min={today}
                        value={formData.newTestDate}
                        onChange={(e) => setFormData({ ...formData, newTestDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        New Test Time *
                      </label>
                      <input
                        type="time"
                        required={result === 'retake'}
                        value={formData.newTestTime}
                        onChange={(e) => setFormData({ ...formData, newTestTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Test URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <LinkIcon className="w-4 h-4 inline mr-1" />
                      New Test Link/URL *
                    </label>
                    <input
                      type="url"
                      required={result === 'retake'}
                      value={formData.newTestUrl}
                      onChange={(e) => setFormData({ ...formData, newTestUrl: e.target.value })}
                      placeholder="https://test.njord.com/assessment/xyz123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Message to Candidate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message to Candidate (Optional)
                    </label>
                    <textarea
                      value={formData.retakeMessage}
                      onChange={(e) => setFormData({ ...formData, retakeMessage: e.target.value })}
                      placeholder="We're giving you another opportunity to demonstrate your skills. Please review the material and prepare accordingly..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Info Box */}
              {result && (
                <div className={`border rounded-lg p-4 ${
                  result === 'passed' ? 'bg-green-50 border-green-200' :
                  result === 'failed' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <p className={`text-sm ${
                    result === 'passed' ? 'text-green-900' :
                    result === 'failed' ? 'text-red-900' :
                    'text-blue-900'
                  }`}>
                    <strong>Action:</strong> {
                      result === 'passed' ? 'Candidate will advance to the interview stage.' :
                      result === 'failed' ? 'Candidate will receive a rejection email and application will be closed.' :
                      `Candidate will receive a retake invitation email with new test details. This will be attempt ${currentAttempt + 1} of ${maxAttempts}.`
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
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
                disabled={loading || !result}
                className="workspace-action-button workspace-action-button--primary min-w-[12rem] justify-center disabled:bg-gray-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Result & Notify'
                )}
              </button>
            </div>
          </form>
        </div>
    </div>,
    document.body
  )
}
