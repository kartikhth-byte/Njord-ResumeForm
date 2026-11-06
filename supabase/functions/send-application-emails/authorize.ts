/** Authenticate the applicant before loading form data or rotating review links. */
export async function authorizeSubmissionNotification(req, applicationId, admin, corsHeaders) {
  const deny = (status, error) => ({
    response: new Response(JSON.stringify({ error }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }),
    application: null,
  })
  const authorization = req.headers.get('Authorization') || ''
  if (!/^Bearer \S+$/i.test(authorization)) return deny(401, 'Authentication required')

  const { data: { user }, error: authError } = await admin.auth.getUser(
    authorization.replace(/^Bearer /i, ''),
  )
  if (authError || !user) return deny(401, 'Authentication required')
  if (typeof applicationId !== 'string' || !applicationId.trim()) {
    return deny(400, 'applicationId is required')
  }

  const { data: application, error } = await admin.from('applications')
    .select('id, user_id, public_token, reference_number, applied_rank, submitted_at')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .not('submitted_at', 'is', null)
    .single()

  // Same response for missing, unsubmitted and another person's application.
  if (error || !application || application.user_id !== user.id || !application.submitted_at) {
    return deny(404, 'Submitted application not found')
  }
  return { response: null, application }
}
