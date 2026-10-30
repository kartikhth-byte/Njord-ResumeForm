/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth/AuthContext'
import { Calendar, Clock, Link as LinkIcon, Video, Phone, MapPin, Loader2, X, CheckCircle } from 'lucide-react'
import { getClientRuntimeSettings } from '../services/runtimeSettingsService'

export default function InterviewSchedulingModal({ application, onScheduled, onCancel }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    interviewDate: '',
    interviewTime: '10:00',
    interviewType: 'video',
    interviewUrl: '',
    location: '',
    duration: '60',
    notes: '',
    platform: 'teams' // Microsoft Teams only
  })

  // Microsoft Teams integration states
  const [creatingMeet, setCreatingMeet] = useState(false)
  const [meetCreated, setMeetCreated] = useState(false)
  const [meetError, setMeetError] = useState('')
  const [isTeamsConnected, setIsTeamsConnected] = useState(false)
  const [, setCheckingTeamsAuth] = useState(true)
  const [, setNeedsTeamsAuth] = useState(false)
  const [microsoftConfig, setMicrosoftConfig] = useState({
    MICROSOFT_CLIENT_ID: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
    MICROSOFT_REDIRECT_URI: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || '',
  })

  // Lock body scroll when modal opens
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // NEW: Check Microsoft Teams connection status
  useEffect(() => {
    checkTeamsConnection()
  }, [user])

  useEffect(() => {
    let mounted = true

    getClientRuntimeSettings()
      .then(config => {
        if (mounted) {
          setMicrosoftConfig(current => ({
            ...current,
            ...config,
          }))
        }
      })
      .catch(error => {
        console.error('Failed to load Microsoft runtime config:', error)
      })

    return () => {
      mounted = false
    }
  }, [])

// Check Microsoft Teams connection status with auto-refresh
  const checkTeamsConnection = async () => {
    console.log('🔍 checkTeamsConnection called', { user: user?.id })
    
    if (!user) {
      console.log('⚠️ No user, skipping Teams check')
      setCheckingTeamsAuth(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('microsoft_oauth_tokens')
        .select('expires_at, refresh_token')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log('🔍 Teams token query result:', { data, error })

      if (!error && data) {
        const expiresAt = new Date(data.expires_at)
        const now = new Date()
        const bufferTime = new Date(Date.now() + 10 * 60 * 1000) // 10 min buffer
        const isValid = expiresAt > bufferTime
        
        console.log('🔍 Token validation:', {
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
          bufferTime: bufferTime.toISOString(),
          isValid,
          minutesUntilExpiry: Math.floor((expiresAt - now) / 1000 / 60)
        })
        
        // If token expires within 10 minutes but is still valid, try to refresh it
        if (!isValid && data.refresh_token && expiresAt > now) {
          console.log('🔄 Token expiring soon, attempting refresh...')
          
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const refreshResponse = await fetch(
              'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/refresh-microsoft-token',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({ userId: user.id })
              }
            )
            
            const refreshResult = await refreshResponse.json()
            
            if (refreshResponse.ok && refreshResult.success) {
              console.log('✅ Token refreshed successfully! New expiration:', refreshResult.expiresAt)
              setIsTeamsConnected(true)
            } else {
              console.log('❌ Token refresh failed:', refreshResult.error)
              setIsTeamsConnected(false)
            }
          } catch (refreshError) {
            console.error('❌ Error during token refresh:', refreshError)
            setIsTeamsConnected(false)
          }
        } else {
          // Token is still valid or already expired
          setIsTeamsConnected(isValid)
        }
      } else {
        console.log('❌ No valid token found or error occurred')
        setIsTeamsConnected(false)
      }
    } catch (err) {
      console.error('❌ Error checking Teams connection:', err)
      setIsTeamsConnected(false)
    } finally {
      setCheckingTeamsAuth(false)
    }
  }

  // NEW: Handle Microsoft Teams OAuth
