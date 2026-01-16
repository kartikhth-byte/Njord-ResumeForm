/**
 * Email Service - Supabase Edge Functions + Resend
 * 
 * Uses existing Supabase Edge Functions infrastructure
 * All emails are sent via Supabase Functions which use Resend API
 */

import { supabase } from '../lib/supabase';

/**
 * Send recruitment email via Supabase Edge Function
 * @param {string} functionName - Name of the Supabase function
 * @param {Object} payload - Email data
 */
async function invokeEmailFunction(functionName, payload) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });

    if (error) {
      console.error(`Edge function error (${functionName}):`, error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`✅ Email sent via ${functionName}:`, data);
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error(`Error invoking ${functionName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send application received confirmation email
 */
export const sendApplicationReceivedEmail = async (application) => {
  return invokeEmailFunction('send-application-received', {
    applicantEmail: application.email,
    applicantName: application.full_name || application.applicantName,
    referenceNumber: application.reference_number,
    position: application.desired_rank || application.appliedRank
  });
};

/**
 * Send test invitation email
 */
export const sendTestInvitationEmail = async (application, testLink) => {
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  return invokeEmailFunction('send-test-invitation', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    testLink: testLink,
    expiryDate: expiryDate
  });
};

/**
 * Send test retake approved email
 */
export const sendTestRetakeApprovedEmail = async (application, testLink) => {
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  return invokeEmailFunction('send-test-retake-approved', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    testLink: testLink,
    expiryDate: expiryDate,
    attemptNumber: application.test_attempt_number || 2
  });
};

/**
 * Send test failed (max attempts) email
 */
export const sendTestFailedEmail = async (application) => {
  return invokeEmailFunction('send-test-failed', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    position: application.desired_rank
  });
};

/**
 * Send interview invitation email
 */
export const sendInterviewInvitationEmail = async (application, interviewDetails) => {
  return invokeEmailFunction('send-interview-invitation', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    interviewDate: interviewDetails.interviewDate,
    interviewTime: interviewDetails.interviewTime,
    meetingLink: interviewDetails.meetingLink,
    duration: interviewDetails.duration || 60
  });
};

/**
 * Send rejection email
 */
export const sendRejectionEmail = async (application, rejectionData) => {
  // Map rejection category to user-friendly reason
  const reasonMap = {
    'unqualified': 'After reviewing your qualifications, we found they did not meet the requirements for this role.',
    'failed_assessment': 'Based on your assessment results, we have decided to move forward with other candidates.',
    'failed_interview': 'After careful consideration of your interview, we have decided to pursue other candidates.',
    'no_show': 'We noticed you were unable to attend the scheduled interview.',
    'overqualified': 'Your experience exceeds the requirements for this position.',
    'wrong_role': 'We believe your skills would be better suited for a different role.',
    'future_consideration': 'While you are a strong candidate, the timing is not right for this particular position.',
    'withdrew': 'We received your withdrawal request.',
    'other': rejectionData.notes || 'After careful consideration, we have decided to pursue other candidates.'
  };
  
  const reason = reasonMap[rejectionData.rejectionCategory] || reasonMap.other;
  
  return invokeEmailFunction('send-rejection-email', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    position: application.desired_rank,
    reason: reason,
    futureContact: rejectionData.contactForFutureRoles || false,
    rejectionCategory: rejectionData.rejectionCategory
  });
};

/**
 * Send offer letter email
 */
export const sendOfferLetterEmail = async (application, offerDetails) => {
  return invokeEmailFunction('send-offer-letter', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    position: application.desired_rank,
    startDate: offerDetails.startDate,
    salary: offerDetails.salary,
    attachments: offerDetails.attachments || []
  });
};

/**
 * Log email to database (for tracking)
 */
export const logEmail = async (emailData) => {
  try {
    const { error } = await supabase
      .from('email_logs')
      .insert({
        application_id: emailData.application_id || null,
        recipient: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
        status: emailData.success ? 'sent' : 'failed',
        error_message: emailData.error,
        sent_at: new Date().toISOString()
      });

    if (error) console.error('Failed to log email:', error);
  } catch (err) {
    console.error('Error logging email:', err);
  }
};

export default {
  sendApplicationReceivedEmail,
  sendTestInvitationEmail,
  sendTestRetakeApprovedEmail,
  sendTestFailedEmail,
  sendInterviewInvitationEmail,
  sendRejectionEmail,
  sendOfferLetterEmail,
  logEmail
};