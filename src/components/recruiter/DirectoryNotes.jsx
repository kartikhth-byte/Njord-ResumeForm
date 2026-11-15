import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import RecordFormDialog from './RecordFormDialog'
import { dateTimeCell } from '../../utils/directoryDisplay'

const subjects = {
  requirement: ['requirement_remarks', 'requirement_id'],
  candidate: ['prospect_notes', 'prospect_id'],
  draft: ['directory_notes', 'draft_id'],
  recruitment: ['directory_notes', 'case_id'],
  application: ['directory_notes', 'application_id'],
}

export default function DirectoryNotes({ kind, id, label, canAdd, onClose, onSaved }) {
  const [table, key] = subjects[kind]
  const [notes, setNotes] = useState([])
  const [authors, setAuthors] = useState({})
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: loadError } = await supabase.from(table).select('id,body,author_recruiter_id,created_at').eq(key, id)
        .order('created_at', { ascending: false }).limit(100)
        if (!active) return
        setNotes(data || [])
        setError(loadError?.message || '')
        const ids = [...new Set((data || []).map(note => note.author_recruiter_id).filter(Boolean))]
        if (ids.length) {
          const { data: people } = await supabase.from('profiles').select('id,full_name,email').in('id', ids)
          if (active) setAuthors(Object.fromEntries((people || []).map(person => [person.id, person.full_name || person.email])))
        }
        setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [table, key, id])

  const save = async event => {
    event.preventDefault()
    const value = body.trim()
    if (!value || busy) return
    setBusy(true); setError('')
    const actor = (await supabase.auth.getUser()).data.user
    let result
    if (kind === 'requirement') result = await supabase.rpc('add_requirement_remark', { p_requirement_id: id, p_body: value })
    else if (kind === 'candidate') result = await supabase.rpc('add_prospect_note', { p_prospect_id: id, p_body: value })
    else result = await supabase.from(table).insert({ [key]: id, body: value, author_recruiter_id: actor?.id }).select('id,body,author_recruiter_id,created_at').single()
    const { data, error: saveError } = result
    if (saveError) setError(saveError.message)
    else { setNotes(current => [data, ...current]); if (actor) setAuthors(current => ({ ...current, [actor.id]: current[actor.id] || actor.email })); setBody(''); onSaved?.() }
    setBusy(false)
  }

  return <RecordFormDialog title={`Notes · ${label}`} onClose={onClose} busy={busy}>
    <div className="space-y-4 p-5">
      {canAdd && <form onSubmit={save} className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="directory-note-body">Add note</label>
        <textarea id="directory-note-body" className="w-full rounded-control border border-line bg-surface p-3" rows={3} maxLength={2000} value={body} onChange={event => setBody(event.target.value)} />
        <button type="submit" disabled={busy || !body.trim()} className="workspace-action-button workspace-action-button--primary">Save note</button>
      </form>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loading ? <p>Loading notes…</p> : notes.length ? <ol className="space-y-3">{notes.map(note =>
        <li key={note.id} className="rounded-control border border-line p-3 text-sm">
          <p className="whitespace-pre-wrap break-words">{note.body}</p>
          <span className="mt-2 block text-xs text-fg-muted">{authors[note.author_recruiter_id] || 'Recruiter'} · <time dateTime={note.created_at}>{dateTimeCell(note.created_at)}</time></span>
        </li>)}</ol> : <p className="text-sm text-fg-muted">No notes yet.</p>}
    </div>
  </RecordFormDialog>
}
