/**
 * Email Service - Supabase Edge Functions + Resend
 * Compatible with both Legacy (Application Object) and New (Direct Params) calls.
 */

import { supabase } from '../lib/supabase';

async function invokeEmailFunction(functionName, payload) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });

    if (error) {
      console.error(`Edge function error (${functionName}):`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Email sent via ${functionName}:`, data);
    return { success: true, data: data };
  } catch (error) {
    console.error(`Error invoking ${functionName}:`, error);
    return { success: false, error: error.message };
  }
}

// Helper to normalize input (Handles both Application Object and Direct Params)
const normalizeParams = (arg1, arg2) => {
  // If arg1 has 'to' or 'applicantEmail', it's likely the new direct param style
  if (arg1.to || (arg1.applicantEmail && !arg1.id)) {
    return {
      email: arg1.to || arg1.applicantEmail || arg1.email,
      name: arg1.name || arg1.applicantName || arg1.applicant_name || 'Candidate',
      ref: arg1.referenceNumber || arg1.reference_number || 'N/A',
      rank: arg1.position || arg1.desired_rank || 'Applicant',
      ...arg1 // Spread rest for custom fields like testLink
    };
  }
  // Fallback to Legacy Application Object style
  return {
    email: arg1.email,
    name: arg1.full_name || arg1.applicant_name,
    ref: arg1.reference_number,
    rank: arg1.desired_rank,
    ...arg2 // Spread secondary argument (details/rejectionData)
  };
};

export const sendApplicationReceivedEmail = async (application) => {
  return invokeEmailFunction('send-application-received', {
    applicantEmail: application.email,
    applicantName: application.full_name,
    referenceNumber: application.reference_number,
    position: application.desired_rank
  });
};

export const sendTestInvitationEmail = async (arg1, arg2) => {
  const p = normalizeParams(arg1, arg2);
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  return invokeEmailFunction('send-test-invitation', {
    applicantEmail: p.email,
    applicantName: p.name,
    referenceNumber: p.ref,
    testLink: p.testLink || arg2, // arg2 was testLink in legacy
    expiryDate: expiryDate
  });
};

export const sendTestRetakeApprovedEmail = async (arg1, arg2) => {
  const p = normalizeParams(arg1, arg2);
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  return invokeEmailFunction('send-test-retake-approved', {
    applicantEmail: p.email,
    applicantName: p.name,
    referenceNumber: p.ref,
    testLink: p.testLink || arg2 || 'https://njord-assessment.com/login',
    expiryDate: expiryDate,
    attemptNumber: p.attemptNumber || 2
  });
};

export const sendTestFailedEmail = async (arg1) => {
  const p = normalizeParams(arg1);
  return invokeEmailFunction('send-test-failed', {
    applicantEmail: p.email,
    applicantName: p.name,
    referenceNumber: p.ref,
    position: p.rank
  });
};

export const sendInterviewInvitationEmail = async (arg1, arg2) => {
  const p = normalizeParams(arg1, arg2);
  return invokeEmailFunction('send-interview-invitation', {
    applicantEmail: p.email,
    applicantName: p.name,
    referenceNumber: p.ref,
    interviewDate: p.interviewDate,
    interviewTime: p.interviewTime,
    meetingLink: p.meetingLink,
    duration: p.duration || 60
  });
};

export const sendRejectionEmail = async (arg1, arg2) => {
  const p = normalizeParams(arg1, arg2);

  // Logic to handle rejection reason mapping
  let reasonText = p.reason; 
  if (!reasonText && p.rejectionCategory) {
     const reasonMap = {
      'unqualified': 'After reviewing your qualifications, we found they did not meet the requirements for this role.',
      'failed_assessment': 'Based on your assessment results, we have decided to move forward with other candidates.',
      'failed_interview': 'After careful consideration of your interview, we have decided to pursue other candidates.',
      'no_show': 'We noticed you were unable to attend the scheduled interview.',
      'overqualified': 'Your experience exceeds the requirements for this position.',
      'wrong_role': 'We believe your skills would be better suited for a different role.',
      'future_consideration': 'While you are a strong candidate, the timing is not right for this particular position.',
      'withdrew': 'We received your withdrawal request.',
      'other': p.notes || 'After careful consideration, we have decided to pursue other candidates.'
    };
    reasonText = reasonMap[p.rejectionCategory] || reasonMap.other;
  }

  // Append custom message if it exists and isn't already part of the reason
  if (p.customMessage && !reasonText?.includes(p.customMessage)) {
    reasonText = `${reasonText}\n\n${p.customMessage}`;
  }

  return invokeEmailFunction('send-rejection-email', {
    applicantEmail: p.email,
    applicantName: p.name,
    referenceNumber: p.ref,
    position: p.rank,
    reason: reasonText,
    futureContact: p.futureContact || p.contactForFutureRoles || false,
    rejectionCategory: p.rejectionCategory
  });
};

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

export const logEmail = async (emailData) => {
  try {
    const { error } = await supabase.from('email_logs').insert({
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