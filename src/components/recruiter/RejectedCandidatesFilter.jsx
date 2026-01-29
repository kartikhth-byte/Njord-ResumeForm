// Add this to your existing ApplicationFilters.jsx component

import { XCircle } from 'lucide-react'

// Add this checkbox to your filter section
export function RejectedCandidatesFilterCheckbox({ includeRejected, setIncludeRejected }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={includeRejected}
        onChange={(e) => setIncludeRejected(e.target.checked)}
        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
      />
      <div className="flex items-center gap-2">
        <XCircle className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
        <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
          Include Rejected Candidates
        </span>
      </div>
    </label>
  )
}

// Update your Supabase query to include rejected applications when checked
// Example implementation:

export async function fetchApplications({ 
  statusFilter, 
  searchQuery, 
  includeRejected 
}) {
  let query = supabase
    .from('applications')
    .select('*')

  // Status filter
  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'active') {
      // Show all statuses except rejected and withdrawn
      query = query.not('status', 'in', '("rejected","withdrawn")')
    } else {
      query = query.eq('status', statusFilter)
    }
  } else if (!includeRejected) {
    // Default: exclude rejected and withdrawn unless explicitly included
    query = query.not('status', 'in', '("rejected","withdrawn")')
  }

  // Add other filters (search, etc.)
  if (searchQuery) {
    query = query.or(`reference_number.ilike.%${searchQuery}%,applied_rank.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Example usage in your RecruiterApplications.jsx:

/*
import { RejectedCandidatesFilterCheckbox } from './RejectedCandidatesFilter'

function RecruiterApplications() {
  const [includeRejected, setIncludeRejected] = useState(false)
  const [applications, setApplications] = useState([])
  
  useEffect(() => {
    loadApplications()
  }, [includeRejected, statusFilter, searchQuery])
  
  const loadApplications = async () => {
    const data = await fetchApplications({
      statusFilter,
      searchQuery,
      includeRejected
    })
    setApplications(data)
  }
  
  return (
    <div>
      // ... other filters ...
      
      <RejectedCandidatesFilterCheckbox
        includeRejected={includeRejected}
        setIncludeRejected={setIncludeRejected}
      />
      
      // ... application list ...
    </div>
  )
}
*/