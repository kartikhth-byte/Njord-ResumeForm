// The server repeats these checks when saving; a preview is never authority.
export default function ResumeDuplicateReview({ matches, value, onChange, confirmNew, onConfirmNew }) {
  if (!matches.length) return null
  const exact = matches.some(row => ['email', 'resume'].includes(row.reason))
  return <fieldset className="space-y-2 rounded-xl border border-warning p-4">
    <legend className="px-1 text-sm font-semibold">Review possible existing candidates</legend>
    <p className="text-sm text-fg-secondary">Linking retains the existing candidate’s details. No automatic merge is made.</p>
    {matches.map(row => <label key={row.id} className="flex items-start gap-2 text-sm">
      <input type="radio" name="existingCandidate" checked={value === row.id} onChange={() => onChange(row.id)} />
      <span>{row.name} · {row.email || row.telephone || 'No contact shown'} · {row.reason === 'resume' ? 'Same résumé' : row.reason === 'email' ? 'Same email' : 'Possible identity match'}</span>
    </label>)}
    {!exact && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmNew} onChange={event => { onChange(''); onConfirmNew(event.target.checked) }} />I reviewed these matches; this is a different person.</label>}
  </fieldset>
}
