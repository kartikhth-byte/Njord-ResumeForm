import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Stable reviewed identities. Legacy labels are not used to infer a company.
export default function useClientFleet() {
  const [state,setState]=useState({companies:[],ships:[],loading:true,error:''})
  const reload=useCallback(async()=>{
    const [companies,ships]=await Promise.all([
      supabase.from('client_companies').select('id,name').is('archived_at',null).order('name'),
      supabase.from('client_ships').select('id,name,company_id,imo').is('archived_at',null).order('name'),
    ])
    setState({companies:companies.data||[],ships:ships.data||[],loading:false,error:companies.error?.message||ships.error?.message||''})
  },[])
  useEffect(()=>{ void reload() },[reload])
  return {...state,reload}
}
