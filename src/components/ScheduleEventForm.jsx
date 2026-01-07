import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Clock, MapPin, Users, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function ScheduleEventForm({ eventType, onDataChange }) {
  const [formData, setFormData] = useState({
    scheduledDate: '',
    scheduledTime: '',
    durationMinutes: 60,
    locationType: 'virtual',
    locationAddress: '',
    locationLink: '',
    eventNotes: '',
    interviewers: []
  })

  // Google Meet auto-create states
  const [creatingMeet, setCreatingMeet] = useState(false)
  const [meetError, setMeetError] = useState(null)
  const [meetSuccess, setMeetSuccess] = useState(false)
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false)

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange(formData)
    }
  }, [formData])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'locationType') {
      setMeetSuccess(false)
      setMeetError(null)
    }
  }

  const handleInterviewersChange = (value) => {
    const list = value.split(',').map(name => name.trim()).filter(name => name.length > 0)
    setFormData(prev => ({ ...prev, interviewers: list }))
  }

  const handleAutoCreateMeet = async () => {
    if (!formData.scheduledDate || !formData.scheduledTime) {
      setMeetError('Please select date and time first')
      return
    }

    setCreatingMeet(true)
    setMeetError(null)
    setMeetSuccess(false)
    setNeedsGoogleAuth(false)

    try {
      // Calculate start and end times
      const startDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}:00`)
      const endDateTime = new Date(startDateTime.getTime() + formData.durationMinutes * 60000)

      // Call edge function to create Google Meet
      const { data, error } = await supabase.functions.invoke('create-google-meet', {
        body: {
          summary: `${eventType === 'interview' ? 'Interview' : 'Test'} - NJORD Ships`,
          description: `Maritime ${eventType} session`,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          attendees: [] // Attendees will be added via calendar invite later
        }
      })

      if (error) {
        console.error('Error creating meet:', error)
        
        // Check if needs Google auth
        if (data?.needsAuth) {
          setNeedsGoogleAuth(true)
          setMeetError('Please authorize Google Calendar first')
        } else {
          setMeetError(error.message || 'Failed to create Google Meet')
        }
        return
      }

      if (data.meetLink) {
        setFormData(prev => ({ ...prev, locationLink: data.meetLink }))
        setMeetSuccess(true)
        console.log('Google Meet created:', data.meetLink)
      } else {
        setMeetError('No meeting link returned')
      }

    } catch (error) {
      console.error('Error:', error)
      setMeetError('An unexpected error occurred')
    } finally {
      setCreatingMeet(false)
    }
  }

  const handleGoogleAuth = async () => {
    try {
      // Get Google OAuth URL
      const { data, error } = await supabase.functions.invoke('google-meet-auth')

      if (error) {
        setMeetError('Failed to initiate Google authorization')
        return
      }

      if (data.hasValidToken) {
        setNeedsGoogleAuth(false)
        setMeetError(null)
        // Try creating meet again
        handleAutoCreateMeet()
        return
      }

      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        data.authUrl,
        'Google Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Listen for auth completion
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup)
          // Check if auth succeeded
          setTimeout(() => {
            handleAutoCreateMeet()
          }, 1000)
        }
      }, 500)

    } catch (error) {
      console.error('Auth error:', error)
      setMeetError('Failed to open authorization window')
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-blue-600" />
        <h4 className="text-lg font-semibold text-gray-900">
          Schedule {eventType === 'interview' ? 'Interview' : 'Test'} Details
        </h4>
      </div>

      <div className="space-y-4">
        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              required
              min={today}
              value={formData.scheduledDate}
              onChange={(e) => handleChange('scheduledDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time *
            </label>
            <input
              type="time"
              required
              value={formData.scheduledTime}
              onChange={(e) => handleChange('scheduledTime', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration
          </label>
          <select
            value={formData.durationMinutes}
            onChange={(e) => handleChange('durationMinutes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
          </select>
        </div>

        {/* Location Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            Location Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleChange('locationType', 'virtual')}
              className={`p-3 border-2 rounded-lg text-center text-sm transition ${
                formData.locationType === 'virtual'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              💻 Virtual
            </button>
            <button
              type="button"
              onClick={() => handleChange('locationType', 'physical')}
              className={`p-3 border-2 rounded-lg text-center text-sm transition ${
                formData.locationType === 'physical'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              🏢 In-Person
            </button>
            <button
              type="button"
              onClick={() => handleChange('locationType', 'phone')}
              className={`p-3 border-2 rounded-lg text-center text-sm transition ${
                formData.locationType === 'phone'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              📞 Phone
            </button>
          </div>
        </div>

        {/* Location Details - Virtual */}
        {formData.locationType === 'virtual' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Link *
            </label>
            
            {/* Auto-create Google Meet Button */}
            <div className="mb-3">
              <button
                type="button"
                onClick={needsGoogleAuth ? handleGoogleAuth : handleAutoCreateMeet}
                disabled={creatingMeet || !formData.scheduledDate || !formData.scheduledTime}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
              >
                {creatingMeet ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Google Meet...
                  </>
                ) : needsGoogleAuth ? (
                  <>
                    🔐 Authorize Google Calendar
                  </>
                ) : meetSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Google Meet Created ✓
                  </>
                ) : (
                  <>
                    🔵 Auto-create Google Meet
                  </>
                )}
              </button>
              
              {meetError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{meetError}</p>
                </div>
              )}
              
              {meetSuccess && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700">Google Meet link created and filled below!</p>
                </div>
              )}
            </div>

            <div className="text-center text-sm text-gray-500 mb-2">
              OR manually enter link:
            </div>

            <input
              type="url"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              value={formData.locationLink}
              onChange={(e) => {
                handleChange('locationLink', e.target.value)
                setMeetSuccess(false)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Tip: Use auto-create or manually create at meet.google.com/new
            </p>
          </div>
        )}

        {formData.locationType === 'physical' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address *
            </label>
            <textarea
              placeholder="Enter the physical address..."
              value={formData.locationAddress}
              onChange={(e) => handleChange('locationAddress', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Interviewers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Users className="w-4 h-4 inline mr-1" />
            Interviewers (comma-separated)
          </label>
          <input
            type="text"
            placeholder="John Doe, Jane Smith, HR Manager"
            value={formData.interviewers.join(', ')}
            onChange={(e) => handleInterviewersChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional: List names separated by commas
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            Additional Notes for Candidate
          </label>
          <textarea
            placeholder="Any additional information for the candidate (what to prepare, dress code, etc.)"
            value={formData.eventNotes}
            onChange={(e) => handleChange('eventNotes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Info Box */}
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong className="text-blue-700">📧 Emails will be sent to:</strong>
          </p>
          <ul className="text-sm text-gray-600 mt-2 space-y-1 ml-4">
            <li>✅ Applicant (with calendar invite)</li>
            <li>✅ You (recruiter, with calendar invite)</li>
            <li>✅ 24-hour reminder (automatically sent to both)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}