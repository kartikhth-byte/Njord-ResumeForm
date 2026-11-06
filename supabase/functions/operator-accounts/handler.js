// Never accepts a password. Resets use the configured application redirect.
export function operatorAccountsHandler({ admin, authorize, needleAccess, appUrl }) {
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
  return async req=>{
    if(req.method!=='POST')return json({error:'Method not allowed'},405)
    const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'')
    const {data:{user:actor},error}=await admin.auth.getUser(token)
    if(error||!actor)return json({error:'Sign in required'},401)
    if(!await authorize(actor.id))return json({error:'Not authorized'},403)
    let body
    try{body=await req.json()}catch{return json({error:'Invalid request'},400)}
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request'},400)
    if(!['disable','enable','reset'].includes(body.action)||!/^[-a-f0-9]{36}$/.test(body.user_id||''))return json({error:'Invalid account action'},400)
    if(body.user_id===actor.id&&body.action!=='reset')return json({error:'The operator cannot disable itself.'},409)
    const [profile,roles,operator,auth]=await Promise.all([
      admin.from('profiles').select('id,user_type').eq('id',body.user_id).maybeSingle(),
      admin.from('user_roles').select('roles(name)').eq('user_id',body.user_id),
      admin.from('platform_operators').select('user_id').eq('user_id',body.user_id).maybeSingle(),
      admin.auth.admin.getUserById(body.user_id),
    ])
    if([profile,roles,operator,auth].some(result=>result.error))throw new Error('Account lookup failed')
    if(profile.data?.user_type!=='recruiter'||!auth.data.user)return json({error:'Recruiter account not found'},404)
    if(body.action!=='reset'&&(operator.data||(roles.data||[]).some(row=>row.roles?.name==='Master Recruiter')))return json({error:'Master Recruiter and operator access changes require KT’s reviewed handover.'},409)
    const event={category:'account',action:body.action,actor_id:actor.id,target_id:body.user_id,status:'started',details:{}}
    const logged=await admin.from('platform_operation_events').insert(event).select('id').single()
    if(logged.error)throw new Error('Audit unavailable; account unchanged')
    let failureCode='account_action_failed'
    try{
      if(body.action==='reset'){
        failureCode='reset_redirect_invalid'
        const url=new URL('/recruiter/reset-password',appUrl)
        if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Invalid application URL')
        failureCode='reset_delivery_failed'
        const result=await admin.auth.resetPasswordForEmail(auth.data.user.email,{redirectTo:url.href})
        if(result.error){
          if(result.error.status===429||result.error.code==='over_email_send_rate_limit')failureCode='reset_email_rate_limited'
          throw new Error('Reset delivery failed')
        }
      }else{
        // Revoke Needle first. If the Auth update fails, access stays denied
        // and the failed ledger entry tells the operator to reconcile/retry.
        failureCode='needle_access_update_failed'
        if(body.action==='disable')await needleAccess(actor.id,body.user_id,true)
        failureCode='auth_account_update_failed'
        const result=await admin.auth.admin.updateUserById(body.user_id,{ban_duration:body.action==='disable'?'876000h':'none'})
        if(result.error)throw new Error('Authentication update failed')
        failureCode='needle_access_update_failed'
        if(body.action==='enable')await needleAccess(actor.id,body.user_id,false)
      }
      failureCode='audit_finalization_failed'
      const done=await admin.from('platform_operation_events').update({status:'succeeded'}).eq('id',logged.data.id)
      if(done.error)throw new Error('Action completed but audit finalization failed; verify before retrying')
      return json({success:true})
    }catch{
      await admin.from('platform_operation_events').update({status:'failed',details:{code:failureCode}}).eq('id',logged.data.id)
      return json({error:failureCode==='reset_email_rate_limited'
        ? 'Password reset email is temporarily rate limited. Wait before requesting another link.'
        : failureCode==='audit_finalization_failed' ? 'The action may have completed. Verify account access before retrying; audit finalization failed.'
        : 'Account action failed. Check the audit and retry or reconcile access.'},503)
    }
  }
}
