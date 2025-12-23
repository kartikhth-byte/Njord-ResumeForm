import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import { formatDisplayValue } from '../utils/formatUtils'
import SequentialStatusControl from '../components/SequentialStatusControl'
import ApplicationFilters from '../components/ApplicationFilters'
import Pagination from '../components/Pagination'
import EmbeddingGenerator from '../components/EmbeddingGenerator'
import AISearch from '../components/AISearch'
import { Users, Search, Eye, Loader2, LayoutList, Search as SearchIcon, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'

export default function RecruiterApplications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canViewApplications, loading: permLoading } = usePermissions(user)
  
  const [applications, setApplications] = useState([])
  const [filteredApplications, setFilteredApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filters, setFilters] = useState({})
  
  // Tab management
  const [activeTab, setActiveTab] = useState('all')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  
  // AI Search
  const [aiSearchActive, setAiSearchActive] = useState(false)
  const [aiSearchResults, setAiSearchResults] = useState([])
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  
  // Advanced Search mode toggle
  const [searchMode, setSearchMode] = useState('ai')
  
  // Status Pipeline
  const [expandedStatuses, setExpandedStatuses] = useState(['new'])
  

// ============================================================================
// OPTIONAL: Add this state variable after line 43 (for enhanced UI features)
// ============================================================================
const [compoundQueryType, setCompoundQueryType] = useState(null)

  const statusTabs = [
    { value: 'all', label: 'All Applications', count: 0 },
    { value: 'new', label: 'New', count: 0 },
    { value: 'interview_scheduled', label: 'Interview Scheduled', count: 0 },
    { value: 'interview_cleared', label: 'Interview Cleared', count: 0 },
    { value: 'test_scheduled', label: 'Test Scheduled', count: 0 },
    { value: 'test_cleared', label: 'Test Cleared', count: 0 },
    { value: 'hired', label: 'Hired', count: 0 },
    { value: 'rejected', label: 'Rejected', count: 0 },
    { value: 'withdrawn', label: 'Withdrawn', count: 0 }
  ]

  useEffect(() => {
    if (!permLoading && canViewApplications()) {
      loadApplications({})
    }
  }, [permLoading])

  useEffect(() => {
    filterApplications()
  }, [applications, searchTerm, statusFilter])
  
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchTerm, filters])

  const calculateExperience = (seaService) => {
    if (!seaService || seaService.length === 0) return 0
    let totalDays = 0
    seaService.forEach(service => {
      if (service.signOnDate && service.signOffDate) {
        const signOn = new Date(service.signOnDate)
        const signOff = new Date(service.signOffDate)
        const days = Math.floor((signOff - signOn) / (1000 * 60 * 60 * 24))
        totalDays += days
      }
    })
    return Math.floor(totalDays / 365)
  }

  const matchesExperienceFilter = (years, filterValue) => {
    switch (filterValue) {
      case '0-2': return years >= 0 && years <= 2
      case '3-5': return years >= 3 && years <= 5
      case '6-10': return years >= 6 && years <= 10
      case '10+': return years >= 10
      default: return true
    }
  }

  const matchesAgeRange = (age, filterValue) => {
    const ageNum = parseInt(age)
    if (isNaN(ageNum)) return false
    switch (filterValue) {
      case '20-30': return ageNum >= 20 && ageNum <= 30
      case '31-40': return ageNum >= 31 && ageNum <= 40
      case '41-50': return ageNum >= 41 && ageNum <= 50
      case '50+': return ageNum >= 50
      default: return true
    }
  }

  const matchesAvailability = (availableFrom, filterValue) => {
    if (!availableFrom) return false
    const availDate = new Date(availableFrom)
    const today = new Date()
    const daysUntilAvailable = Math.floor((availDate - today) / (1000 * 60 * 60 * 24))
    switch (filterValue) {
      case 'now': return daysUntilAvailable <= 0
      case '30': return daysUntilAvailable <= 30
      case '60': return daysUntilAvailable <= 60
      case '90': return daysUntilAvailable <= 90
      default: return true
    }
  }

  const loadApplications = async (appliedFilters = {}) => {
    try {
      setLoading(true)
      console.log('=== LOAD APPLICATIONS ===')
      console.log('Applied filters:', appliedFilters)

      let query = supabase
        .from('applications')
        .select(`
          id,
          user_id,
          applied_rank,
          status,
          created_at,
          updated_at,
          reference_number,
          public_token,
          submitted_at,
          application_data (
            data
          )
        `)
        .not('submitted_at', 'is', null) // Only show submitted applications

      if (appliedFilters.position) {
        query = query.eq('applied_rank', appliedFilters.position)
      }

      if (appliedFilters.dateRange?.from) {
        query = query.gte('created_at', appliedFilters.dateRange.from)
      }

      if (appliedFilters.dateRange?.to) {
        query = query.lte('created_at', appliedFilters.dateRange.to + 'T23:59:59')
      }

      const { data: appsData, error: appsError } = await query.order('created_at', { ascending: false })

      if (appsError) {
        console.error('Applications error:', appsError)
        throw appsError
      }

      if (!appsData || appsData.length === 0) {
        setApplications([])
        return
      }

      const applicantIds = [...new Set(appsData.map(app => app.user_id))]
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', applicantIds)

      if (profilesError) {
        console.error('Profiles error:', profilesError)
        throw profilesError
      }

      let formattedData = appsData.map(app => {
        const profile = profilesData.find(p => p.id === app.user_id)
        const section1 = app.application_data?.data?.section1 || {}
        const section2 = app.application_data?.data?.section2 || {}
        const section5 = app.application_data?.data?.section5 || {}
        const section8 = app.application_data?.data?.section8 || {}
        const section15 = app.application_data?.data?.section15 || {}
        const section16 = app.application_data?.data?.section16 || {}
        
        const fullName = [
          section2.firstName,
          section2.middleName,
          section2.surname
        ].filter(Boolean).join(' ').trim() || profile?.full_name || 'Unknown'
        
        const yearsOfExperience = calculateExperience(section16.seaService)
        const certificates = section8.certificates || []
        const certificateGrades = certificates.map(cert => cert.grade).filter(Boolean)
        const visas = section5.visas || []
        const visaTypes = visas.map(visa => visa.type).filter(Boolean)
        const endorsements = section15.endorsements || []
        const flagStates = endorsements.map(end => end.flagState).filter(Boolean)
        
        return {
          id: app.id,
          applicant_id: app.user_id,
          full_name: fullName,
          email: section2.email || profile?.email || 'Unknown',
          phone: section2.phoneNumber || 'N/A',
          nationality: section2.nationality || 'N/A',
          age: section2.age || null,
          desired_rank: section1.appliedForRank || app.applied_rank || 'Not specified',
          vessel_type: section1.vesselType || 'Not specified',
          available_from: section1.availableFrom || null,
          years_of_experience: yearsOfExperience,
          certificate_grades: certificateGrades,
          visa_types: visaTypes,
          flag_states: flagStates,
          status: app.status || 'new',
          reference_number: app.reference_number,
          public_token: app.public_token,
          created_at: app.created_at,
          updated_at: app.updated_at
        }
      })

      if (appliedFilters.vesselType) {
        formattedData = formattedData.filter(app => app.vessel_type === appliedFilters.vesselType)
      }

      if (appliedFilters.nationality) {
        formattedData = formattedData.filter(app => 
          app.nationality.toLowerCase() === appliedFilters.nationality.toLowerCase()
        )
      }

      if (appliedFilters.experience) {
        formattedData = formattedData.filter(app => 
          matchesExperienceFilter(app.years_of_experience, appliedFilters.experience)
        )
      }

      if (appliedFilters.certificateGrade) {
        formattedData = formattedData.filter(app => 
          app.certificate_grades.some(grade => 
            grade.toLowerCase().replace(/\s+/g, '_') === appliedFilters.certificateGrade
          )
        )
      }

      if (appliedFilters.ageRange) {
        formattedData = formattedData.filter(app => 
          matchesAgeRange(app.age, appliedFilters.ageRange)
        )
      }

      if (appliedFilters.availability) {
        formattedData = formattedData.filter(app => 
          matchesAvailability(app.available_from, appliedFilters.availability)
        )
      }

      if (appliedFilters.visaType) {
        formattedData = formattedData.filter(app => 
          app.visa_types.some(visa => visa.toLowerCase().includes(appliedFilters.visaType.toLowerCase().split(' ')[0]))
        )
      }

      if (appliedFilters.flagState) {
        formattedData = formattedData.filter(app => 
          app.flag_states.includes(appliedFilters.flagState)
        )
      }

      console.log('Final formatted data:', formattedData.length, 'applications')
      
      setApplications(formattedData)
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterApplications = () => {
    let filtered = [...applications]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(app =>
        app.full_name.toLowerCase().includes(term) ||
        app.email.toLowerCase().includes(term) ||
        app.desired_rank?.toLowerCase().includes(term) ||
        app.vessel_type?.toLowerCase().includes(term) ||
        app.reference_number?.toLowerCase().includes(term)
      )
    }

    setFilteredApplications(filtered)
  }

  const getStatusCounts = () => {
    const counts = {
      all: applications.length,
      new: 0,
      interview_scheduled: 0,
      interview_cleared: 0,
      test_scheduled: 0,
      test_cleared: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0
    }

    applications.forEach(app => {
      if (counts.hasOwnProperty(app.status)) {
        counts[app.status]++
      }
    })

    return counts
  }

  const handleStatusChange = (applicationId, newStatus) => {
    setApplications(prev =>
      prev.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    )
  }

  const handleFilterChange = (newFilters) => {
    console.log('Filter changed:', newFilters)
    setFilters(newFilters)
  }

  const handleApplyFilters = (filtersToApply = null) => {
    const isEvent = filtersToApply && filtersToApply.nativeEvent
    const appliedFilters = (filtersToApply && !isEvent) ? filtersToApply : filters
    console.log('Applying filters:', appliedFilters)
    loadApplications(appliedFilters)
  }

 // ============================================================================
// CRITICAL FIX: Replace these TWO functions in your RecruiterApplications.jsx
// ============================================================================

// FUNCTION 1: Replace handleAISearchResults (around line 366)
// ============================================================================
const handleAISearchResults = async (results, filters, query) => {
  setAiSearchActive(true)
  setAiSearchQuery(query)
  setCurrentPage(1)
  
  // Detect compound query type (optional - for enhanced UI)
  const queryLower = query.toLowerCase()
  if (queryLower.includes(' and ')) {
    setCompoundQueryType?.('AND')  // Optional chaining in case state doesn't exist
  } else if (queryLower.includes(' or ')) {
    setCompoundQueryType?.('OR')
  } else {
    setCompoundQueryType?.(null)
  }
  
  const applicationIds = results.map(r => r.application_id)
  
  if (applicationIds.length === 0) {
    setAiSearchResults([])
    setFilteredApplications([])
    return
  }
  
  // CRITICAL FIX 1: Add version_number to SELECT
  const { data: appsData, error } = await supabase
    .from('applications')
    .select(`
      id,
      user_id,
      applied_rank,
      status,
      created_at,
      updated_at,
      reference_number,
      public_token,
      application_data (data)
    `)
    .in('id', applicationIds)
  
  if (error) {
    console.error('Error fetching AI search results:', error)
    return
  }
  
  const applicantIds = [...new Set(appsData.map(app => app.user_id))]
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', applicantIds)
  
  const formattedResults = appsData.map(app => {
    const profile = profilesData.find(p => p.id === app.user_id)
    const section1 = app.application_data?.data?.section1 || {}
    const section2 = app.application_data?.data?.section2 || {}
    const similarity = results.find(r => r.application_id === app.id)?.similarity || 0
    
    const fullName = [
      section2.firstName,
      section2.middleName,
      section2.surname
    ].filter(Boolean).join(' ').trim() || profile?.full_name || 'Unknown'
    
    // CRITICAL FIX 2: Include version_number in result
    return {
      id: app.id,
      applicant_id: app.user_id,
      full_name: fullName,
      email: section2.email || profile?.email || 'Unknown',
      phone: section2.phoneNumber || 'N/A',
      nationality: section2.nationality || 'N/A',
      desired_rank: section1.appliedForRank || app.applied_rank || 'Not specified',
      vessel_type: section1.vesselType || 'Not specified',
      status: app.status || 'new',
      reference_number: app.reference_number,
      public_token: app.public_token,
      created_at: app.created_at,
      updated_at: app.updated_at,
      similarity: similarity
    }
  })
  
 console.log('AI Search results:', formattedResults.length, 'applications')
  
  // No deduplication needed - database constraint ensures uniqueness
  
  // Sort by similarity (highest first)
  formattedResults.sort((a, b) => b.similarity - a.similarity)
  
  setAiSearchResults(formattedResults)
  setFilteredApplications(formattedResults)

}

// FUNCTION 2: Replace handleClearAISearch (around line 441)
// ============================================================================
const handleClearAISearch = () => {
  setAiSearchActive(false)
  setAiSearchResults([])
  setAiSearchQuery('')
  setCompoundQueryType?.(null)  // Optional chaining in case state doesn't exist
  setCurrentPage(1)
  filterApplications()
}


  const toggleStatus = (status) => {
    setExpandedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return data.slice(startIndex, endIndex)
  }

  if (permLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    )
  }

  if (!canViewApplications()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">You do not have permission to view applications.</p>
        </div>
      </div>
    )
  }

  const statusCounts = getStatusCounts()
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage)
  const paginatedApplications = getPaginatedData(filteredApplications)

  const ApplicationTable = ({ apps, showRelevance = false }) => (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vessel Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
              {showRelevance && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Relevance
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apps.length === 0 ? (
              <tr>
                <td colSpan={showRelevance ? "10" : "9"} className="px-6 py-12 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchTerm || statusFilter !== 'all' || Object.keys(filters).length > 0
                      ? 'No applications match your filters'
                      : 'No applications yet'}
                  </p>
                </td>
              </tr>
            ) : (
              apps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-blue-600 font-medium">
                      {app.reference_number || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{app.full_name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {app.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {app.phone}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDisplayValue(app.desired_rank)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDisplayValue(app.vessel_type)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(app.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  {showRelevance && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                            style={{ width: `${app.similarity * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {(app.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <SequentialStatusControl
                        applicationId={app.id}
                        currentStatus={app.status}
                        onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
                      />
                      <button
                        onClick={() => navigate(`/application/view/${app.public_token || app.id}`)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View application"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
                <p className="text-sm text-gray-600">Manage and track all applications</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => {
                  setActiveTab('all')
                  setCurrentPage(1)
                }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <LayoutList className="w-5 h-5" />
                All Applications
                <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${
                  activeTab === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-900'
                }`}>
                  {applications.length}
                </span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('search')
                  setCurrentPage(1)
                }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'search'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <SearchIcon className="w-5 h-5" />
                Advanced Search
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('pipeline')
                  setCurrentPage(1)
                }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'pipeline'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                Status Pipeline
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'all' && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Quick search: name, email, reference, rank, vessel type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {statusTabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                      statusFilter === tab.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-opacity-20 bg-gray-900">
                      {statusCounts[tab.value]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <ApplicationTable apps={paginatedApplications} />

            {filteredApplications.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredApplications.length}
              />
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-6">
            <EmbeddingGenerator />

            <div className="flex items-center gap-4 bg-white rounded-lg border p-4">
              <span className="text-sm font-medium text-gray-700">Search Mode:</span>
              <button
                onClick={() => setSearchMode('ai')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  searchMode === 'ai'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🤖 AI Search
              </button>
              <button
                onClick={() => setSearchMode('filters')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  searchMode === 'filters'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🎛️ Manual Filters
              </button>
            </div>

            {searchMode === 'ai' && (
              <>
                <AISearch 
                  onResults={handleAISearchResults}
                  onLoading={setLoading}
                  onClearSearch={handleClearAISearch}
                />
                {aiSearchActive && (
                  <>
                    <ApplicationTable apps={paginatedApplications} showRelevance={true} />
                    {filteredApplications.length > 0 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={filteredApplications.length}
                      />
                    )}
                  </>
                )}
              </>
            )}

            {searchMode === 'filters' && (
              <>
                <ApplicationFilters 
                  onFilterChange={handleFilterChange}
                  onApplyFilters={handleApplyFilters}
                  activeFilters={filters}
                />
                {applications.length > 0 && (
                  <>
                    <ApplicationTable apps={paginatedApplications} />
                    {filteredApplications.length > 0 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={filteredApplications.length}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            {statusTabs.filter(s => s.value !== 'all').map(status => {
              const statusApps = applications.filter(app => app.status === status.value)
              const isExpanded = expandedStatuses.includes(status.value)
              
              return (
                <div key={status.value} className="bg-white rounded-lg border">
                  <button
                    onClick={() => toggleStatus(status.value)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <StatusBadge status={status.value} />
                      <span className="font-medium text-gray-900">{status.label}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        {statusApps.length}
                      </span>
                    </div>
                  </button>
                  
                  {isExpanded && statusApps.length > 0 && (
                    <div className="border-t">
                      {statusApps.map(app => (
                        <div key={app.id} className="p-4 border-b last:border-b-0 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-sm text-blue-600 font-medium">
                                  {app.reference_number}
                                </span>
                                <h4 className="font-medium text-gray-900">{app.full_name}</h4>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Position:</span>{' '}
                                  <span className="text-gray-900">{formatDisplayValue(app.desired_rank)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Vessel:</span>{' '}
                                  <span className="text-gray-900">{formatDisplayValue(app.vessel_type)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Email:</span>{' '}
                                  <span className="text-gray-900">{app.email}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Phone:</span>{' '}
                                  <span className="text-gray-900">{app.phone}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <SequentialStatusControl
                                applicationId={app.id}
                                currentStatus={app.status}
                                onStatusChange={(newStatus) => handleStatusChange(app.id, newStatus)}
                              />
                              <button
                                onClick={() => navigate(`/application/view/${app.public_token || app.id}`)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View application"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}