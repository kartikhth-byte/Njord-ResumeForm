import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminSupabaseClient, getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { signNeedleToken } from '../_shared/needle-signing.ts'
import { DEFAULT_NEEDLE_ORG_ID } from '../_shared/needle-access.js'
import { operatorAccountsHandler } from './handler.js'
serve(async req=>{
 const cors=await getCorsHeaders(req,{allowMethods:'POST, OPTIONS'})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 try{
  const admin=createAdminSupabaseClient()
  const settings=await getRuntimeSettings(['APP_URL'],admin)
  const handler=operatorAccountsHandler({admin,appUrl:settings.APP_URL,
   authorize:async(id:string)=>{
    const result=await admin.from('platform_operators').select('user_id').eq('user_id',id).maybeSingle()
    return !result.error&&Boolean(result.data)
   },
   needleAccess:async(actor:string,target:string,disabled:boolean)=>{
    const origin=new URL(Deno.env.get('NEEDLE_API_ORIGIN')||'')
    if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/')throw new Error('Needle origin unavailable')
    const token=await signNeedleToken(actor,{org:Deno.env.get('NEEDLE_ORG_ID')||DEFAULT_NEEDLE_ORG_ID,role:'admin'},'operator')
    const result=await fetch(new URL('/api/holmes/operator',origin),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'user_access',user_id:target,disabled}),signal:AbortSignal.timeout(15000)})
    if(!result.ok)throw new Error('Needle access update failed')
   },
  })
  const result=await handler(req);const headers=new Headers(result.headers);Object.entries(cors).forEach(([k,v])=>headers.set(k,v))
  return new Response(result.body,{status:result.status,headers})
 }catch{return new Response(JSON.stringify({error:'Account operation unavailable'}),{status:503,headers:{...cors,'Content-Type':'application/json'}})}
})
