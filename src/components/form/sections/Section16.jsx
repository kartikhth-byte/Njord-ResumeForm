import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const VESSEL_TYPE_OPTIONS = [
  { value: 'Container', label: 'Container' },
  { value: 'Tanker - Oil', label: 'Tanker - Oil' },
  { value: 'Tanker - Chemical', label: 'Tanker - Chemical' },
  { value: 'Tanker - LNG', label: 'Tanker - LNG' },
  { value: 'Tanker - LPG', label: 'Tanker - LPG' },
  { value: 'Bulk Carrier', label: 'Bulk Carrier' },
  { value: 'General Cargo', label: 'General Cargo' },
  { value: 'RoRo', label: 'RoRo (Roll on/Roll off)' },
  { value: 'Car Carrier', label: 'Car Carrier' },
  { value: 'Passenger', label: 'Passenger Ship' },
  { value: 'Cruise', label: 'Cruise Ship' },
  { value: 'Ferry', label: 'Ferry' },
  { value: 'Offshore Supply', label: 'Offshore Supply Vessel' },
  { value: 'Platform Supply', label: 'Platform Supply Vessel' },
  { value: 'AHTS', label: 'AHTS (Anchor Handling)' },
  { value: 'Tug', label: 'Tug' },
  { value: 'Dredger', label: 'Dredger' },
  { value: 'Research', label: 'Research Vessel' },
  { value: 'Fishing', label: 'Fishing Vessel' },
  { value: 'Other', label: 'Other' },
]

