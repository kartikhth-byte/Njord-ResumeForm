import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'

export default function Section17({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    // Navigation Equipment
    ecdis: data.ecdis || false,
    ecdisTypes: data.ecdisTypes || '',
    radar: data.radar || false,
    radarTypes: data.radarTypes || '',
    arpa: data.arpa || false,
    gps: data.gps || false,
    gyroCompass: data.gyroCompass || false,
    autopilot: data.autopilot || false,
    vhf: data.vhf || false,
    
    // Cargo Operations
    cargoComputers: data.cargoComputers || false,
    cargoComputerTypes: data.cargoComputerTypes || '',
    loadmaster: data.loadmaster || false,
    loadmasterTypes: data.loadmasterTypes || '',
    inertGasSystem: data.inertGasSystem || false,
    cargoPumps: data.cargoPumps || false,
    ballastSystem: data.ballastSystem || false,
    
    // Engine Room Equipment
    mainEngineExperience: data.mainEngineExperience || '',
    auxiliaryEngineExperience: data.auxiliaryEngineExperience || '',
    boilerExperience: data.boilerExperience || false,
    purifierExperience: data.purifierExperience || false,
    compressorExperience: data.compressorExperience || false,
    refrigerationExperience: data.refrigerationExperience || false,
    pneumaticControls: data.pneumaticControls || false,
    hydraulicSystems: data.hydraulicSystems || false,
    
    // Electrical Systems
    electricalExperience: data.electricalExperience || false,
    electricalVoltage: data.electricalVoltage || '',
    generatorExperience: data.generatorExperience || false,
    highVoltageExperience: data.highVoltageExperience || false,
    plcExperience: data.plcExperience || false,
    
    // Software Skills
    msOffice: data.msOffice || false,
    msOfficeLevel: data.msOfficeLevel || '',
    maintenanceSoftware: data.maintenanceSoftware || false,
    maintenanceSoftwareTypes: data.maintenanceSoftwareTypes || '',
    weatherSoftware: data.weatherSoftware || false,
    weatherSoftwareTypes: data.weatherSoftwareTypes || '',
    
    // Special Skills
    welding: data.welding || false,
    weldingTypes: data.weldingTypes || '',
    rigging: data.rigging || false,
    craneOperation: data.craneOperation || false,
    craneTypes: data.craneTypes || '',
    rov: data.rov || false,
    dynamicPositioning: data.dynamicPositioning || false,
    dpLevel: data.dpLevel || '',
    
    // Additional Skills
    additionalSkills: data.additionalSkills || '',
  })

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        ecdis: data.ecdis || false,
        ecdisTypes: data.ecdisTypes || '',
        radar: data.radar || false,
        radarTypes: data.radarTypes || '',
        arpa: data.arpa || false,
        gps: data.gps || false,
        gyroCompass: data.gyroCompass || false,
        autopilot: data.autopilot || false,
        vhf: data.vhf || false,
        cargoComputers: data.cargoComputers || false,
        cargoComputerTypes: data.cargoComputerTypes || '',
        loadmaster: data.loadmaster || false,
        loadmasterTypes: data.loadmasterTypes || '',
        inertGasSystem: data.inertGasSystem || false,
        cargoPumps: data.cargoPumps || false,
        ballastSystem: data.ballastSystem || false,
        mainEngineExperience: data.mainEngineExperience || '',
        auxiliaryEngineExperience: data.auxiliaryEngineExperience || '',
        boilerExperience: data.boilerExperience || false,
        purifierExperience: data.purifierExperience || false,
        compressorExperience: data.compressorExperience || false,
        refrigerationExperience: data.refrigerationExperience || false,
        pneumaticControls: data.pneumaticControls || false,
        hydraulicSystems: data.hydraulicSystems || false,
        electricalExperience: data.electricalExperience || false,
        electricalVoltage: data.electricalVoltage || '',
        generatorExperience: data.generatorExperience || false,
        highVoltageExperience: data.highVoltageExperience || false,
        plcExperience: data.plcExperience || false,
        msOffice: data.msOffice || false,
        msOfficeLevel: data.msOfficeLevel || '',
        maintenanceSoftware: data.maintenanceSoftware || false,
        maintenanceSoftwareTypes: data.maintenanceSoftwareTypes || '',
        weatherSoftware: data.weatherSoftware || false,
        weatherSoftwareTypes: data.weatherSoftwareTypes || '',
        welding: data.welding || false,
        weldingTypes: data.weldingTypes || '',
        rigging: data.rigging || false,
        craneOperation: data.craneOperation || false,
        craneTypes: data.craneTypes || '',
        rov: data.rov || false,
        dynamicPositioning: data.dynamicPositioning || false,
        dpLevel: data.dpLevel || '',
        additionalSkills: data.additionalSkills || '',
      })
    }
  }, [data])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value
    
    const newFormData = {
      ...formData,
      [name]: fieldValue
    }
    
    setFormData(newFormData)
    onUpdate({ section17: newFormData })
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Section 17: Technical Experience & Skills</h2>
        <p className="text-gray-600 mt-1">
          Detail your technical skills, equipment experience, and specialized competencies
        </p>
      </div>

      <div className="space-y-8">
        {/* Navigation Equipment */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Navigation Equipment</h3>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="ecdis"
                name="ecdis"
                checked={formData.ecdis}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="ecdis" className="ml-3 block text-sm font-medium text-gray-700">
                ECDIS (Electronic Chart Display and Information System)
              </label>
            </div>
            {formData.ecdis && (
              <div className="ml-7">
                <FormInput
                  label="ECDIS Types/Makes"
                  name="ecdisTypes"
                  value={formData.ecdisTypes}
                  onChange={handleChange}
                  placeholder="e.g., Furuno, JRC, Transas, Wartsila"
                  helpText="List the ECDIS systems you have experience with"
                />
              </div>
            )}

            <div className="flex items-start">
              <input
                type="checkbox"
                id="radar"
                name="radar"
                checked={formData.radar}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="radar" className="ml-3 block text-sm font-medium text-gray-700">
                Radar Navigation
              </label>
            </div>
            {formData.radar && (
              <div className="ml-7">
                <FormInput
                  label="Radar Types/Makes"
                  name="radarTypes"
                  value={formData.radarTypes}
                  onChange={handleChange}
                  placeholder="e.g., Furuno, JRC, Kelvin Hughes"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="arpa"
                  name="arpa"
                  checked={formData.arpa}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="arpa" className="ml-3 block text-sm font-medium text-gray-700">
                  ARPA (Automatic Radar Plotting Aids)
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="gps"
                  name="gps"
                  checked={formData.gps}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="gps" className="ml-3 block text-sm font-medium text-gray-700">
                  GPS / GNSS
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="gyroCompass"
                  name="gyroCompass"
                  checked={formData.gyroCompass}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="gyroCompass" className="ml-3 block text-sm font-medium text-gray-700">
                  Gyro Compass
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="autopilot"
                  name="autopilot"
                  checked={formData.autopilot}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autopilot" className="ml-3 block text-sm font-medium text-gray-700">
                  Autopilot Systems
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="vhf"
                  name="vhf"
                  checked={formData.vhf}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="vhf" className="ml-3 block text-sm font-medium text-gray-700">
                  VHF / GMDSS Equipment
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Cargo Operations */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Cargo Operations</h3>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="cargoComputers"
                name="cargoComputers"
                checked={formData.cargoComputers}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="cargoComputers" className="ml-3 block text-sm font-medium text-gray-700">
                Cargo Computer Systems
              </label>
            </div>
            {formData.cargoComputers && (
              <div className="ml-7">
                <FormInput
                  label="Cargo Computer Types"
                  name="cargoComputerTypes"
                  value={formData.cargoComputerTypes}
                  onChange={handleChange}
                  placeholder="e.g., Navidec, MACS3, Loadstar"
                />
              </div>
            )}

            <div className="flex items-start">
              <input
                type="checkbox"
                id="loadmaster"
                name="loadmaster"
                checked={formData.loadmaster}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="loadmaster" className="ml-3 block text-sm font-medium text-gray-700">
                Loadmaster / Loading Instruments
              </label>
            </div>
            {formData.loadmaster && (
              <div className="ml-7">
                <FormInput
                  label="Loadmaster Types"
                  name="loadmasterTypes"
                  value={formData.loadmasterTypes}
                  onChange={handleChange}
                  placeholder="e.g., Draft Survey, Stability Computers"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="inertGasSystem"
                  name="inertGasSystem"
                  checked={formData.inertGasSystem}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="inertGasSystem" className="ml-3 block text-sm font-medium text-gray-700">
                  Inert Gas System (IGS)
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="cargoPumps"
                  name="cargoPumps"
                  checked={formData.cargoPumps}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="cargoPumps" className="ml-3 block text-sm font-medium text-gray-700">
                  Cargo Pump Operations
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="ballastSystem"
                  name="ballastSystem"
                  checked={formData.ballastSystem}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="ballastSystem" className="ml-3 block text-sm font-medium text-gray-700">
                  Ballast System Operations
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Engine Room Equipment */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Engine Room Equipment</h3>
          
          <div className="space-y-4">
            <FormInput
              label="Main Engine Experience"
              name="mainEngineExperience"
              value={formData.mainEngineExperience}
              onChange={handleChange}
              placeholder="e.g., MAN B&W, Wartsila, Sulzer"
              helpText="List main engine types and makes you have experience with"
            />

            <FormInput
              label="Auxiliary Engine Experience"
              name="auxiliaryEngineExperience"
              value={formData.auxiliaryEngineExperience}
              onChange={handleChange}
              placeholder="e.g., Caterpillar, Daihatsu, Yanmar"
              helpText="List auxiliary engine types you have worked on"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="boilerExperience"
                  name="boilerExperience"
                  checked={formData.boilerExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="boilerExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  Boiler Operations & Maintenance
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="purifierExperience"
                  name="purifierExperience"
                  checked={formData.purifierExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="purifierExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  Purifiers (Oil/Water)
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="compressorExperience"
                  name="compressorExperience"
                  checked={formData.compressorExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="compressorExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  Air Compressors
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="refrigerationExperience"
                  name="refrigerationExperience"
                  checked={formData.refrigerationExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="refrigerationExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  Refrigeration Systems
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="pneumaticControls"
                  name="pneumaticControls"
                  checked={formData.pneumaticControls}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="pneumaticControls" className="ml-3 block text-sm font-medium text-gray-700">
                  Pneumatic Control Systems
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="hydraulicSystems"
                  name="hydraulicSystems"
                  checked={formData.hydraulicSystems}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="hydraulicSystems" className="ml-3 block text-sm font-medium text-gray-700">
                  Hydraulic Systems
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Electrical Systems */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Electrical Systems</h3>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="electricalExperience"
                name="electricalExperience"
                checked={formData.electricalExperience}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="electricalExperience" className="ml-3 block text-sm font-medium text-gray-700">
                Electrical Systems Experience
              </label>
            </div>
            {formData.electricalExperience && (
              <div className="ml-7">
                <FormInput
                  label="Voltage Levels"
                  name="electricalVoltage"
                  value={formData.electricalVoltage}
                  onChange={handleChange}
                  placeholder="e.g., 440V, 6.6kV, 11kV"
                  helpText="Voltage levels you have worked with"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="generatorExperience"
                  name="generatorExperience"
                  checked={formData.generatorExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="generatorExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  Generator Operations & Maintenance
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="highVoltageExperience"
                  name="highVoltageExperience"
                  checked={formData.highVoltageExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="highVoltageExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  High Voltage Systems (above 1kV)
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="plcExperience"
                  name="plcExperience"
                  checked={formData.plcExperience}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="plcExperience" className="ml-3 block text-sm font-medium text-gray-700">
                  PLC (Programmable Logic Controller)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Software Skills */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Software & Computer Skills</h3>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="msOffice"
                name="msOffice"
                checked={formData.msOffice}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="msOffice" className="ml-3 block text-sm font-medium text-gray-700">
                Microsoft Office (Word, Excel, PowerPoint)
              </label>
            </div>
            {formData.msOffice && (
              <div className="ml-7">
                <FormInput
                  label="Proficiency Level"
                  name="msOfficeLevel"
                  value={formData.msOfficeLevel}
                  onChange={handleChange}
                  placeholder="e.g., Basic, Intermediate, Advanced"
                />
              </div>
            )}

            <div className="flex items-start">
              <input
                type="checkbox"
                id="maintenanceSoftware"
                name="maintenanceSoftware"
                checked={formData.maintenanceSoftware}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="maintenanceSoftware" className="ml-3 block text-sm font-medium text-gray-700">
                Maintenance Management Software
              </label>
            </div>
            {formData.maintenanceSoftware && (
              <div className="ml-7">
                <FormInput
                  label="Software Names"
                  name="maintenanceSoftwareTypes"
                  value={formData.maintenanceSoftwareTypes}
                  onChange={handleChange}
                  placeholder="e.g., AMOS, Danaos, Maximo, ShipServ"
                />
              </div>
            )}

            <div className="flex items-start">
              <input
                type="checkbox"
                id="weatherSoftware"
                name="weatherSoftware"
                checked={formData.weatherSoftware}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="weatherSoftware" className="ml-3 block text-sm font-medium text-gray-700">
                Weather Routing Software
              </label>
            </div>
            {formData.weatherSoftware && (
              <div className="ml-7">
                <FormInput
                  label="Software Names"
                  name="weatherSoftwareTypes"
                  value={formData.weatherSoftwareTypes}
                  onChange={handleChange}
                  placeholder="e.g., Bon Voyage, SeaWeather, SPOS"
                />
              </div>
            )}
          </div>
        </div>

        {/* Special Skills */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Special Skills & Qualifications</h3>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="welding"
                name="welding"
                checked={formData.welding}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="welding" className="ml-3 block text-sm font-medium text-gray-700">
                Welding
              </label>
            </div>
            {formData.welding && (
              <div className="ml-7">
                <FormInput
                  label="Welding Types"
                  name="weldingTypes"
                  value={formData.weldingTypes}
                  onChange={handleChange}
                  placeholder="e.g., Arc, MIG, TIG, Gas"
                />
              </div>
            )}

            <div className="flex items-start">
              <input
                type="checkbox"
                id="craneOperation"
                name="craneOperation"
                checked={formData.craneOperation}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="craneOperation" className="ml-3 block text-sm font-medium text-gray-700">
                Crane Operation
              </label>
            </div>
            {formData.craneOperation && (
              <div className="ml-7">
                <FormInput
                  label="Crane Types"
                  name="craneTypes"
                  value={formData.craneTypes}
                  onChange={handleChange}
                  placeholder="e.g., Ship Crane, Offshore Crane, Gantry Crane"
                />
              </div>
            )}

            <div className="flex items-start">
              <input
                type="checkbox"
                id="dynamicPositioning"
                name="dynamicPositioning"
                checked={formData.dynamicPositioning}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="dynamicPositioning" className="ml-3 block text-sm font-medium text-gray-700">
                Dynamic Positioning (DP)
              </label>
            </div>
            {formData.dynamicPositioning && (
              <div className="ml-7">
                <FormInput
                  label="DP Level/Certification"
                  name="dpLevel"
                  value={formData.dpLevel}
                  onChange={handleChange}
                  placeholder="e.g., DP Basic, DP Advanced, DP Unlimited"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="rigging"
                  name="rigging"
                  checked={formData.rigging}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="rigging" className="ml-3 block text-sm font-medium text-gray-700">
                  Rigging & Lifting Operations
                </label>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="rov"
                  name="rov"
                  checked={formData.rov}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="rov" className="ml-3 block text-sm font-medium text-gray-700">
                  ROV (Remotely Operated Vehicle)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Skills */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Additional Skills & Experience</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other Technical Skills or Experience
            </label>
            <textarea
              name="additionalSkills"
              value={formData.additionalSkills}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="List any other technical skills, certifications, or experience not covered above..."
            />
            <p className="mt-1 text-sm text-gray-500">
              Include any specialized training, unique equipment experience, or technical competencies
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Technical Skills Matter
            </h3>
            <p className="text-sm text-blue-800">
              Be thorough in listing your technical skills and equipment experience. Specific makes and models of equipment you have worked with can significantly enhance your application. Specialized skills like DP operations, high voltage systems, or specific cargo handling experience are highly valued by employers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}