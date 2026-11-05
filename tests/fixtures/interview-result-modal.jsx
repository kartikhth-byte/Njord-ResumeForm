import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import InterviewResultModal from '../../src/components/InterviewResultModal.jsx'

const application = {
  id: 'synthetic-modal-test',
  reference_number: 'SMOKE-MODAL',
  applied_rank: 'Chief Officer',
  email: 'synthetic@example.invalid',
  application_data: {
    data: {
      section2: { firstName: 'Synthetic', surname: 'Applicant', email: 'synthetic@example.invalid' },
    },
  },
}

export default function Fixture() {
  const [open, setOpen] = useState(true)
  const [status, setStatus] = useState('')

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open modal</button>
      <span data-testid="modal-state">{open ? 'open' : 'closed'}</span>
      <span data-testid="result-status">{status}</span>
      {open && (
        <InterviewResultModal
          application={application}
          onCancel={() => setOpen(false)}
          onResultUpdated={(nextStatus) => {
            setStatus(nextStatus)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(<Fixture />)
