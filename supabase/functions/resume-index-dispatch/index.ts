import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { DEFAULT_NEEDLE_ORG_ID } from '../_shared/needle-access.js'
import { signNeedleToken } from '../_shared/needle-signing.ts'
import { dispatchOutbox } from '../resume-intake/outbox.js'

// Scheduled service endpoint. No browser/user token can act as the dispatcher.
// Configure its random 32+ byte secret in the scheduler's private header only.
Deno.serve(async req=>{
  const expected=Deno.env.get('RESUME_INDEX_DISPATCH_SECRET')||''
  const supplied=req.headers.get('x-resume-dispatch-secret')||''
  const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
  const [a,b]=await Promise.all([digest(expected),digest(supplied)])
  if(req.method!=='POST'||expected.length<32||a.some((v,i)=>v!==b[i]))return new Response(null,{status:403})
  if(Deno.env.get('RESUME_INTAKE_ENABLED')!=='true')return Response.json({error:'Intake disabled'},{status:503})
  try{
    const admin=createAdminSupabaseClient()
    const result=await dispatchOutbox({admin,organization:Deno.env.get('NEEDLE_ORG_ID')||DEFAULT_NEEDLE_ORG_ID,needleOrigin:Deno.env.get('NEEDLE_API_ORIGIN')!,signNeedle:signNeedleToken})
    return Response.json(result,{headers:{'Cache-Control':'no-store'}})
  }catch{return Response.json({error:'Resume index delivery unavailable'},{status:503})}
})
