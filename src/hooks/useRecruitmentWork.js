import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
export async function loadWorkRows(table) {
 const rows=[]
 for(let start=0;;start+=1000){
  let query=supabase.from(table).select('*').order(table==='recruitment_work_assignments'?'case_id':table==='recruitment_task_credits'?'event_id':'id')
  if(table==='recruitment_work_assignments')query=query.order('task_key')
  const {data,error}=await query.range(start,start+999)
  if(error)throw error
  rows.push(...data)
  if(data.length<1000)return rows
 }
}
export default function useRecruitmentWork(enabled=true) {
 const [state,setState]=useState({assignments:[],history:[],credits:[],loading:true,error:''})
 const [revision,setRevision]=useState(0)
 useEffect(()=>{
  if(!enabled)return
  let cancelled=false
  Promise.all(['recruitment_work_assignments','recruitment_work_history','recruitment_task_credits'].map(loadWorkRows)).then(([assignments,history,credits])=>{
   if(!cancelled)setState({assignments,history,credits,loading:false,error:''})
  }).catch(e=>{if(!cancelled)setState(s=>({...s,loading:false,error:e.message}))})
  return()=>{cancelled=true}
 },[enabled,revision])
 return {...state,reload:useCallback(()=>setRevision(v=>v+1),[])}
}
