import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createAdminSupabaseClient } from '../_shared/runtime-settings.ts'
import { getPublicApiKey } from '../_shared/api-keys.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { signIntakeToken,signNeedleToken } from '../_shared/needle-signing.ts'
import { needleCallerAccess,DEFAULT_NEEDLE_ORG_ID } from '../_shared/needle-access.js'
import { resumeIntakeHandler } from './handler.js'
serve(async req=>{
 const cors=await getCorsHeaders(req,{allowMethods:'POST, OPTIONS'})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 try{
  const admin=createAdminSupabaseClient()
  const handler=resumeIntakeHandler({admin,
   requester:(token:string)=>createClient(Deno.env.get('SUPABASE_URL')!,getPublicApiKey(),{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}}),
   authorize:(id:string)=>needleCallerAccess(admin,id,Deno.env.get('NEEDLE_AI_SEARCH_ACCESS')),
   signIntake:signIntakeToken,signNeedle:signNeedleToken,organization:Deno.env.get('NEEDLE_ORG_ID')||DEFAULT_NEEDLE_ORG_ID,
   intakeOrigin:Deno.env.get('RESUME_INTAKE_ORIGIN'),needleOrigin:Deno.env.get('NEEDLE_API_ORIGIN'),enabled:Deno.env.get('RESUME_INTAKE_ENABLED')==='true'})
  const r=await handler(req);const headers=new Headers(r.headers);Object.entries(cors).forEach(([k,v])=>headers.set(k,v))
  return new Response(r.body,{status:r.status,headers})
 }catch{return new Response(JSON.stringify({error:'Platform Resume Intake unavailable. No candidate was saved; retry uses the same file hash.'}),{status:503,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})}
})
