import { supabase } from '../lib/supabase'

const messages = {
  permission_denied: 'Only a Master Recruiter or authorized operator can edit companies and ships.',
  version_conflict: 'This record changed in another session. Cancel, refresh the directory and edit the latest version.',
  record_unavailable: 'This record is no longer available. Refresh the directory.',
  company_name_exists: 'A company with this name already exists.',
  ship_name_exists: 'This company already has a ship with this name.',
  name_required: 'Enter a name of 1–200 characters.',
  vessel_type_required: 'Choose a vessel type.',
  reviewed_company_required: 'This company is no longer available. Refresh the directory.',
}

export async function saveClientFleetRecord({ kind, name, record, companyId, vesselTypeId }) {
  const { data, error } = await supabase.rpc('save_client_fleet_record', {
    p_kind: kind, p_name: name.trim(), p_id: record?.id || null,
    p_company_id: kind === 'ship' ? companyId : null,
    p_vessel_type_id: kind === 'ship' ? vesselTypeId || null : null,
    p_expected_version: record?.version ?? null,
  })
  if (error) throw new Error(messages[error.message] || 'Could not save. Your changes are still here; please try again.')
  return data
}
