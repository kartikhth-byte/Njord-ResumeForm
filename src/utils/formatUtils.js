// formatUtils.js
// Utility functions for formatting display values

/**
 * Converts snake_case to Title Case
 * Examples:
 *   chief_officer → Chief Officer
 *   bulk_carrier → Bulk Carrier
 *   able_seaman → Able Seaman
 *   lng_lpg_tanker → LNG/LPG Tanker
 */
export const formatDisplayValue = (value) => {
  if (!value) return ''
  
  // Handle special cases first
  const specialCases = {
    'lng_lpg_tanker': 'LNG/LPG Tanker',
    'lng_tanker': 'LNG Tanker',
    'lpg_tanker': 'LPG Tanker',
    'ro_ro_vessel': 'Ro-Ro Vessel',
    'ahts_vessel': 'AHTS Vessel',
    'psv_vessel': 'PSV Vessel',
    'fsrv_vessel': 'FSRV Vessel',
    'fpso_vessel': 'FPSO Vessel',
    'mpsv_vessel': 'MPSV Vessel',
    'osv_vessel': 'OSV Vessel',
    'dp_vessel': 'DP Vessel',
    'imo_type': 'IMO Type',
  }

  // Check if it's a special case
  const lowerValue = value.toLowerCase()
  if (specialCases[lowerValue]) {
    return specialCases[lowerValue]
  }

  // Standard conversion: snake_case to Title Case
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Format rank for display
 */
export const formatRank = (rank) => {
  return formatDisplayValue(rank)
}

/**
 * Format vessel type for display
 */
export const formatVesselType = (vesselType) => {
  return formatDisplayValue(vesselType)
}

/**
 * Format any field value for display
 * Handles null/undefined gracefully
 */
export const formatField = (value, defaultText = 'Not specified') => {
  if (!value || value === '') return defaultText
  return formatDisplayValue(value)
}