import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, Clock3, XCircle } from 'lucide-react'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import useKpiTrackerData from '../hooks/useKpiTrackerData'
import useRecruitmentWork from '../hooks/useRecruitmentWork'
import useClientFleet from '../hooks/useClientFleet'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruitmentCasePanel from '../components/recruiter/RecruitmentCasePanel'
import RecordFormDialog from '../components/recruiter/RecordFormDialog'
import { assignRecruitmentWork } from '../services/recruitmentWorkService'
import RecruitmentResourceActions from '../components/recruiter/RecruitmentResourceActions'
import DirectoryNotes from '../components/recruiter/DirectoryNotes'
import SearchableFilterSelect from '../components/recruiter/SearchableFilterSelect'
import GroupedDirectoryTable from '../components/recruiter/GroupedDirectoryTable'
import PageHeader from '../components/ui/PageHeader'
import SegmentedControl from '../components/ui/SegmentedControl'
import useRefreshOnFocus from '../hooks/useRefreshOnFocus'
import { supabase } from '../lib/supabase'
import { dateCell, dateTimeCell, latestRecordDate, recordDisplayId } from '../utils/directoryDisplay'
import { WORK_STAGES, workStage, taskProgress, nextWork, groupRecruitmentRows } from '../utils/recruitmentWorkspace'
import { isCaseTerminal } from '../utils/recruitmentCase'
const button='workspace-action-button workspace-action-button--secondary'
const field='rounded-control border border-line bg-surface p-2 text-sm w-full'
const filterField=`${field} h-11 min-w-0`
const filterLabel='flex min-w-0 flex-col gap-1.5 text-sm'
const when=value=>value?dateTimeCell(value):''

