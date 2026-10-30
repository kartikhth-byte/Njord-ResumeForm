/* eslint-disable no-unused-vars, no-case-declarations */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const VESSEL_TYPE_OPTIONS = [
  { value: 'PC', label: 'PC' },
  { value: 'GC', label: 'GC' },
  { value: 'BC', label: 'BC' },
  { value: 'LNG', label: 'LNG' },
  { value: 'LPG', label: 'LPG' },
  { value: 'Chem', label: 'Chem' },
  { value: 'RoRo', label: 'RoRo' },
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

const ENGINE_FAMILY_OPTIONS = [
  { value: 'Sulzer RTA', label: 'Sulzer RTA' },
  { value: 'Sulzer RND', label: 'Sulzer RND' },
  { value: 'B & W', label: 'B & W' },
  { value: 'MAN', label: 'MAN' },
  { value: 'SEMT Pielstick', label: 'SEMT Pielstick' },
  { value: 'Steam Turbine', label: 'Steam Turbine' },
  { value: 'Others', label: 'Others' },
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

const REASON_FOR_LEAVING_OPTIONS = [
  { value: 'MR', label: 'MR' },
  { value: 'VS', label: 'VS' },
  { value: 'EOC', label: 'EOC' },
]

const emptySeaService = {
  vesselName: '',
  vesselType: '',
  flag: '',
  grt: '',
  dwt: '',
  teu: '',
  yearBuilt: '',
  mainEngine: '',
  engineFamily: '',
  mainEngineMake: '',
  engineKw: '',
  rankHeld: '',
  position: '',
  company: '',
  manning: '',
  companyName: '',
  signOnDate: '',
  signOffDate: '',
  tradingArea: '',
  tradeRoute: '',
  totalMmDd: '',
  reasonForLeaving: '',
}

export default function Section16({ data = {}, onUpdate }) {
  const [seaService, setSeaService] = useState(data.seaService || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Array.isArray(data.seaService)) {
      setSeaService(prevSeaService => (
        data.seaService.length === 0 && prevSeaService.length > 0 ? prevSeaService : data.seaService
      ))
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
      case 'teu':
        if (!value) return 'TEU is required'
        if (parseInt(value) < 0) return 'TEU must be positive'
        return ''
      case 'yearBuilt':
        if (!value) return 'Year built is required'
        if (!/^\d{4}$/.test(value)) return 'Year built must be 4 digits'
        if (parseInt(value, 10) < 1900 || parseInt(value, 10) > 2100) return 'Year built must be between 1900 and 2100'
        return ''
      case 'mainEngine':
        return !value ? 'Main engine type is required' : ''
      case 'engineFamily':
        return !value ? 'Engine family is required' : ''
      case 'mainEngineMake':
        return !value ? 'Main engine make is required' : ''
      case 'rankHeld':
        return !value ? 'Rank held is required' : ''
      case 'position':
        return !value ? 'Position is required' : ''
      case 'company':
        return !value ? 'Company is required' : ''
      case 'manning':
        return !value ? 'Manning is required' : ''
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
      case 'tradingArea':
        return !value ? 'Trading area is required' : ''
      case 'totalMmDd':
        return !value ? 'Total mm/dd is required' : ''
      case 'reasonForLeaving':
        return !value ? 'Reason for leaving is required' : ''
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
    const legacyCompanyValue = field === 'company' ? { companyName: value } : {}
    newSeaService[index] = {
      ...newSeaService[index],
      ...legacyCompanyValue,
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
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Sea service and employment history</h2>
      </div>

      {/* Total Service Summary */}
      {seaService.length > 0 && totalService.totalDays > 0 && (
        <div className="applicant-summary-banner">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="applicant-summary-banner__label">Total sea service</p>
              <p className="applicant-summary-banner__value mt-1">
                {totalService.years > 0 && `${totalService.years} ${totalService.years === 1 ? 'year' : 'years'} `}
                {totalService.months > 0 && `${totalService.months} ${totalService.months === 1 ? 'month' : 'months'} `}
                {totalService.days > 0 && `${totalService.days} ${totalService.days === 1 ? 'day' : 'days'}`}
              </p>
              <p className="text-sm text-accent-text mt-1">
                Approximately {totalService.totalDays} days total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sea Service List */}
      <div className="space-y-6">
        {seaService.length === 0 ? (
          <div className="applicant-empty-state">
            <svg
              className="w-12 h-12 text-fg-muted mx-auto mb-4"
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
            <p className="text-fg-secondary mb-2">No sea service records added yet</p>
            <button
              onClick={handleAddService}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add Sea Service Record
            </button>
          </div>
        ) : (
          <>
            {seaService.map((service, index) => (
              <div key={index} className="applicant-record-card">
                {/* Service Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">
                      Vessel {index + 1}
                      {service.vesselName && ` - ${service.vesselName}`}
                    </h3>
                    {service.signOnDate && service.signOffDate && (
                      <p className="applicant-record-card__subtitle">
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
                    className="applicant-action applicant-action--secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Service Fields */}
                <div className="space-y-4">
                  {/* Vessel Details */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-fg-secondary border-b pb-2">Vessel Details</h4>
                    
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
                      <FormInput
                        label="TEU"
                        name={`service-${index}-teu`}
                        required
                        type="number"
                        value={service.teu || ''}
                        onChange={(e) => handleServiceChange(index, 'teu', e.target.value)}
                        onBlur={() => handleBlur(index, 'teu')}
                        placeholder="e.g., 4500"
                        error={touched[`service-${index}-teu`] ? errors[`service-${index}-teu`] : ''}
                      />

                      <FormInput
                        label="Year Built"
                        name={`service-${index}-yearBuilt`}
                        required
                        value={service.yearBuilt || ''}
                        onChange={(e) => handleServiceChange(index, 'yearBuilt', e.target.value)}
                        onBlur={() => handleBlur(index, 'yearBuilt')}
                        placeholder="e.g., 2018"
                        error={touched[`service-${index}-yearBuilt`] ? errors[`service-${index}-yearBuilt`] : ''}
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

                      <FormSelect
                        label="Engine Family"
                        name={`service-${index}-engineFamily`}
                        required
                        value={service.engineFamily || ''}
                        onChange={(e) => handleServiceChange(index, 'engineFamily', e.target.value)}
                        onBlur={() => handleBlur(index, 'engineFamily')}
                        options={ENGINE_FAMILY_OPTIONS}
                        helpText="Normalized engine family for engineer experience reporting"
                        error={touched[`service-${index}-engineFamily`] ? errors[`service-${index}-engineFamily`] : ''}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Main Engine Make"
                        name={`service-${index}-mainEngineMake`}
                        required
                        value={service.mainEngineMake || ''}
                        onChange={(e) => handleServiceChange(index, 'mainEngineMake', e.target.value)}
                        onBlur={() => handleBlur(index, 'mainEngineMake')}
                        placeholder="e.g., MAN B&W, Wartsila"
                        error={touched[`service-${index}-mainEngineMake`] ? errors[`service-${index}-mainEngineMake`] : ''}
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
                    <h4 className="text-md font-semibold text-fg-secondary border-b pb-2">Employment Details</h4>
                    
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
                        label="Position"
                        name={`service-${index}-position`}
                        required
                        value={service.position || ''}
                        onChange={(e) => handleServiceChange(index, 'position', e.target.value)}
                        onBlur={() => handleBlur(index, 'position')}
                        placeholder="e.g., Chief Officer"
                        error={touched[`service-${index}-position`] ? errors[`service-${index}-position`] : ''}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Company"
                        name={`service-${index}-company`}
                        required
                        value={service.company || service.companyName || ''}
                        onChange={(e) => handleServiceChange(index, 'company', e.target.value)}
                        onBlur={() => handleBlur(index, 'company')}
                        placeholder="e.g., Maersk Tankers"
                        error={touched[`service-${index}-company`] ? errors[`service-${index}-company`] : ''}
                      />

                      <FormInput
                        label="Manning"
                        name={`service-${index}-manning`}
                        required
                        value={service.manning || ''}
                        onChange={(e) => handleServiceChange(index, 'manning', e.target.value)}
                        onBlur={() => handleBlur(index, 'manning')}
                        placeholder="e.g., V.Ships, Anglo-Eastern"
                        error={touched[`service-${index}-manning`] ? errors[`service-${index}-manning`] : ''}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Trading Area"
                        name={`service-${index}-tradingArea`}
                        required
                        value={service.tradingArea || service.tradeRoute || ''}
                        onChange={(e) => handleServiceChange(index, 'tradingArea', e.target.value)}
                        onBlur={() => handleBlur(index, 'tradingArea')}
                        placeholder="e.g., Worldwide, Asia-Europe, Coastal India"
                        error={touched[`service-${index}-tradingArea`] ? errors[`service-${index}-tradingArea`] : ''}
                      />

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
                    </div>

                    <FormInput
                      label="Total mm/dd"
                      name={`service-${index}-totalMmDd`}
                      required
                      value={service.totalMmDd || ''}
                      onChange={(e) => handleServiceChange(index, 'totalMmDd', e.target.value)}
                      onBlur={() => handleBlur(index, 'totalMmDd')}
                      placeholder="e.g., 08/15"
                      helpText="Enter total contract period in months/days"
                      error={touched[`service-${index}-totalMmDd`] ? errors[`service-${index}-totalMmDd`] : ''}
                    />

                    <FormSelect
                      label="Reason for Leaving"
                      name={`service-${index}-reasonForLeaving`}
                      required
                      value={service.reasonForLeaving}
                      onChange={(e) => handleServiceChange(index, 'reasonForLeaving', e.target.value)}
                      onBlur={() => handleBlur(index, 'reasonForLeaving')}
                      options={REASON_FOR_LEAVING_OPTIONS}
                      helpText="MR = Medical Reason, VS = Vessel Sold, EOC = End of Contract"
                      error={touched[`service-${index}-reasonForLeaving`] ? errors[`service-${index}-reasonForLeaving`] : ''}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddService}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-line-input"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Sea Service Record</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