const ENGINE_TYPE_OPTIONS = [
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Steam Turbine', label: 'Steam Turbine' },
  { value: 'Gas Turbine', label: 'Gas Turbine' },
  { value: 'LNG Dual Fuel', label: 'LNG Dual Fuel' },
  { value: 'Electric', label: 'Electric' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Other', label: 'Other' },
]

const TRADE_ROUTE_OPTIONS = [
  { value: 'Worldwide', label: 'Worldwide' },
  { value: 'International', label: 'International' },
  { value: 'Coastal', label: 'Coastal' },
  { value: 'Deep Sea', label: 'Deep Sea' },
  { value: 'Short Sea', label: 'Short Sea' },
  { value: 'Near Coastal', label: 'Near Coastal' },
  { value: 'Regional', label: 'Regional' },
  { value: 'Other', label: 'Other' },
]

const emptySeaService = {
  vesselName: '',
  vesselType: '',
  flag: '',
  grt: '',
  dwt: '',
  mainEngine: '',
  engineKw: '',
  rankHeld: '',
  companyName: '',
  signOnDate: '',
  signOffDate: '',
  tradeRoute: '',
  reasonForLeaving: '',
}

export default function Section16({ data = {}, onUpdate }) {
  const [seaService, setSeaService] = useState(data.seaService || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.seaService) {
      setSeaService(data.seaService)
    }
  }, [data])

  // Helper function to validate year in date
  const validateYear = (dateString) => {
    if (!dateString) return null
    const year = dateString.split('-')[0]
    if (year.length !== 4) return 'Year must be 4 digits'
    const yearNum = parseInt(year, 10)
    if (yearNum < 1900 || yearNum > 2100) return 'Year must be between 1900 and 2100'
    return null
  }

  // Validation function for sea service fields
  const validateServiceField = (index, field, value) => {
    const key = `service-${index}-${field}`
    
    switch (field) {
      case 'vesselName':
        return !value ? 'Vessel name is required' : ''
      case 'vesselType':
        return !value ? 'Vessel type is required' : ''
      case 'flag':
        return !value ? 'Flag is required' : ''
      case 'grt':
        if (!value) return 'GRT is required'
        if (parseInt(value) < 0) return 'GRT must be positive'
        return ''
      case 'mainEngine':
        return !value ? 'Main engine type is required' : ''
      case 'rankHeld':
        return !value ? 'Rank held is required' : ''
      case 'companyName':
        return !value ? 'Company name is required' : ''
      case 'signOnDate':
        if (!value) return 'Sign on date is required'
        const signOnYearError = validateYear(value)
        if (signOnYearError) return signOnYearError
        return ''
      case 'signOffDate':
        if (!value) return 'Sign off date is required'
        const signOffYearError = validateYear(value)
        if (signOffYearError) return signOffYearError
        if (seaService[index]?.signOnDate && value <= seaService[index].signOnDate) {
          return 'Sign off date must be after sign on date'
        }
        return ''
      case 'tradeRoute':
        return !value ? 'Trade route is required' : ''
      case 'reasonForLeaving':
        if (!value) return 'Reason for leaving is required'
        if (value.trim().length < 5) return 'Please provide more detail (at least 5 characters)'
        return ''
      // Optional fields - no validation
      case 'dwt':
      case 'engineKw':
        return ''
      default:
        return ''
    }
  }

  const handleAddService = () => {
    const newSeaService = [...seaService, { ...emptySeaService }]
    setSeaService(newSeaService)
    onUpdate({ section16: { seaService: newSeaService } })
  }

  const handleRemoveService = (index) => {
    const newSeaService = seaService.filter((_, i) => i !== index)
    setSeaService(newSeaService)
    onUpdate({ section16: { seaService: newSeaService } })
  }

  const handleServiceChange = (index, field, value) => {
    const newSeaService = [...seaService]
    newSeaService[index] = {
      ...newSeaService[index],
      [field]: value
    }
    setSeaService(newSeaService)
    
    // Mark field as touched
    const key = `service-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateServiceField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section16: { seaService: newSeaService } })
  }

  const handleBlur = (index, field) => {
    const key = `service-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = seaService[index]?.[field]
    const error = validateServiceField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  // Calculate total sea service
  const calculateTotalService = () => {
    let totalDays = 0
    seaService.forEach(service => {
      if (service.signOnDate && service.signOffDate) {
        const signOn = new Date(service.signOnDate)
        const signOff = new Date(service.signOffDate)
        const days = Math.floor((signOff - signOn) / (1000 * 60 * 60 * 24))
        if (days > 0) totalDays += days
      }
    })
    
    const years = Math.floor(totalDays / 365)
    const months = Math.floor((totalDays % 365) / 30)
    const days = totalDays % 30
    
    return { years, months, days, totalDays }
  }

  const totalService = calculateTotalService()

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Section 16: Sea Service / Employment History</h2>
        <p className="text-gray-600 mt-1">
          List all your sea service experience in chronological order (most recent first)
        </p>
      </div>

      {/* Total Service Summary */}
      {seaService.length > 0 && totalService.totalDays > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900">Total Sea Service</h3>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {totalService.years > 0 && `${totalService.years} ${totalService.years === 1 ? 'year' : 'years'} `}
                {totalService.months > 0 && `${totalService.months} ${totalService.months === 1 ? 'month' : 'months'} `}
                {totalService.days > 0 && `${totalService.days} ${totalService.days === 1 ? 'day' : 'days'}`}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Approximately {totalService.totalDays} days total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sea Service List */}
      <div className="space-y-6">
        {seaService.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
              />
            </svg>
            <p className="text-gray-600 mb-2">No sea service records added yet</p>
            <p className="text-sm text-gray-500 mb-4">Add your vessel experience starting with most recent</p>
            <button
              onClick={handleAddService}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Sea Service Record
            </button>
          </div>
        ) : (
          <>
            {seaService.map((service, index) => (
              <div key={index} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
                {/* Service Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Vessel {index + 1}
                      {service.vesselName && ` - ${service.vesselName}`}
                    </h3>
                    {service.signOnDate && service.signOffDate && (
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(service.signOnDate).toLocaleDateString()} - {new Date(service.signOffDate).toLocaleDateString()}
                        {(() => {
                          const days = Math.floor((new Date(service.signOffDate) - new Date(service.signOnDate)) / (1000 * 60 * 60 * 24))
                          const months = Math.floor(days / 30)
                          return days > 0 ? ` (${months} months)` : ''
                        })()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveService(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Service Fields */}
                <div className="space-y-4">
                  {/* Vessel Details */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 border-b pb-2">Vessel Details</h4>
                    
                    <FormInput
                      label="Vessel Name"
                      name={`service-${index}-vesselName`}
                      required
                      value={service.vesselName}
                      onChange={(e) => handleServiceChange(index, 'vesselName', e.target.value)}
                      onBlur={() => handleBlur(index, 'vesselName')}
                      placeholder="e.g., MV Atlantic Explorer"
                      error={touched[`service-${index}-vesselName`] ? errors[`service-${index}-vesselName`] : ''}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormSelect
                        label="Vessel Type"
                        name={`service-${index}-vesselType`}
                        required
                        value={service.vesselType}
                        onChange={(e) => handleServiceChange(index, 'vesselType', e.target.value)}
                        onBlur={() => handleBlur(index, 'vesselType')}
                        options={VESSEL_TYPE_OPTIONS}
                        error={touched[`service-${index}-vesselType`] ? errors[`service-${index}-vesselType`] : ''}
                      />

                      <FormInput
                        label="Flag"
                        name={`service-${index}-flag`}
                        required
                        value={service.flag}
                        onChange={(e) => handleServiceChange(index, 'flag', e.target.value)}
                        onBlur={() => handleBlur(index, 'flag')}
                        placeholder="e.g., Panama, Liberia, Marshall Islands"
                        error={touched[`service-${index}-flag`] ? errors[`service-${index}-flag`] : ''}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="GRT (Gross Registered Tonnage)"
                        name={`service-${index}-grt`}
                        required
                        type="number"
                        value={service.grt}
                        onChange={(e) => handleServiceChange(index, 'grt', e.target.value)}
                        onBlur={() => handleBlur(index, 'grt')}
                        placeholder="e.g., 45000"
                        helpText="Vessel size in GRT"
                        error={touched[`service-${index}-grt`] ? errors[`service-${index}-grt`] : ''}
                      />

                      <FormInput
                        label="DWT (Deadweight Tonnage)"
                        name={`service-${index}-dwt`}
                        type="number"
                        value={service.dwt}
                        onChange={(e) => handleServiceChange(index, 'dwt', e.target.value)}
                        placeholder="e.g., 75000"
                        helpText="Optional"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormSelect
                        label="Main Engine Type"
                        name={`service-${index}-mainEngine`}
                        required
                        value={service.mainEngine}
                        onChange={(e) => handleServiceChange(index, 'mainEngine', e.target.value)}
                        onBlur={() => handleBlur(index, 'mainEngine')}
                        options={ENGINE_TYPE_OPTIONS}
                        error={touched[`service-${index}-mainEngine`] ? errors[`service-${index}-mainEngine`] : ''}
                      />

                      <FormInput
                        label="Engine Power (kW)"
                        name={`service-${index}-engineKw`}
                        type="number"
                        value={service.engineKw}
                        onChange={(e) => handleServiceChange(index, 'engineKw', e.target.value)}
                        placeholder="e.g., 15000"
                        helpText="Main engine power"
                      />
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 border-b pb-2">Employment Details</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Rank Held"
                        name={`service-${index}-rankHeld`}
                        required
                        value={service.rankHeld}
                        onChange={(e) => handleServiceChange(index, 'rankHeld', e.target.value)}
                        onBlur={() => handleBlur(index, 'rankHeld')}
                        placeholder="e.g., Chief Officer, 2nd Engineer"
                        error={touched[`service-${index}-rankHeld`] ? errors[`service-${index}-rankHeld`] : ''}
                      />

                      <FormInput
                        label="Company / Manning Agent"
                        name={`service-${index}-companyName`}
                        required
                        value={service.companyName}
                        onChange={(e) => handleServiceChange(index, 'companyName', e.target.value)}
                        onBlur={() => handleBlur(index, 'companyName')}
                        placeholder="e.g., Maersk, V.Ships"
                        error={touched[`service-${index}-companyName`] ? errors[`service-${index}-companyName`] : ''}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormDatePicker
                        label="Sign On Date"
                        name={`service-${index}-signOnDate`}
                        required
                        value={service.signOnDate}
                        onChange={(e) => handleServiceChange(index, 'signOnDate', e.target.value)}
                        onBlur={() => handleBlur(index, 'signOnDate')}
                        max={new Date().toISOString().split('T')[0]}
                        error={touched[`service-${index}-signOnDate`] ? errors[`service-${index}-signOnDate`] : ''}
                      />

                      <FormDatePicker
                        label="Sign Off Date"
                        name={`service-${index}-signOffDate`}
                        required
                        value={service.signOffDate}
                        onChange={(e) => handleServiceChange(index, 'signOffDate', e.target.value)}
                        onBlur={() => handleBlur(index, 'signOffDate')}
                        min={service.signOnDate}
                        max={new Date().toISOString().split('T')[0]}
                        helpText="Must be after sign on date"
                        error={touched[`service-${index}-signOffDate`] ? errors[`service-${index}-signOffDate`] : ''}
                      />
                    </div>

                    <FormSelect
                      label="Trade Route"
                      name={`service-${index}-tradeRoute`}
                      required
                      value={service.tradeRoute}
                      onChange={(e) => handleServiceChange(index, 'tradeRoute', e.target.value)}
                      onBlur={() => handleBlur(index, 'tradeRoute')}
                      options={TRADE_ROUTE_OPTIONS}
                      error={touched[`service-${index}-tradeRoute`] ? errors[`service-${index}-tradeRoute`] : ''}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for Leaving
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <textarea
                        name={`service-${index}-reasonForLeaving`}
                        value={service.reasonForLeaving}
                        onChange={(e) => handleServiceChange(index, 'reasonForLeaving', e.target.value)}
                        onBlur={() => handleBlur(index, 'reasonForLeaving')}
                        rows={2}
                        required
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          touched[`service-${index}-reasonForLeaving`] && errors[`service-${index}-reasonForLeaving`]
                            ? 'border-red-500'
                            : 'border-gray-300'
                        }`}
                        placeholder="e.g., End of contract, Promotion, Career advancement"
                      />
                      {touched[`service-${index}-reasonForLeaving`] && errors[`service-${index}-reasonForLeaving`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`service-${index}-reasonForLeaving`]}</p>
                      )}
                      <p className="mt-1 text-sm text-gray-500">
                        Brief explanation for leaving this position
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddService}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Sea Service Record</span>
            </button>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1 a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Important Information
            </h3>
            <p className="text-sm text-blue-800">
              List your sea service in reverse chronological order (most recent first). Include all vessels you have served on, even short-term assignments. Accurate sea service records are essential for career progression and certificate upgrades. You will need to provide discharge books and sea service testimonials during verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}