export default function RecruitmentWorkspacePage() {
 const auth=useAuth(),{permissions,role,hasPermission}=usePermissions()
 const allowed=hasPermission('view_requirements'),canMove=hasPermission('edit_junction_status')
 const tracker=useKpiTrackerData({enabled:allowed,scope:'recruitment'}),work=useRecruitmentWork(allowed),fleet=useClientFleet({enabled:allowed,includeArchived:true,includeVesselTypes:false})
 const [params,setParams]=useSearchParams(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[edit,setEdit]=useState(null)
 const [caseBusy,setCaseBusy]=useState(false)
 const [noteCase,setNoteCase]=useState(null),[notesByCase,setNotesByCase]=useState({}),[noteRevision,setNoteRevision]=useState(0)
 const [performer,setPerformer]=useState(''),[occurred,setOccurred]=useState('')
 const pendingParams=useRef(params)
 useLayoutEffect(()=>{pendingParams.current=params},[params])
 // Router search-param callbacks do not queue like React state. Compose rapid
 // filter edits against the last requested URL so one cannot undo another.
 const updateParams=change=>{
  const next=new URLSearchParams(pendingParams.current)
  change(next);pendingParams.current=next;setParams(next)
 }
 const set=(key,value)=>updateParams(n=>{value?n.set(key,value):n.delete(key)})
 const reload=()=>{tracker.reload();work.reload()}
 useRefreshOnFocus(()=>{ reload(); fleet.reload() },allowed)
 const people=tracker.data.recruiters.filter(r=>['Master Recruiter','Recruiter'].includes(r.role_name))
 const name=id=>tracker.data.recruiters.find(r=>r.id===id)?.full_name||tracker.data.recruiters.find(r=>r.id===id)?.email||'Unassigned'
 const all=tracker.data.cases.map(c=>{
  const candidate=tracker.data.prospects.find(p=>p.id===c.prospect_id),requirement=tracker.data.requirements.find(r=>r.id===c.requirement_id)
  const company=fleet.companies.find(x=>x.id===requirement?.company_id),ship=fleet.ships.find(x=>x.id===requirement?.ship_id)
  const owner=work.assignments.find(a=>a.case_id===c.id&&a.task_key==='case'),tasks=taskProgress(c,tracker.data.caseEvents,work.assignments)
  return {...c,candidate,requirement,company,ship,owner,tasks}
 })
 // Preserve bookmarked stage filters created before the display-label rename.
 const selectedStage=params.get('stage')==='Joining preparation'?'Pre-joining':params.get('stage')
 const rows=all.filter(c=>{
  if(!selectedStage&&isCaseTerminal(c.status))return false
  if(selectedStage&&selectedStage!==workStage(c.status))return false
  if(params.get('scope')==='mine'&&c.owner?.assignee_id!==auth.user?.id&&!c.tasks.some(t=>!t.done&&t.assignment?.assignee_id===auth.user?.id))return false
  if(params.get('recruiter')&&c.owner?.assignee_id!==params.get('recruiter')&&!c.tasks.some(t=>!t.done&&t.assignment?.assignee_id===params.get('recruiter')))return false
  if(params.get('company')&&c.company?.id!==params.get('company'))return false
  if(params.get('ship')&&c.ship?.id!==params.get('ship'))return false
  if(params.get('requirement')&&c.requirement_id!==params.get('requirement'))return false
  if(params.get('attention')&&!(!c.owner?.assignee_id||c.tasks.some(t=>!t.done&&t.due&&new Date(t.due)<new Date())))return false
  return [c.display_id,c.candidate?.display_id,c.candidate?.name,c.requirement?.display_id,c.requirement?.req_id_display,c.company?.name,c.ship?.name].join(' ').toLowerCase().includes((params.get('q')||'').toLowerCase())
 })
 useEffect(()=>{
  let active=true
  const ids=tracker.data.cases.map(c=>c.id)
  if(!ids.length)return undefined
  Promise.all(Array.from({length:Math.ceil(ids.length/100)},(_,i)=>supabase.from('directory_notes').select('case_id,body,created_at').in('case_id',ids.slice(i*100,i*100+100)).order('created_at',{ascending:false}))).then(results=>{
   if(!active)return
   const map={}
   for(const result of results)for(const note of result.data||[])if(!map[note.case_id])map[note.case_id]=note
   setNotesByCase(map)
  })
  return()=>{active=false}
 },[tracker.data.cases,noteRevision])
 const selected=all.find(c=>c.id===params.get('case'))
 const save=async(c,key,assignment,assignee,due,start,note)=>{
  setBusy(true);setError('')
  try{await assignRecruitmentWork(c,key,assignment,assignee,due,start,note);setEdit(null);reload()}
  catch(e){setError(e.message.includes('version_conflict')?'Someone updated this assignment. Refresh and try again.':e.message)}finally{setBusy(false)}
 }
 const take=(c,key,assignment,start=false)=>save(c,key,assignment,auth.user.id,assignment?.due_at,start)
 const open=c=>{setPerformer(auth.user.id);setOccurred('');setEdit(null);setError('');set('case',c.id)}
 const assignmentForm=edit&&<form aria-label="Task assignment" className="rounded border border-line p-4 space-y-3" onSubmit={e=>{e.preventDefault();save(selected,edit.key,edit.assignment,edit.assignee,edit.due?new Date(edit.due).toISOString():null,false,edit.note)}}>
  <h3>Assign {edit.key==='case'?'recruitment row':edit.key}</h3>
  <SearchableFilterSelect label="Assigned recruiter" selectClassName={field} value={edit.assignee} onChange={value=>setEdit({...edit,assignee:value})} placeholder="Unassigned" options={people.map(p=>({value:p.id,label:name(p.id)}))}/>
  <label className="block">Due date<input className={field} type="datetime-local" value={edit.due} onChange={e=>setEdit({...edit,due:e.target.value})}/></label>
  <label className="block">Handover note<textarea maxLength={2000} className={field} value={edit.note} onChange={e=>setEdit({...edit,note:e.target.value})}/></label>
  <button disabled={busy} className={button}>Save assignment</button> <button type="button" className={button} onClick={()=>setEdit(null)}>Cancel</button>
 </form>
 const beginEdit=(key,assignment)=>{const date=assignment?.due_at?new Date(assignment.due_at):null;setEdit({key,assignment,assignee:assignment?.assignee_id||'',due:date?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'',note:''})}
 const renderRows=(list,start)=>list.map((c,index)=><tr key={c.id}>
  <td>{start+index+1}</td><td>{recordDisplayId(c)}</td>
  <td><button className="text-accent-text underline text-left" onClick={()=>open(c)}>{c.candidate?.name||'Candidate'}</button>{c.cycle>1&&<p className="text-xs">Cycle {c.cycle}</p>}</td>
  <td>{recordDisplayId(c.requirement,c.requirement?.req_id_display||'Requirement unavailable')}</td><td><strong className="block mb-2">{workStage(c.status)}</strong><ul aria-label="Task progress" className="space-y-1.5 text-xs">{c.tasks.map(t=>{
   const unsuccessful=['test_failed','interview_failed','test_no_show','interview_no_show','offer_declined'].includes(t.last?.to_status)
   const waived=t.last?.to_status==='test_waived'
   const active=t.status==='In progress'||t.status==='Scheduled'
   const Icon=unsuccessful?XCircle:waived?Circle:t.done?CheckCircle2:active?Clock3:Circle
   const tone=unsuccessful?'text-danger':waived?'text-fg-muted':t.done?'text-success':active?'text-warning':'text-fg-muted'
   const outcome=t.key==='application'?(t.outcome||t.status):t.last?.to_status?t.outcome:t.status
   return <li key={t.key} className="flex items-start gap-2"><Icon aria-hidden="true" className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`}/><span><span className="font-medium">{t.label}</span><span className={tone}> — {outcome}</span></span></li>
  })}</ul></td>
  <td>{nextWork(c)}{c.tasks.filter(t=>!t.done&&t.due).map(t=><p key={t.key} className="text-xs">{t.label} · {when(t.due)} · {name(t.assignment?.assignee_id)}</p>)}</td>
  <td>{name(c.owner?.assignee_id)}{canMove&&!isCaseTerminal(c.status)&&<button disabled={busy||!!work.error} className="block text-accent-text underline" onClick={()=>take(c,'case',c.owner)}>{c.owner?.assignee_id===auth.user.id?'Assigned to you':'Take over'}</button>}</td>
  <td>{dateCell(c.created_at)}</td><td>{dateCell(latestRecordDate(c.updated_at,c.owner?.updated_at,...c.tasks.map(t=>t.assignment?.updated_at),notesByCase[c.id]?.created_at))}</td>
  <td><button className="text-accent-text underline" onClick={()=>setNoteCase(c)}>{notesByCase[c.id] ? <span title={notesByCase[c.id].body}>{notesByCase[c.id].body.slice(0,32)}{notesByCase[c.id].body.length>32?'…':''}</span> : canMove ? 'Add note' : 'View notes'}</button></td>
 </tr>)
 const groups=groupRecruitmentRows(rows)
 // A changed filter reveals matches even when their groups were collapsed.
 // Opening a case or refreshing assignments does not reset the user's groups.
 const groupingScope=['q','scope','stage','recruiter','company','ship','requirement','attention'].map(key=>params.get(key)||'').join('\u001f')
 return <div className="min-h-screen bg-raised"><RecruiterTopbar user={auth.user} profile={auth.profile} role={role} signOut={auth.signOut}/><main className="mx-auto max-w-7xl px-4 py-6 space-y-5">
  <PageHeader title="Recruitment" actions={<button className={button} onClick={reload}>Refresh</button>} />
  {(tracker.refreshing||work.refreshing||fleet.refreshing)&&<p aria-live="polite" className="text-xs text-fg-muted">Refreshing list…</p>}
  {!allowed?<p role="alert">Your account cannot view recruitment.</p>:<>
  {(tracker.error||work.error||fleet.error||error)&&<p role="alert" className="text-danger">{error||work.error||tracker.error||fleet.error}</p>}
  <SegmentedControl label="Recruitment stage" value={selectedStage || ''} onChange={value=>set('stage',value)} options={[{value:'',label:'Active',count:all.filter(c=>!isCaseTerminal(c.status)).length},...WORK_STAGES.map(s=>({value:s,label:s,count:all.filter(c=>workStage(c.status)===s).length}))]} />
  <section aria-label="Recruitment filters" className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
   <label className={filterLabel}>Search<input placeholder="Name or reference…" className={filterField} value={params.get('q')||''} onChange={e=>set('q',e.target.value)}/></label>
   <label className={filterLabel}>Work<select aria-label="Work" className={filterField} value={params.get('scope')||''} onChange={e=>set('scope',e.target.value)}><option value="">All work</option><option value="mine">My work</option></select></label>
   {[['company','Company',fleet.companies],['ship','Ship',fleet.ships.filter(s=>!params.get('company')||s.company_id===params.get('company'))],['requirement','Requirement',tracker.data.requirements.filter(r=>(!params.get('company')||r.company_id===params.get('company'))&&(!params.get('ship')||r.ship_id===params.get('ship')))],['recruiter','Recruiter',people]].map(([key,label,options])=><SearchableFilterSelect key={key} label={label} className={filterLabel} selectClassName={filterField} value={params.get(key)||''} onChange={value=>{updateParams(n=>{value?n.set(key,value):n.delete(key);if(key==='company'){n.delete('ship');n.delete('requirement')}if(key==='ship')n.delete('requirement')})}} options={options.map(o=>({value:o.id,label:key==='requirement'?[o.display_id,o.req_id_display].filter(Boolean).join(' · ')||o.id:o.name||o.full_name||o.email||o.id}))}/>)}
   <div className={filterLabel}><span>Attention</span><label className="flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-3"><input type="checkbox" checked={!!params.get('attention')} onChange={e=>set('attention',e.target.checked?'1':'')}/>Needs attention</label></div>
  </section>
  {tracker.loading||work.loading||fleet.loading?<p>Loading recruitment…</p>:<section key={groupingScope} aria-label="Recruitment by company and ship">
   <GroupedDirectoryTable label="Recruitment groups" groups={groups} columns={['S.No.','Recruitment ID','Candidate','Requirement ID','Stage / task progress','Next action','Assigned recruiter','Created','Modified','Notes']} renderRows={renderRows} colWidths={[4, 10, 14, 11, 22, 12, 9, 6, 6, 6]} tableClassName="directory-table--fixed min-w-[1550px]" />
   {!rows.length&&<p className="p-5 text-sm text-fg-muted">No recruitment rows match. <button className="text-accent-text underline" onClick={()=>setParams({})}>Clear filters</button></p>}
  </section>}
  {noteCase&&<DirectoryNotes kind="recruitment" id={noteCase.id} label={recordDisplayId(noteCase)} canAdd={canMove} onClose={()=>setNoteCase(null)} onSaved={()=>setNoteRevision(n=>n+1)}/>}
  {params.get('case')&&!tracker.loading&&!selected&&<p role="alert">This recruitment record is unavailable.</p>}
  {selected&&<RecordFormDialog sidePanel title={`${recordDisplayId(selected)} · ${selected.candidate?.name||'Candidate'} · ${recordDisplayId(selected.requirement,selected.requirement?.req_id_display||'Recruitment')}`} busy={busy||caseBusy} onClose={()=>{set('case','');setEdit(null)}}>
   <div className="p-5 space-y-4"><strong className="block">{workStage(selected.status)}</strong>
   <RecruitmentResourceActions key={`${selected.id}:${selected.application_id||''}`} candidate={selected.candidate} prospectId={selected.prospect_id} applicationId={selected.application_id} applicationPending={!!selected.application && !selected.application.submitted_at} permissions={permissions}/>
   {error&&<p role="alert" className="text-danger">{error}</p>}
   <p>Assigned recruiter: {name(selected.owner?.assignee_id)}</p>
   {canMove&&!isCaseTerminal(selected.status)&&<div className="flex gap-3"><button className={button} disabled={busy} onClick={()=>take(selected,'case',selected.owner)}>Take over row</button>{role==='Master Recruiter'&&<button className={button} onClick={()=>beginEdit('case',selected.owner)}>Assign row</button>}</div>}
   {assignmentForm}
   {canMove&&!isCaseTerminal(selected.status)&&<div className="grid sm:grid-cols-2 gap-3"><SearchableFilterSelect label="Performed by" selectClassName={field} value={performer||auth.user.id} onChange={setPerformer} options={people.map(p=>({value:p.id,label:name(p.id)}))}/><label>Completed / joined at<input className={field} type="datetime-local" value={occurred} onChange={e=>setOccurred(e.target.value)}/><span className="text-xs text-fg-muted">Defaults to now. Test/interview results use their recorded occurrence time.</span></label></div>}
   <RecruitmentCasePanel key={`${selected.id}:${selected.version}`} requirementId={selected.requirement_id} selectedCaseId={selected.id} requirementOpen={selected.requirement?.status==='open'&&!selected.requirement?.archived_at&&!selected.requirement?.deleted_at} permissions={permissions} performerId={performer||auth.user.id} occurredAt={occurred?new Date(occurred).toISOString():null} onCaseChanged={reload} onBusyChange={setCaseBusy}/>
   <h2 className="font-semibold">Tasks</h2>
   <ol className="divide-y divide-line border-y border-line">
   {selected.tasks.map((t,index)=><li key={t.key} className="grid gap-2 py-3 sm:grid-cols-[2rem_minmax(0,1fr)]"><span className="text-sm text-fg-muted">{index+1}.</span><div role="region" aria-label={t.label} className="space-y-1"><h3 className="font-semibold">{t.label} · {t.status}</h3><p className="text-sm">{t.outcome||'No outcome recorded'} · Assigned: {name(t.assignment?.assignee_id)}{t.due&&` · Due ${when(t.due)}`}</p>{t.done&&t.key==='application'&&<p className="text-xs text-fg-muted">Form submitted · {when(selected.application?.submitted_at)}</p>}{t.done&&t.key!=='application'&&t.last&&<p className="text-xs text-fg-muted">Performed by {name(work.credits.find(c=>c.event_id===t.last.id)?.performed_by||t.last.actor_id)} · Recorded by {name(t.last.actor_id)} · {when(work.credits.find(c=>c.event_id===t.last.id)?.occurred_at||t.last.payload?.occurred_at||t.last.payload?.sent_at||t.last.created_at)}</p>}
    {canMove&&!t.done&&!isCaseTerminal(selected.status)&&selected.requirement?.status==='open'&&<div className="flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={()=>take(selected,t.key,t.assignment,true)}>Start task</button>{(role==='Master Recruiter'||t.assignment?.assignee_id===auth.user.id)&&<button className={button} onClick={()=>beginEdit(t.key,t.assignment)}>Assignment / due date</button>}</div>}
   </div></li>)}
   </ol>
   <h2 className="font-semibold">Handovers</h2><ol className="space-y-2">{work.history.filter(h=>h.case_id===selected.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(h=><li key={h.id} className="text-sm">{when(h.created_at)} · {name(h.actor_id)} {h.action} {h.task_key} · {name(h.previous_assignee_id)} → {name(h.assignee_id)}{h.note&&<p>{h.note}</p>}</li>)}</ol>
   </div>
  </RecordFormDialog>}
  </>}
 </main></div>
}
