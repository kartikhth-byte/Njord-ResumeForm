import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { CheckCircle, XCircle, Star, Loader2, X, AlertTriangle } from 'lucide-react'

export default function InterviewResultModal({ application, onResultUpdated, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('') // 'passed', 'failed'
  const [formData, setFormData] = useState({
    // Ratings (1-5 scale)
    technicalSkills: '',
    communication: '',
    professionalism: '',
    leadership: '',
    problemSolving: '',
    
    // Overall assessment
    overallRating: '',
    recommendation: '',
    notes: '',
    
    // Rejection specific
    rejectionReason: '',
    rejectionFeedback: ''
  })

  const rejectionReasons = [
    'Insufficient technical knowledge for the role',
    'Communication skills below required standard',
    'Lack of relevant experience',
    'Cultural fit concerns',
    'Better qualified candidates selected',
    'Failed to demonstrate required competencies',
    'Other (see feedback)'
  ]

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    
    document.body.style.overflow = 'hidden'
    
    const preventScroll = (e) => {
      if (e.target === document.body) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', preventScroll, { passive: false })
    
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
      document.removeEventListener('touchmove', preventScroll)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!result) {
      alert('Please select an interview outcome')
      return
    }

    if (result === 'failed' && !formData.rejectionReason) {
      alert('Please select a rejection reason')
      return
    }

    if (result === 'passed' && !formData.recommendation) {
      alert('Please provide an overall recommendation')
      return
    }

    setLoading(true)

    try {
      if (result === 'passed') {
        await handlePassed()
      } else if (result === 'failed') {
        await handleFailed()
      } else if (result === 'no_show') {
        await handleNoShow()
      }

      // Success callback
      if (onResultUpdated) {
        onResultUpdated(result === 'passed' ? 'interview_passed' : result === 'no_show' ? 'interview_scheduled' : 'rejected')
      }

    } catch (error) {
      console.error('Error updating interview result:', error)
      alert('Failed to update interview result: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNoShow = async () => {
    // Record the no-show on the latest interview event; the application stays
    // in interview_scheduled so the recruiter can reschedule or reject.
    const { data: events, error: eventsError } = await supabase
      .from('scheduled_events')
      .select('id')
      .eq('application_id', application.id)
      .eq('event_type', 'interview')
      .order('scheduled_date', { ascending: false })
      .limit(1)
    if (eventsError) throw eventsError
    if (events && events[0]) {
      const { error: outcomeError } = await supabase
        .from('scheduled_events')
        .update({ outcome: 'no_show' })
        .eq('id', events[0].id)
      if (outcomeError) throw outcomeError
    }
  }

  const handlePassed = async () => {
    // Prepare interview feedback data
    const interviewFeedback = {
      result: 'passed',
      ratings: {
        technical_skills: formData.technicalSkills ? parseInt(formData.technicalSkills) : null,
        communication: formData.communication ? parseInt(formData.communication) : null,
        professionalism: formData.professionalism ? parseInt(formData.professionalism) : null,
        leadership: formData.leadership ? parseInt(formData.leadership) : null,
        problem_solving: formData.problemSolving ? parseInt(formData.problemSolving) : null,
        overall_rating: formData.overallRating ? parseInt(formData.overallRating) : null
      },
      recommendation: formData.recommendation,
      notes: formData.notes,
      recorded_at: new Date().toISOString()
    }

    // Update application to INTERVIEW_PASSED
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'interview_passed',
        interview_feedback: interviewFeedback,
        updated_at: new Date().toISOString()
      })
      .eq('id', application.id)

    if (updateError) throw updateError

    // Send interview passed email
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const applicantEmail = application.application_data?.data?.section2?.email || 
                             application.application_data?.data?.section4?.email

      console.log('Sending interview passed email to:', applicantEmail)

      const emailResponse = await fetch(
        'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/send-interview-passed',
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
            recommendation: formData.recommendation,
            nextSteps: null
          })
        }
      )

      if (!emailResponse.ok) {
        console.error('Failed to send interview passed email:', await emailResponse.text())
      } else {
        console.log('Interview passed email sent successfully')
      }
    } catch (emailError) {
      console.error('Error sending interview passed email:', emailError)
    }
    
    console.log('Interview marked as PASSED')
  }

  const handleFailed = async () => {
    // Prepare interview feedback data
    const interviewFeedback = {
      result: 'failed',
      ratings: {
        technical_skills: formData.technicalSkills ? parseInt(formData.technicalSkills) : null,
        communication: formData.communication ? parseInt(formData.communication) : null,
        professionalism: formData.professionalism ? parseInt(formData.professionalism) : null,
        leadership: formData.leadership ? parseInt(formData.leadership) : null,
        problem_solving: formData.problemSolving ? parseInt(formData.problemSolving) : null,
        overall_rating: formData.overallRating ? parseInt(formData.overallRating) : null
      },
      rejection_reason: formData.rejectionReason,
      rejection_feedback: formData.rejectionFeedback,
      notes: formData.notes,
      recorded_at: new Date().toISOString()
    }

    // Update application to REJECTED
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'rejected',
        interview_feedback: interviewFeedback,
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
            reason: formData.rejectionReason,
            additionalFeedback: formData.rejectionFeedback
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

    console.log('Interview marked as FAILED, application REJECTED')
  }

  const StarRating = ({ label, value, onChange, required = false }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && '*'}
      </label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`p-1 transition-all ${
              value >= rating
                ? 'text-yellow-500 scale-110'
                : 'text-gray-300 hover:text-yellow-400'
            }`}
          >
            <Star className="w-6 h-6" fill={value >= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
        {value && (
          <span className="ml-2 text-sm font-medium text-gray-700">
            {value} / 5
          </span>
        )}
      </div>
    </div>
  )

  return createPortal(
    <div className="recruiter-modal-backdrop overflow-y-auto">
      <div className="fixed inset-0" onClick={() => !loading && onCancel()} />
      <div className="recruiter-modal my-8 max-w-3xl">
          {/* Header */}
          <div className="recruiter-modal__header">
            <div className="recruiter-modal__header-main">
              <div className="recruiter-modal__icon">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="recruiter-modal__eyebrow">Interview workflow</p>
                <h3 className="recruiter-modal__title">Update interview result</h3>
                <p className="recruiter-modal__subtitle">
                  Candidate: {application.application_data?.data?.section2?.firstName} {application.application_data?.data?.section2?.surname} • {application.reference_number}
                  <br />
                  Position: {application.applied_rank}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="recruiter-modal__close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="recruiter-modal__body space-y-6">
              {/* Interview Outcome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Interview Outcome *
                </label>
                <div className="space-y-3">
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
                      <p className="text-sm text-gray-600 mt-1">
                        Candidate performed well and is recommended for the next stage
                      </p>
                    </div>
                  </label>

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
                      <p className="text-sm text-gray-600 mt-1">
                        Candidate did not meet the requirements and will be rejected
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    result === 'no_show' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300'
                  }`}>
                    <input
                      type="radio"
                      name="result"
                      value="no_show"
                      checked={result === 'no_show'}
                      onChange={(e) => setResult(e.target.value)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-amber-600" />
                        <span className="font-medium text-gray-900">Did not attend</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        No-show is recorded on the event; the interview stays scheduled so you can rebook or reject
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Interview Ratings - Only shown if result is selected */}
              {result && (
                <>
                  <div className="border-t pt-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">
                      Interview Assessment Ratings
                    </h4>
                    <div className="space-y-4">
                      <StarRating
                        label="Technical Skills & Knowledge"
                        value={formData.technicalSkills}
                        onChange={(rating) => setFormData({ ...formData, technicalSkills: rating.toString() })}
                      />
                      
                      <StarRating
                        label="Communication Skills"
                        value={formData.communication}
                        onChange={(rating) => setFormData({ ...formData, communication: rating.toString() })}
                      />
                      
                      <StarRating
                        label="Professionalism & Attitude"
                        value={formData.professionalism}
                        onChange={(rating) => setFormData({ ...formData, professionalism: rating.toString() })}
                      />
                      
                      <StarRating
                        label="Leadership & Teamwork"
                        value={formData.leadership}
                        onChange={(rating) => setFormData({ ...formData, leadership: rating.toString() })}
                      />
                      
                      <StarRating
                        label="Problem Solving Ability"
                        value={formData.problemSolving}
                        onChange={(rating) => setFormData({ ...formData, problemSolving: rating.toString() })}
                      />
                    </div>
                  </div>

                  {/* Overall Rating */}
                  <div className="border-t pt-6">
                    <StarRating
                      label="Overall Rating"
                      value={formData.overallRating}
                      onChange={(rating) => setFormData({ ...formData, overallRating: rating.toString() })}
                      required={result === 'passed'}
                    />
                  </div>
                </>
              )}

              {/* Conditional: Passed - Recommendation */}
              {result === 'passed' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-green-900 mb-2">
                    Overall Recommendation *
                  </label>
                  <select
                    required
                    value={formData.recommendation}
                    onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-3"
                  >
                    <option value="">Select recommendation...</option>
                    <option value="Strongly Recommend">Strongly Recommend - Excellent candidate</option>
                    <option value="Recommend">Recommend - Good candidate</option>
                    <option value="Recommend with Reservations">Recommend with Reservations - Acceptable but has concerns</option>
                  </select>

                  <label className="block text-sm font-medium text-green-900 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Strengths, areas for development, specific observations..."
                    rows={3}
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>
              )}

              {/* Conditional: Failed - Rejection Details */}
              {result === 'failed' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
                  <div>
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

                  <div>
                    <label className="block text-sm font-medium text-red-900 mb-2">
                      Detailed Feedback (Optional)
                    </label>
                    <textarea
                      value={formData.rejectionFeedback}
                      onChange={(e) => setFormData({ ...formData, rejectionFeedback: e.target.value })}
                      placeholder="Provide specific feedback about areas where the candidate fell short..."
                      rows={3}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-red-700 mt-1">
                      This feedback will be included in the rejection email
                    </p>
                  </div>
                </div>
              )}

              {/* Info Box */}
              {result && (
                <div className={`border rounded-lg p-4 ${
                  result === 'passed' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm ${
                    result === 'passed' ? 'text-green-900' : 'text-red-900'
                  }`}>
                    <strong>Action:</strong> {
                      result === 'passed' 
                        ? 'Application status will be updated to "Interview Passed". You can then proceed to make an offer.' 
                        : 'Candidate will receive a rejection email with feedback. Application will be closed.'
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
