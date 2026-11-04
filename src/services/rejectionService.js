import { supabase } from '../lib/supabase'
import { sendRejectionEmail } from './emailService'

// The one way to reject an application. Saves first, then emails the
// candidate, so a failed save never sends an email.
//
// - category:   value from constants/rejection.js (required)
// - notes:      internal only, never emailed
// - candidateMessage: optional extra line added to the candidate email
// - extraUpdates: other columns to write in the same update
//   (e.g. interview_feedback from the interview result)
export async function rejectApplication({
  applicationId,
  candidate = {},
  category,
  notes = '',
  candidateMessage = '',
  contactForFutureRoles = false,
  actorId = null,
  currentHandlerId = null,
  extraUpdates = {},
}) {
  if (!applicationId) throw new Error('Missing application')
  if (!category) throw new Error('Choose a reason')

  const update = {
    status: 'rejected',
    rejection_category: category,
    rejection_notes: notes || null,
    contact_for_future_roles: Boolean(contactForFutureRoles),
    updated_at: new Date().toISOString(),
    ...extraUpdates,
  }
  if (!currentHandlerId && actorId) {
    update.handling_recruiter_id = actorId
  }

  const { error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', applicationId)
  if (error) throw error

  let emailSent = false
  if (candidate.email) {
    const result = await sendRejectionEmail({
      to: candidate.email,
      name: candidate.name || 'Candidate',
      referenceNumber: candidate.referenceNumber,
      position: candidate.position || 'the position',
      rejectionCategory: category,
      customMessage: candidateMessage || undefined,
      contactForFutureRoles,
    })
    emailSent = Boolean(result?.success)
  }

  return { emailSent, handlerId: update.handling_recruiter_id || currentHandlerId }
}
