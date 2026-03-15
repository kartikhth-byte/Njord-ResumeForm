import { useState } from 'react'
import { Filter, X, Calendar } from 'lucide-react'
import { RANK_OPTIONS } from '../utils/rankOptions'
import { VESSEL_TYPE_OPTIONS } from '../utils/vesselOptions'

export default function ApplicationFilters({ onFilterChange, onApplyFilters, activeFilters = {} }) {
const [isFiltersOpen, setIsFiltersOpen] = useState(true)
const [openDropdown, setOpenDropdown] = useState(null) // ✅ Single state for all dropdowns

  // Common nationalities (as stored in database - lowercase adjectives)
  const commonNationalities = [
    'indian', 'filipino', 'chinese', 'indonesian', 'russian',
    'ukrainian', 'romanian', 'polish', 'burmese', 'turkish',
    'bangladeshi', 'greek', 'croatian', 'bulgarian', 'egyptian'
  ]

  // Experience level options
  const experienceOptions = [
    { value: '0-2', label: '0-2 years' },
    { value: '3-5', label: '3-5 years' },
    { value: '6-10', label: '6-10 years' },
    { value: '10+', label: '10+ years' }
  ]

  // Certificate grade options (based on maritime ranks)
  const certificateGrades = [
    { value: 'Master', label: 'Master' },
    { value: 'Chief Officer', label: 'Chief Officer' },
    { value: 'Second Officer', label: 'Second Officer' },
    { value: 'Third Officer', label: 'Third Officer' },
    { value: 'Chief Engineer', label: 'Chief Engineer' },
    { value: 'Second Engineer', label: 'Second Engineer' },
    { value: 'Third Engineer', label: 'Third Engineer' },
    { value: 'Fourth Engineer', label: 'Fourth Engineer' }
  ]

  // Availability options
  const availabilityOptions = [
    { value: 'now', label: 'Available Now' },
    { value: '30', label: 'Within 30 days' },
    { value: '60', label: 'Within 60 days' },
    { value: '90', label: 'Within 90 days' }
  ]

  // Age range options
  const ageRangeOptions = [
    { value: '20-30', label: '20-30 years' },
    { value: '31-40', label: '31-40 years' },
    { value: '41-50', label: '41-50 years' },
    { value: '50+', label: '50+ years' }
  ]

  // Common visa types
  const visaTypes = [
    'C1/D (USA)', 'Schengen', 'UK', 'Canada', 'Australia',
    'Singapore', 'Japan', 'South Korea', 'UAE'
  ]

  // Common flag state endorsements
  const flagStates = [
    'Panama', 'Liberia', 'Marshall Islands', 'Singapore', 'Hong Kong',
    'Bahamas', 'Malta', 'Cyprus', 'Isle of Man', 'Antigua and Barbuda'
  ]

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...activeFilters, [filterType]: value }
    if (!value) delete newFilters[filterType]
    onFilterChange(newFilters)
  }

 const clearAllFilters = () => {
  onFilterChange({})
  if (onApplyFilters) {
    onApplyFilters({}) // Pass empty object directly
  }
}

  const getActiveFilterCount = () => {
    return Object.keys(activeFilters).filter(key => activeFilters[key]).length
  }

  const handleDateRangeQuick = (days) => {
    const toDate = new Date()
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    
    handleFilterChange('dateRange', {
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0]
    })
    setOpenDropdown(null)
  }

  return (
    <div className="mb-6 relative z-40">
      {/* Toggle Filters Button */}
      <div className="flex justify-center mb-4">
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
        >
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">
            {isFiltersOpen ? 'Hide Filters' : 'Show Filters'}
          </span>
          {getActiveFilterCount() > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-semibold">
              {getActiveFilterCount()}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${
              isFiltersOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Collapsible Filter Section with Garage Door Animation */}
<div
  className={`transition-all duration-500 ease-in-out ${
    isFiltersOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
  }`}
>
        <div className="bg-white rounded-lg shadow-sm border p-4 transform transition-transform duration-500 ease-in-out"
             style={{
               transform: isFiltersOpen ? 'translateY(0)' : 'translateY(-20px)'
             }}
        >
          {/* Filter Header */}
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={clearAllFilters}
                disabled={getActiveFilterCount() === 0}
                className={`text-sm font-medium transition-colors ${
                  getActiveFilterCount() > 0
                    ? 'text-red-600 hover:text-red-700 cursor-pointer'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Clear All
              </button>
<button
  onClick={() => onApplyFilters()}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
>
  Apply Filters
</button>
            </div>
          </div>

      {/* All Filter Dropdowns in One Consistent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        
        {/* Rank Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "position" ? null : "position")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.position ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.position 
                ? RANK_OPTIONS.find(r => r.value === activeFilters.position)?.label || 'Rank'
                : 'Rank'}
            </span>
          </button>

          {openDropdown === "position" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-lg border max-h-96 overflow-y-auto">
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Search ranks..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('position', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  
                  {RANK_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('position', option.value)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.position === option.value ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Vessel Type Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "vessel" ? null : "vessel")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.vesselType ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.vesselType 
                ? VESSEL_TYPE_OPTIONS.find(v => v.value === activeFilters.vesselType)?.label || 'Vessel Type'
                : 'Vessel Type'}
            </span>
          </button>

          {openDropdown === "vessel" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-lg border max-h-96 overflow-y-auto">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('vesselType', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  
                  {VESSEL_TYPE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('vesselType', option.value)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.vesselType === option.value ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Nationality Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "nationality" ? null : "nationality")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.nationality ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.nationality 
                ? activeFilters.nationality.charAt(0).toUpperCase() + activeFilters.nationality.slice(1)
                : 'Nationality'}
            </span>
          </button>

          {openDropdown === "nationality" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-lg border max-h-96 overflow-y-auto">
                <div className="p-2 border-b">
                  <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Common Countries</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('nationality', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  
                  {commonNationalities.map(nationality => (
                    <button
                      key={nationality}
                      onClick={() => {
                        handleFilterChange('nationality', nationality)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.nationality === nationality ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {nationality.charAt(0).toUpperCase() + nationality.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Experience Level Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "experience" ? null : "experience")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.experienceRange ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.experienceRange 
                ? experienceOptions.find(e => e.value === activeFilters.experienceRange)?.label || 'Experience'
                : 'Experience'}
            </span>
          </button>

          {openDropdown === "experience" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('experienceRange', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  {experienceOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('experienceRange', option.value)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.experienceRange === option.value ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Certificate Grade Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "certificate" ? null : "certificate")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.certificateGrade ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.certificateGrade 
                ? certificateGrades.find(c => c.value === activeFilters.certificateGrade)?.label || 'Certificate'
                : 'Certificate'}
            </span>
          </button>

          {openDropdown === "certificate" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border max-h-64 overflow-y-auto">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('certificateGrade', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  {certificateGrades.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('certificateGrade', option.value)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.certificateGrade === option.value ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Age Range Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "age" ? null : "age")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.ageRange ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.ageRange 
                ? ageRangeOptions.find(a => a.value === activeFilters.ageRange)?.label || 'Age Range'
                : 'Age Range'}
            </span>
          </button>

          {openDropdown === "age" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('ageRange', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  {ageRangeOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('ageRange', option.value)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.ageRange === option.value ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Availability Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "availability" ? null : "availability")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.availability ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.availability 
                ? availabilityOptions.find(a => a.value === activeFilters.availability)?.label || 'Availability'
                : 'Availability'}
            </span>
          </button>

          {openDropdown === "availability" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('availability', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  {availabilityOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('availability', option.value)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.availability === option.value ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Visa Types Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "visa" ? null : "visa")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.visaType ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.visaType || 'Visa Type'}
            </span>
          </button>

          {openDropdown === "visa" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border max-h-64 overflow-y-auto">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('visaType', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  {visaTypes.map(visa => (
                    <button
                      key={visa}
                      onClick={() => {
                        handleFilterChange('visaType', visa)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.visaType === visa ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {visa}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Flag State Endorsements Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "endorsement" ? null : "endorsement")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors ${
              activeFilters.flagState ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <span className="text-sm font-medium">
              {activeFilters.flagState || 'Flag State'}
            </span>
          </button>

          {openDropdown === "endorsement" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border max-h-64 overflow-y-auto">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleFilterChange('flagState', null)
                      setOpenDropdown(null)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500 italic border-b"
                  >
                    Clear Selection
                  </button>
                  {flagStates.map(state => (
                    <button
                      key={state}
                      onClick={() => {
                        handleFilterChange('flagState', state)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        activeFilters.flagState === state ? 'bg-blue-50 text-blue-600 font-medium' : ''
                      }`}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === "date" ? null : "date")}
            className={`w-full px-4 py-2 text-left border rounded-lg hover:border-blue-500 transition-colors flex items-center gap-2 ${
              activeFilters.dateRange ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              {activeFilters.dateRange 
                ? `${activeFilters.dateRange.from} to ${activeFilters.dateRange.to}`
                : 'Date Range'}
            </span>
          </button>

          {openDropdown === "date" && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-lg border p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quick Select</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleDateRangeQuick(7)}
                        className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        Last 7 days
                      </button>
                      <button
                        onClick={() => handleDateRangeQuick(30)}
                        className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        Last 30 days
                      </button>
                      <button
                        onClick={() => handleDateRangeQuick(90)}
                        className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        Last 90 days
                      </button>
                      <button
                        onClick={() => handleDateRangeQuick(365)}
                        className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        This year
                      </button>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Custom Range</label>
                    <div className="space-y-2">
                      <input
                        type="date"
                        placeholder="From"
                        value={activeFilters.dateRange?.from || ''}
                        onChange={(e) => handleFilterChange('dateRange', {
                          ...activeFilters.dateRange,
                          from: e.target.value
                        })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="date"
                        placeholder="To"
                        value={activeFilters.dateRange?.to || ''}
                        onChange={(e) => handleFilterChange('dateRange', {
                          ...activeFilters.dateRange,
                          to: e.target.value
                        })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {getActiveFilterCount() > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t">
          <span className="text-sm text-gray-600 font-medium">Active:</span>
          
          {activeFilters.position && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center gap-1">
              Rank: {RANK_OPTIONS.find(r => r.value === activeFilters.position)?.label}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-blue-900" 
                onClick={() => handleFilterChange('position', null)} 
              />
            </span>
          )}
          
          {activeFilters.vesselType && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
              Vessel: {VESSEL_TYPE_OPTIONS.find(v => v.value === activeFilters.vesselType)?.label}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-green-900" 
                onClick={() => handleFilterChange('vesselType', null)} 
              />
            </span>
          )}
          
          {activeFilters.nationality && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium flex items-center gap-1">
              Country: {activeFilters.nationality.charAt(0).toUpperCase() + activeFilters.nationality.slice(1)}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-purple-900" 
                onClick={() => handleFilterChange('nationality', null)} 
              />
            </span>
          )}

          {activeFilters.experienceRange && (
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium flex items-center gap-1">
              Experience: {experienceOptions.find(e => e.value === activeFilters.experienceRange)?.label}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-indigo-900" 
                onClick={() => handleFilterChange('experienceRange', null)} 
              />
            </span>
          )}

          {activeFilters.certificateGrade && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center gap-1">
              Certificate: {certificateGrades.find(c => c.value === activeFilters.certificateGrade)?.label}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-yellow-900" 
                onClick={() => handleFilterChange('certificateGrade', null)} 
              />
            </span>
          )}

          {activeFilters.ageRange && (
            <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium flex items-center gap-1">
              Age: {ageRangeOptions.find(a => a.value === activeFilters.ageRange)?.label}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-pink-900" 
                onClick={() => handleFilterChange('ageRange', null)} 
              />
            </span>
          )}

          {activeFilters.availability && (
            <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm font-medium flex items-center gap-1">
              Availability: {availabilityOptions.find(a => a.value === activeFilters.availability)?.label}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-cyan-900" 
                onClick={() => handleFilterChange('availability', null)} 
              />
            </span>
          )}

          {activeFilters.visaType && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium flex items-center gap-1">
              Visa: {activeFilters.visaType}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-emerald-900" 
                onClick={() => handleFilterChange('visaType', null)} 
              />
            </span>
          )}

          {activeFilters.flagState && (
            <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-sm font-medium flex items-center gap-1">
              Flag State: {activeFilters.flagState}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-rose-900" 
                onClick={() => handleFilterChange('flagState', null)} 
              />
            </span>
          )}
          
          {activeFilters.dateRange && (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium flex items-center gap-1">
              Date: {activeFilters.dateRange.from} to {activeFilters.dateRange.to}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-orange-900" 
                onClick={() => handleFilterChange('dateRange', null)} 
              />
            </span>
          )}
        </div>
      )}
    </div>
      </div>
    </div>
  )
}
