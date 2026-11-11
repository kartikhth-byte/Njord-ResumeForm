import { useRef, useState } from 'react'
import { Building2, ChevronDown, ChevronRight, Pencil, Plus, RefreshCcw, Ship } from 'lucide-react'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import useClientFleet from '../hooks/useClientFleet'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import PageHeader from '../components/ui/PageHeader'
import { saveClientFleetRecord } from '../services/clientFleetService'

const secondary = 'workspace-action-button workspace-action-button--secondary disabled:opacity-50'

function FleetEditor({ editor, vesselTypes, onCancel, onSaved }) {
  const [name, setName] = useState(editor.record?.name || '')
  const [vesselTypeId, setVesselTypeId] = useState(editor.record?.vessel_type_id || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const submit = async event => {
    event.preventDefault()
    if (submitting.current) return
    if (!name.trim()) { setError('Enter a name.'); return }
    submitting.current = true
    setBusy(true); setError('')
    try {
      const saved = await saveClientFleetRecord({...editor, name, vesselTypeId})
      onSaved(saved)
    } catch (err) { setError(err.message) }
    finally { submitting.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} aria-label={`${editor.record ? 'Edit' : 'Add'} ${editor.kind}`} className="space-y-3 rounded-control border border-accent bg-surface p-4">
    <fieldset disabled={busy} className="flex min-w-0 flex-wrap items-end gap-3">
      <label className="min-w-0 flex-[2_1_14rem] text-sm"><span className="mb-1 block font-medium">{editor.kind === 'ship' ? 'Ship name' : 'Company name'}</span>
        <input autoFocus required maxLength={200} value={name} onChange={e => setName(e.target.value)} className="w-full rounded-control border border-line bg-raised px-3 py-2"/>
      </label>
      {editor.kind === 'ship' && <label className="min-w-0 flex-[1_1_12rem] text-sm"><span className="mb-1 block font-medium">Vessel type</span>
        <select required value={vesselTypeId} onChange={e => setVesselTypeId(e.target.value)} className="w-full rounded-control border border-line bg-raised px-3 py-2">
          <option value="">Choose vessel type</option>{vesselTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select></label>}
      <button className="workspace-action-button workspace-action-button--primary" type="submit">{busy ? 'Saving…' : 'Save'}</button>
      <button className={secondary} type="button" onClick={onCancel}>Cancel</button>
    </fieldset>
    {editor.record && <p className="text-xs text-fg-muted">Correct this record’s spelling or details. Existing requirements keep their saved details.</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </form>
}

export default function RecruiterCompaniesPage() {
  const { user, profile, isOperator, signOut } = useAuth()
  const { role, loading, hasPermission } = usePermissions()
  const canRead = hasPermission('view_requirements')
  const canEdit = hasPermission('edit_requirements') && (role === 'Master Recruiter' || isOperator)
  const fleet = useClientFleet({ enabled: !loading && canRead })
  const [editor, setEditor] = useState(null)
  const [collapsed, setCollapsed] = useState(new Set())
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const trigger = useRef(null)
  const begin = (next, event) => { trigger.current = event.currentTarget; setNotice(''); setEditor(next) }
  const finish = () => { setEditor(null); requestAnimationFrame(() => trigger.current?.focus()) }
  const saved = async row => {
    const label = editor.kind === 'company' ? 'Company' : 'Ship'
    if (editor.kind === 'company') setCollapsed(prev => { const next = new Set(prev); next.delete(row.id); return next })
    finish(); setQuery(''); setNotice(`${label} saved.`); await fleet.reload()
  }
  const needle = query.trim().toLowerCase()
  const companies = fleet.companies.filter(company => company.name.toLowerCase().includes(needle) || fleet.ships.some(ship => ship.company_id === company.id && ship.name.toLowerCase().includes(needle)))
  const toggle = id => setCollapsed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const renderEditor = () => <FleetEditor key={`${editor.kind}-${editor.record?.id || editor.companyId || 'new'}`} editor={editor} vesselTypes={fleet.vesselTypes} onCancel={finish} onSaved={saved}/>
  return <div className="min-h-screen bg-raised">
    <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut}/>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Companies & ships" actions={canRead && <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!!editor} className={secondary} onClick={fleet.reload}><RefreshCcw className="h-4 w-4"/>Refresh</button>
        {canEdit && <button type="button" disabled={!!editor || fleet.loading || !!fleet.error} className="workspace-action-button workspace-action-button--primary disabled:opacity-50" onClick={event => begin({kind: 'company'}, event)}><Plus className="h-4 w-4"/>Add company</button>}
      </div>}/>
      {loading ? <p role="status" className="mt-6">Loading…</p> : !canRead ? <p role="alert" className="mt-6">You do not have access to the company directory.</p> : <>
        <p className="mt-3 text-sm text-fg-muted">Companies and their ships, ready to select when adding a requirement.</p>
        {!canEdit && <p className="mt-2 text-sm text-fg-muted">Read only. A Master Recruiter or authorized operator can add or edit records.</p>}
        {notice && <p role="status" className="mt-4 text-sm text-success">{notice}</p>}
        {fleet.error && <p role="alert" className="mt-4 text-danger">Could not refresh the directory. {fleet.error}</p>}
        <label className="my-5 block max-w-md text-sm"><span className="mb-1 block text-fg-muted">Find company or ship</span><input type="search" disabled={!!editor} value={query} onChange={e => setQuery(e.target.value)} placeholder="Company or ship name…" className="w-full rounded-control border border-line bg-surface px-3 py-2"/></label>
        {editor?.kind === 'company' && !editor.record && <div className="mb-4">{renderEditor()}</div>}
        {fleet.loading ? <p role="status">Loading companies and ships…</p> : <div className="space-y-4">
          {companies.map(company => {
            const allShips = fleet.ships.filter(ship => ship.company_id === company.id)
            const ships = allShips.filter(ship => company.name.toLowerCase().includes(needle) || ship.name.toLowerCase().includes(needle))
            const open = !!needle || !collapsed.has(company.id)
            return <section key={company.id} aria-label={company.name} className="overflow-hidden rounded-xl border border-line bg-surface">
              {editor?.kind === 'company' && editor.record?.id === company.id ? renderEditor() : <div className="flex items-center gap-3 bg-accent-soft px-4 py-4">
                <button type="button" disabled={!!editor} aria-expanded={open} aria-controls={`company-ships-${company.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggle(company.id)}>
                  {open ? <ChevronDown className="h-4 w-4 shrink-0"/> : <ChevronRight className="h-4 w-4 shrink-0"/>}<Building2 className="h-5 w-5 shrink-0 text-accent-text"/>
                  <span className="min-w-0 break-words font-semibold">{company.name}<span className="ml-3 inline-block text-xs font-normal text-fg-muted">{allShips.length} {allShips.length === 1 ? 'ship' : 'ships'}</span></span>
                </button>
                {canEdit && <button type="button" disabled={!!editor} className={secondary} aria-label={`Edit company ${company.name}`} onClick={event => begin({kind: 'company', record: company}, event)}><Pencil className="h-4 w-4"/>Edit</button>}
              </div>}
              {open && <div id={`company-ships-${company.id}`} className="space-y-3 p-3 pl-6 sm:p-4 sm:pl-12">
                {ships.map(ship => editor?.kind === 'ship' && editor.record?.id === ship.id ? <div key={ship.id}>{renderEditor()}</div> : <div key={ship.id} className="flex items-center gap-3 rounded-control border border-line bg-raised px-3 py-3">
                  <Ship className="h-5 w-5 shrink-0 text-fg-muted"/><div className="min-w-0 flex-1"><p className="break-words font-medium">{ship.name}</p><p className="text-xs text-fg-muted">{fleet.vesselTypes.find(type => type.id === ship.vessel_type_id)?.name || 'Vessel type not set'}</p></div>
                  {canEdit && <button type="button" disabled={!!editor} className={secondary} aria-label={`Edit ship ${ship.name}`} onClick={event => begin({kind: 'ship', record: ship, companyId: company.id}, event)}><Pencil className="h-4 w-4"/>Edit</button>}
                </div>)}
                {!ships.length && <p className="py-2 text-sm text-fg-muted">No ships added yet.</p>}
                {editor?.kind === 'ship' && !editor.record && editor.companyId === company.id ? renderEditor() : canEdit && <button type="button" disabled={!!editor || !!fleet.error} className={secondary} aria-label={`Add ship to ${company.name}`} onClick={event => begin({kind: 'ship', companyId: company.id}, event)}><Plus className="h-4 w-4"/>Add ship</button>}
              </div>}
            </section>
          })}
          {!companies.length && !fleet.error && <p className="rounded-xl border border-dashed border-line p-8 text-center text-fg-muted">{query ? 'No companies or ships match.' : 'No companies yet.'}</p>}
        </div>}
      </>}
    </main>
  </div>
}
