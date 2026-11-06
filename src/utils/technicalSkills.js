// Section 17 (technical experience) fields: [key, label, optional detail key].
export const TECHNICAL_SKILL_ROWS = [
  ['ecdis', 'ECDIS', 'ecdisTypes'],
  ['radar', 'Radar', 'radarTypes'],
  ['arpa', 'ARPA'],
  ['gps', 'GPS'],
  ['gyroCompass', 'Gyro compass'],
  ['autopilot', 'Autopilot'],
  ['vhf', 'VHF'],
  ['cargoComputers', 'Cargo computers', 'cargoComputerTypes'],
  ['loadmaster', 'Loadmaster', 'loadmasterTypes'],
  ['inertGasSystem', 'Inert gas system'],
  ['cargoPumps', 'Cargo pumps'],
  ['ballastSystem', 'Ballast system'],
  ['mainEngineExperience', 'Main engine'],
  ['auxiliaryEngineExperience', 'Auxiliary engine'],
  ['boilerExperience', 'Boiler'],
  ['purifierExperience', 'Purifier'],
  ['compressorExperience', 'Compressor'],
  ['refrigerationExperience', 'Refrigeration'],
  ['pneumaticControls', 'Pneumatic controls'],
  ['hydraulicSystems', 'Hydraulic systems'],
  ['electricalExperience', 'Electrical', 'electricalVoltage'],
  ['generatorExperience', 'Generator'],
  ['highVoltageExperience', 'High voltage'],
  ['plcExperience', 'PLC'],
  ['msOffice', 'MS Office', 'msOfficeLevel'],
  ['maintenanceSoftware', 'Maintenance software', 'maintenanceSoftwareTypes'],
  ['weatherSoftware', 'Weather software', 'weatherSoftwareTypes'],
  ['welding', 'Welding', 'weldingTypes'],
  ['rigging', 'Rigging'],
  ['craneOperation', 'Crane operation', 'craneTypes'],
  ['rov', 'ROV'],
  ['dynamicPositioning', 'Dynamic positioning', 'dpLevel'],
  ['additionalSkills', 'Additional skills'],
]

export function formatSkillValue(section, key, detailKey) {
  const value = section?.[key]
  const detail = detailKey ? section?.[detailKey] : null
  if (value === true) return detail ? `Yes — ${detail}` : 'Yes'
  if (typeof value === 'string' && value.trim()) return detail ? `${value} — ${detail}` : value
  return null
}

// "91" or "+91" -> "+91"
export function formatPhone(countryCode, number) {
  if (!number) return null
  const code = String(countryCode || '').replace(/^\++/, '')
  return code ? `+${code} ${number}` : String(number)
}
