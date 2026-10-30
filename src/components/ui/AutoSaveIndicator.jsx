import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function AutoSaveIndicator({ status, lastSaved }) {
  const formatTime = (date) => {
    if (!date) return ''
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date)
  }

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-2 text-fg-secondary">
        <Loader className="w-4 h-4 animate-spin" />
        <span className="text-xs font-medium">Saving...</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-danger">
        <AlertCircle className="w-4 h-4" />
        <span className="text-xs font-medium">Save failed</span>
      </div>
    )
  }

  if (status === 'saved' && lastSaved) {
    return (
      <div className="flex items-center gap-2 text-success">
        <CheckCircle className="w-4 h-4" />
        <span className="text-xs font-medium">Saved at {formatTime(lastSaved)}</span>
      </div>
    )
  }

  return null
}