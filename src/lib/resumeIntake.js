// Build-time UI capability. Server permissions and RESUME_INTAKE_ENABLED remain
// authoritative; enabling this flag alone cannot enable uploads or imports.
export function resumeIntakeEnabled(value = import.meta.env?.VITE_FEATURE_RESUME_INTAKE) {
  return String(value || '').trim().toLowerCase() === 'on'
}

export const RESUME_INTAKE_HOLD = 'New CV uploads are paused for now. You can still check CVs with Match Resume on a requirement.'

export function requireResumeIntake() {
  if (!resumeIntakeEnabled()) throw new Error(RESUME_INTAKE_HOLD)
}
