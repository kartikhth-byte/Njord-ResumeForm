// Single source of truth for status → tone. See docs/ui-theme-spec.md §3.2.
// Tones map to theme tokens: text-{tone}, bg-{tone}-soft, border-{tone}-line.

export const STATUS_TONES = {
  new: 'info',
  submitted: 'info',
  under_review: 'warning',
  documents_pending: 'warning',
  test_scheduled: 'progress',
  test_completed: 'progress',
  interview_scheduled: 'progress',
  interview_completed: 'progress',
  second_interview_scheduled: 'progress',
  second_interview_completed: 'progress',
  test_passed: 'success',
  interview_passed: 'success',
  offer_accepted: 'success',
  hired: 'success',
  offered: 'offer',
  test_failed: 'danger',
  rejected: 'danger',
  draft: 'neutral',
  withdrawn: 'neutral',
}

export const COMPLIANCE_TONES = { green: 'success', amber: 'warning', red: 'danger' }

// Full class strings (not interpolated) so Tailwind can see them.
export const TONE_BADGE_CLASSES = {
  info: 'bg-info-soft text-info border-info-line',
  warning: 'bg-warning-soft text-warning border-warning-line',
  progress: 'bg-progress-soft text-progress border-progress-line',
  success: 'bg-success-soft text-success border-success-line',
  offer: 'bg-offer-soft text-offer border-offer-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
  neutral: 'bg-neutral-soft text-neutral border-neutral-line',
}

export const toneForStatus = (status) => STATUS_TONES[status] || 'neutral'
export const badgeClassesForStatus = (status) => TONE_BADGE_CLASSES[toneForStatus(status)]
