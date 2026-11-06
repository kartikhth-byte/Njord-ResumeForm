// Normal users cannot trigger applicant mail. The scheduled service identity
// or an explicitly assigned platform operator can run the job.
export async function expiryJobCaller(admin, headers, serviceKey, modernKey) {
  const token = (headers.get('authorization') || '').replace(/^Bearer /i, '')
  if (serviceKey && (modernKey ? headers.get('apikey') === serviceKey : token === serviceKey)) return { allowed: true, actorId: null }
  if (!token) return { allowed: false, actorId: null }
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return { allowed: false, actorId: null }
  const result = await admin.from('platform_operators').select('user_id').eq('user_id', user.id).maybeSingle()
  return { allowed: !result.error && Boolean(result.data?.user_id), actorId: user.id }
}
