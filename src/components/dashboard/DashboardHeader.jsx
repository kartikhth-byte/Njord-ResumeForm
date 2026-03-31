// src/components/dashboard/DashboardHeader.jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import PageHeader from '../ui/PageHeader'

export default function DashboardHeader({ title, description, onRefresh, backTo = '/recruiter/dashboard' }) {
  const navigate = useNavigate()

  const actions = (
    <>
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="workspace-action-button workspace-action-button--secondary"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="workspace-action-button workspace-action-button--primary"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      ) : null}
    </>
  )

  return (
    <PageHeader
      eyebrow="Recruiter Workspace"
      title={title}
      description={description}
      actions={actions}
    />
  )
}
