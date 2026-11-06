// The one list of rejection reasons. Stored in applications.rejection_category.
// The candidate email text for each reason lives in services/emailService.js.
export const REJECTION_CATEGORIES = [
  { value: 'unqualified', label: 'Does not meet requirements' },
  { value: 'failed_assessment', label: 'Failed test' },
  { value: 'failed_interview', label: 'Failed interview' },
  { value: 'no_show', label: 'No show' },
  { value: 'overqualified', label: 'Overqualified' },
  { value: 'wrong_role', label: 'Better suited to another role' },
  { value: 'future_consideration', label: 'Good candidate, wrong timing' },
  { value: 'other', label: 'Other' },
]

const LABELS = {
  ...Object.fromEntries(REJECTION_CATEGORIES.map((c) => [c.value, c.label])),
  withdrew: 'Withdrew', // older rows
}

export function rejectionCategoryLabel(value) {
  return LABELS[value] || value || ''
}

// Reason and internal notes for a rejected application. Reads the columns
// the reject flow writes; falls back to the older interview/test feedback.
export function rejectionSummary(application = {}) {
  const reason =
    rejectionCategoryLabel(application.rejection_category) ||
    application.interview_feedback?.rejection_reason ||
    application.test_feedback?.rejection_reason ||
    ''
  return {
    reason,
    notes: application.rejection_notes || application.interview_feedback?.rejection_feedback || '',
  }
}
