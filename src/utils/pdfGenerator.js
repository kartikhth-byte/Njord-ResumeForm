import jsPDF from 'jspdf'
import 'jspdf-autotable'

export const generateApplicationPDF = async (application, applicationData) => {
  const doc = new jsPDF()
  
  // Set default font
  doc.setFont('helvetica')
  
  // Header
  doc.setFontSize(20)
  doc.setTextColor(31, 41, 55)
  doc.text('Seafarer Application Form', 105, 20, { align: 'center' })
  
  // Application ID and Date
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`Application ID: #${application.id.slice(0, 8).toUpperCase()}`, 105, 28, { align: 'center' })
  doc.text(`Submitted: ${new Date(application.submitted_at).toLocaleDateString()}`, 105, 33, { align: 'center' })
  
  let yPosition = 45

  // Helper function to render text with wrapping
  const renderTextWithWrap = (text, x, y, maxWidth = 180) => {
    const lines = doc.splitTextToSize(String(text), maxWidth)
    const lineHeight = 5
    const totalHeight = lines.length * lineHeight
    
    if (y + totalHeight > 280) {
      doc.addPage()
      y = 20
    }
    
    lines.forEach((line, index) => {
      doc.text(line, x, y + (index * lineHeight))
    })
    
    return y + totalHeight + 2
  }

  // Helper function to add section
  const addSection = (title, data) => {
    // Skip if data is missing or empty
    if (!data) return
    if (Array.isArray(data) && data.length === 0) return
    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) return

    // Page break for title
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }

    // Section title
    doc.setFontSize(14)
    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, yPosition)
    yPosition += 7

    // Section data
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)

    if (Array.isArray(data)) {
      // HANDLE ARRAYS (Education, Sea Service, etc.)
      data.forEach((item, index) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 20
        }
        
        doc.setFont('helvetica', 'bold')
        doc.text(`${index + 1}.`, 14, yPosition)
        doc.setFont('helvetica', 'normal')
        yPosition += 5

        Object.entries(item).forEach(([key, value]) => {
          if (value && typeof value !== 'object') {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
            const fullText = `   ${label}: ${value}`
            yPosition = renderTextWithWrap(fullText, 14, yPosition, 180)
          }
        })
        yPosition += 2
      })
    } else if (typeof data === 'object') {
      // HANDLE OBJECTS (Personal Details, etc.)
      Object.entries(data).forEach(([key, value]) => {
        if (value && typeof value !== 'object' && !Array.isArray(value)) {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
          
          if (typeof value === 'boolean') {
            value = value ? 'Yes' : 'No'
          }
          
          const fullText = `${label}: ${value}`
          yPosition = renderTextWithWrap(fullText, 14, yPosition, 180)
        }
      })
    }
    yPosition += 6
  }

  // --- SECTION MAPPING ---
  // Note: We access specific properties (e.g. .education) for array sections

  addSection('Availability & Application Details', applicationData.section1)
  addSection('Personal & Contact Details', applicationData.section2)
  addSection('Passport Details', applicationData.section3)
  addSection('CDC / National Seaman\'s Book', applicationData.section4) // ✅ Fixed Syntax

  if (applicationData.section5?.visas) {
    addSection('Visas', applicationData.section5.visas)
  }

  // ✅ FIX: Pass the .education array, not the section object
  if (applicationData.section6?.education) {
    addSection('Education Background', applicationData.section6.education)
  }

  if (applicationData.section7?.dependents) {
    addSection('Dependents', applicationData.section7.dependents)
  }

  // ✅ FIX: Pass the .certificates array
  if (applicationData.section8?.certificates) {
    addSection('National Certificates of Competency', applicationData.section8.certificates)
  }

  if (applicationData.section9?.gmdss) {
    addSection('GMDSS Certificates', applicationData.section9.gmdss)
  }

  // ✅ FIX: Pass the .medicalFitness array
  if (applicationData.section10?.medicalFitness) {
    addSection('Medical Fitness & Vaccination', applicationData.section10.medicalFitness)
  }

  // ✅ FIX: Pass the .medicalHistory object inside the section
  if (applicationData.section11?.medicalHistory) {
    addSection('Medical History', applicationData.section11.medicalHistory)
  }

  if (applicationData.section12?.languages) {
    addSection('Foreign Languages', applicationData.section12.languages)
  }

  addSection('Physical & Uniform Details', applicationData.section13)

  // ✅ FIX: Pass the .courses array
  if (applicationData.section14?.courses) {
    addSection('STCW Courses & Competencies', applicationData.section14.courses)
  }

  if (applicationData.section15?.endorsements) {
    addSection('Flag State Endorsements', applicationData.section15.endorsements)
  }

  // ✅ FIX: Pass the .seaService array
  if (applicationData.section16?.seaService) {
    addSection('Sea Service / Employment History', applicationData.section16.seaService)
  }

  if (applicationData.section17?.skills) {
    addSection('Technical Experience & Skills', applicationData.section17.skills)
  }

  if (applicationData.section18) {
    addSection('Professional References', applicationData.section18)
  }

  if (applicationData.section19) {
    addSection('Additional Information & Declarations', applicationData.section19)
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' })
  }

  // Generate Filename & Save
  const applicantName = applicationData.section2?.firstName 
    ? `${applicationData.section2.firstName}_${applicationData.section2.surname || 'Application'}`
    : 'Application'
  
  const filename = `${applicantName.replace(/\s+/g, '_')}_${application.id.slice(0, 8)}.pdf`
  
  doc.save(filename) // ✅ Added Save Action
}