const handleTeamsAuth = () => {
    // Save application ID so we can reopen modal after OAuth
  localStorage.setItem('reopen_interview_modal', application.id)  // ← ADD THIS LINE!
 
  const clientId = microsoftConfig.MICROSOFT_CLIENT_ID
  const redirectUri = microsoftConfig.MICROSOFT_REDIRECT_URI

  if (!clientId || !redirectUri) {
    setMeetError('Microsoft Teams configuration is incomplete. Check Integrations & Secrets in Settings.')
    return
  }

const scopes = [
  'OnlineMeetings.ReadWrite',
  'User.Read',
  'offline_access'
].join(' ')

const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `redirect_uri=${encodeURIComponent(redirectUri)}&` +
  `response_mode=query&` +
  `scope=${encodeURIComponent(scopes)}&` +
  `prompt=consent&` +  // ← ADD THIS!
  `state=${user.id}`

  window.location.href = authUrl
}

// Create Microsoft Teams meeting (with automatic token refresh)
  const handleCreateTeamsMeeting = async () => {
    if (!formData.interviewDate || !formData.interviewTime) {
      alert('Please select date and time first')
      return
    }

    if (!isTeamsConnected) {
      setNeedsTeamsAuth(true)
      setMeetError('Please connect your Microsoft account first')
      return
    }

    setCreatingMeet(true)
    setMeetError('')

    try {
      const scheduledDateTime = new Date(`${formData.interviewDate}T${formData.interviewTime}:00`)
      const durationMinutes = parseInt(formData.duration)
      const endDateTime = new Date(scheduledDateTime.getTime() + durationMinutes * 60000)
      
      console.log('📅 Creating Microsoft Teams meeting...')
      
      const { data, error } = await supabase.functions.invoke('create-teams-meeting', {
        body: {
          userId: user.id,
          subject: `Interview - ${application.reference_number}`,
          startDateTime: scheduledDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          candidateName: `${application.application_data?.data?.section2?.firstName} ${application.application_data?.data?.section2?.surname}`,
          applicationId: application.id
        }
      })

      console.log('📧 Teams API response:', { data, error })

      if (error) {
        console.error('❌ Teams API error:', error)
        
        // If auth error, try to refresh token and retry once
        if (error.message?.includes('auth') || error.message?.includes('token') || error.message?.includes('401')) {
          console.log('🔄 Auth error detected, attempting token refresh...')
          
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const refreshResponse = await fetch(
              'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/refresh-microsoft-token',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({ userId: user.id })
              }
            )
            
            if (refreshResponse.ok) {
              console.log('✅ Token refreshed, retrying meeting creation...')
              
              // Retry meeting creation with refreshed token
              const { data: retryData, error: retryError } = await supabase.functions.invoke('create-teams-meeting', {
                body: {
                  userId: user.id,
                  subject: `Interview - ${application.reference_number}`,
                  startDateTime: scheduledDateTime.toISOString(),
                  endDateTime: endDateTime.toISOString(),
                  candidateName: `${application.application_data?.data?.section2?.firstName} ${application.application_data?.data?.section2?.surname}`,
                  applicationId: application.id
                }
              })
              
              if (!retryError && retryData?.success) {
                console.log('✅ Teams meeting created after token refresh:', retryData.joinUrl)
                setFormData({ ...formData, interviewUrl: retryData.joinUrl })
                setMeetCreated(true)
                setCreatingMeet(false)
                return
              }
            }
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError)
          }
          
          // If we get here, refresh failed
          setNeedsTeamsAuth(true)
          setMeetError('Microsoft authentication expired. Please reconnect.')
        } else {
          setMeetError(error.message || 'Failed to create Teams meeting')
        }
        setCreatingMeet(false)
        return
      }

      if (!data || !data.success) {
        console.error('❌ No valid response from Teams API')
        setMeetError('Failed to create Teams meeting')
        setCreatingMeet(false)
        return
      }

      // Success - set the meeting URL
      console.log('✅ Teams meeting created:', data.joinUrl)
      setFormData({ ...formData, interviewUrl: data.joinUrl })
      setMeetCreated(true)
      setCreatingMeet(false)

    } catch (error) {
      console.error('Error creating Teams meeting:', error)
      setMeetError(error.message || 'Failed to create Teams meeting')
      setCreatingMeet(false)
    }
  }
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.interviewDate || !formData.interviewTime) {
      alert('Please fill in all required fields')
      return
    }
    
    if (formData.interviewType === 'video' && !formData.interviewUrl) {
      alert('Please enter a meeting URL or auto-create one')
      return
    }

    if (formData.interviewType === 'in-person' && !formData.location) {
      alert('Please enter the location for in-person interview')
      return
    }

    setLoading(true)

    try {
      // Create scheduled date/time (used in multiple places below)
      const scheduledDateTime = new Date(`${formData.interviewDate}T${formData.interviewTime}:00`)
      
      // 1. Update application status and interview details
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'interview_scheduled',
          interview_scheduled: scheduledDateTime.toISOString(),
          interview_date: formData.interviewDate,
          interview_time: formData.interviewTime,
          interview_duration: parseInt(formData.duration),
          interview_platform: formData.platform || null,
          meeting_url: formData.interviewType === 'video' ? formData.interviewUrl : null,
          interview_notes: formData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id)

      if (updateError) throw updateError

      // 2. Create scheduled event
      
      const eventTitle = formData.interviewType === 'phone' 
        ? 'Phone Interview'
        : formData.interviewType === 'video'
        ? 'Video Interview'
        : 'In-Person Interview'

      const locationDetails = formData.interviewType === 'video' 
        ? formData.interviewUrl
        : formData.interviewType === 'in-person'
        ? formData.location
        : 'Phone call'

      const { data: eventData, error: eventError } = await supabase
        .from('scheduled_events')
        .insert({
          application_id: application.id,
          scheduled_by: user?.id,
          event_type: 'interview',
          event_title: `${eventTitle} - ${application.reference_number}`,
          event_description: formData.notes,
          scheduled_date: scheduledDateTime.toISOString().split('T')[0],
          scheduled_time: formData.interviewTime,
          duration_minutes: parseInt(formData.duration),
          timezone: 'UTC',
          location_type: formData.interviewType === 'in-person' ? 'in-person' : 'online',
          location_details: locationDetails,
          platform: formData.platform === 'google' ? 'Google Meet' : 'Microsoft Teams', // NEW: Include platform
          status: 'scheduled'
        })
        .select()
        .single()

      if (eventError) throw eventError

      // Create reminder entry (24 hours before interview)
      const interviewDateTime = new Date(`${formData.interviewDate}T${formData.interviewTime}:00`)
      const reminderTime = new Date(interviewDateTime)
      reminderTime.setHours(reminderTime.getHours() - 24)

      const { error: reminderError } = await supabase
        .from('scheduled_reminders')
        .insert({
          event_id: eventData.id,
          reminder_type: 'interview_reminder',
          scheduled_for: reminderTime.toISOString(),
          sent: false
        })

      if (reminderError) {
        console.error('Failed to create reminder:', reminderError)
      }

      // 3. Send interview invitation email
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        const applicantEmail = application.application_data?.data?.section2?.email || 
                               application.application_data?.data?.section4?.email

        const emailResponse = await fetch(
          'https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/send-interview-invitation',
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
              interviewDate: formData.interviewDate,
              interviewTime: formData.interviewTime,
              meetingLink: formData.interviewType === 'video' 
                ? formData.interviewUrl 
                : '#',
              duration: parseInt(formData.duration)
            })
          }
        )

        if (!emailResponse.ok) {
          console.error('Failed to send interview invitation email:', await emailResponse.text())
        } else {
          console.log('Interview invitation email sent successfully')
        }
      } catch (emailError) {
        console.error('Error sending interview invitation email:', emailError)
      }

      // Success - call callback
      if (onScheduled) {
        onScheduled('interview_scheduled')
      }

    } catch (error) {
      console.error('Error scheduling interview:', error)
      alert('Failed to schedule interview: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return createPortal(
    <div className="recruiter-modal-backdrop">
      <div className="recruiter-modal max-w-2xl">
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="recruiter-modal__eyebrow">Interview workflow</p>
              <h3 className="recruiter-modal__title">Schedule interview</h3>
              <p className="recruiter-modal__subtitle">
                Candidate: {application.application_data?.data?.section2?.firstName} {application.application_data?.data?.section2?.surname} • {application.reference_number}
                <br />
                Position: {application.applied_rank}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              console.log('❌ X button clicked, calling onCancel')
              onCancel()
            }}
            disabled={loading}
            className="recruiter-modal__close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="recruiter-modal__body space-y-5">
            {/* Interview Type */}
            <div>
              <label className="block text-sm font-medium text-fg-secondary mb-2">
                Interview Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
 formData.interviewType === 'video' ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'
 }`}>
                  <input
                    type="radio"
                    name="interviewType"
                    value="video"
                    checked={formData.interviewType === 'video'}
                    onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
                    className="sr-only"
                  />
                  <Video className="w-5 h-5" />
                  <span className="font-medium">Video</span>
                </label>

                <label className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
 formData.interviewType === 'phone' ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'
 }`}>
                  <input
                    type="radio"
                    name="interviewType"
                    value="phone"
                    checked={formData.interviewType === 'phone'}
                    onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
                    className="sr-only"
                  />
                  <Phone className="w-5 h-5" />
                  <span className="font-medium">Phone</span>
                </label>

                <label className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
 formData.interviewType === 'in-person' ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'
 }`}>
                  <input
                    type="radio"
                    name="interviewType"
                    value="in-person"
                    checked={formData.interviewType === 'in-person'}
                    onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
                    className="sr-only"
                  />
                  <MapPin className="w-5 h-5" />
                  <span className="font-medium">In-Person</span>
                </label>
              </div>
            </div>

            {/* Microsoft Teams Connection Status (only for video interviews) */}
            {formData.interviewType === 'video' && (
              <div>
                {!isTeamsConnected ? (
                  <div className="p-4 bg-accent-soft border-2 border-accent/40 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-10 h-10 flex-shrink-0 mt-0.5" viewBox="0 0 23 23">
                        <path d="M11 0H0V11H11V0Z" fill="#F25022"/>
                        <path d="M23 0H12V11H23V0Z" fill="#7FBA00"/>
                        <path d="M11 12H0V23H11V12Z" fill="#00A4EF"/>
                        <path d="M23 12H12V23H23V12Z" fill="#FFB900"/>
                      </svg>
                      <div className="flex-1">
                        <h4 className="font-semibold text-fg mb-1">Microsoft Teams Required</h4>
                        <button
                          type="button"
                          onClick={handleTeamsAuth}
                          className="flex items-center gap-2 px-4 py-2.5 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-fill-hover transition-colors text-sm font-medium"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 23 23">
                            <path d="M11 0H0V11H11V0Z" fill="white"/>
                            <path d="M23 0H12V11H23V0Z" fill="white"/>
                            <path d="M11 12H0V23H11V12Z" fill="white"/>
                            <path d="M23 12H12V23H23V12Z" fill="white"/>
                          </svg>
                          <span>Connect Microsoft Teams</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-success-soft border border-success-line rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-success">Microsoft Teams Connected</span>
                      <p className="text-xs text-success mt-0.5">Ready to auto-create meeting links</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Interview Date *
                </label>
                <input
                  type="date"
                  value={formData.interviewDate}
                  onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                  min={today}
                  required
                  className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Interview Time *
                </label>
                <input
                  type="time"
                  value={formData.interviewTime}
                  onChange={(e) => setFormData({ ...formData, interviewTime: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-fg-secondary mb-2">
                Duration (minutes) *
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            {/* Teams Meeting URL */}
            {formData.interviewType === 'video' && (
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  Teams Meeting URL *
                </label>
                
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.interviewUrl}
                    onChange={(e) => setFormData({ ...formData, interviewUrl: e.target.value })}
                    placeholder="https://teams.microsoft.com/l/meetup-join/..."
                    required
                    className="flex-1 px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                  />
                  
                  {/* Auto-create button for Teams */}
                  <button
                    type="button"
                    onClick={handleCreateTeamsMeeting}
                    disabled={creatingMeet || meetCreated || !formData.interviewDate || !formData.interviewTime || !isTeamsConnected}
                    className="px-4 py-2 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-fill-hover disabled:bg-line-strong disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    {creatingMeet ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : meetCreated ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Created
                      </>
                    ) : (
                      'Auto-create'
                    )}
                  </button>
                </div>

                {/* Error message */}
                {meetError && (
                  <p className="mt-2 text-sm text-danger">{meetError}</p>
                )}

                {/* Success message */}
                {meetCreated && (
                  <p className="mt-2 text-sm text-success flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Meeting link created successfully!
                  </p>
                )}
              </div>
            )}

            {/* In-Person Location */}
            {formData.interviewType === 'in-person' && (
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter interview location"
                  required
                  className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-fg-secondary mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Any additional information or instructions..."
                className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="recruiter-modal__footer">
              <button
                type="button"
                onClick={() => {
                  console.log('❌ Cancel button clicked, calling onCancel')
                  onCancel()
                }}
                disabled={loading}
                className="workspace-action-button workspace-action-button--secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="workspace-action-button workspace-action-button--primary min-w-[12rem] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule Interview'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
