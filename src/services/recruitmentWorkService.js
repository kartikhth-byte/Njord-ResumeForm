import { supabase } from '../lib/supabase'
import { newIdempotencyKey } from '../utils/recruitmentCase'
export async function assignRecruitmentWork(row,task,assignment,assignee,due,start,note='') {
 const {data,error}=await supabase.rpc('recruitment_assign_work',{p_case:row.id,p_task:task,p_assignee:assignee||null,p_due:due||null,p_start:start,p_version:assignment?.version||0,p_note:note})
 if(error)throw error
 return data
}
export async function moveWorkspaceCase(row,status,reason,assessment,performer,occurred) {
 const {data,error}=await supabase.rpc('recruitment_workspace_transition',{p_case:row.id,p_status:status,p_reason:reason,p_key:newIdempotencyKey('workspace'),p_version:row.version,p_assessment:assessment,p_performer:performer,p_occurred:occurred||new Date().toISOString()})
 if(error)throw error
 return data
}

export async function attestWorkspacePrincipalSend(row,form,performer) {
 const {data,error}=await supabase.rpc('recruitment_workspace_principal_send',{
  p_case:row.id,p_recipient:form.recipient.trim(),p_channel:form.channel.trim(),
  p_worksheet:form.worksheetVersion.trim(),p_key:form.idempotencyKey,p_version:row.version,
  p_sent_at:new Date(form.sentAt).toISOString(),p_performer:performer,
 })
 if(error)throw error
 return data
}
