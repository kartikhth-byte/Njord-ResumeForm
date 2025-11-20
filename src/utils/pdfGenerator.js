import jsPDF from 'jspdf'
import 'jspdf-autotable'

export const generateApplicationPDF = async (application, applicationData) => {
  const doc = new jsPDF()
  
  // Set default font
  doc.setFont('helvetica')
  
  // Header
  doc.setFontSize(20)
  doc.setTextColor(31, 41, 55) // gray-800
  doc.text('Seafarer Application Form', 105, 20, { align: 'center' })
  
  // Application ID and Date
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128) // gray-500
  doc.text(`Application ID: #${application.id.slice(0, 8).toUpperCase()}`, 105, 28, { align: 'center' })
  doc.text(`Submitted: ${new Date(application.submitted_at).toLocaleDateString()}`, 105, 33, { align: 'center' })
  
  let yPosition = 45

  // Helper function to add section
  const addSection = (title, data) => {
    // Check if we need a new page
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
      // For array data (like visas, certificates)
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
            doc.text(`   ${label}: ${value}`, 14, yPosition)
            yPosition += 5
          }
        })
        yPosition += 3
      })
    } else if (typeof data === 'object') {
      // For object data
      Object.entries(data).forEach(([key, value]) => {
        if (yPosition > 280) {
          doc.addPage()
          yPosition = 20
        }

        if (value && typeof value !== 'object' && !Array.isArray(value)) {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
          
          // Handle boolean values
          if (typeof value === 'boolean') {
            value = value ? 'Yes' : 'No'
          }
          
          doc.text(`${label}: ${value}`, 14, yPosition)
          yPosition += 5
        }
      })
    }

    yPosition += 8
  }

  // Section 1: Application Details
  if (applicationData.section1) {
    addSection('Section 1: Availability & Application Details', applicationData.section1)
  }

  // Section 2: Personal Details
  if (applicationData.section2) {
    addSection('Section 2: Personal & Contact Details', applicationData.section2)
  }

  // Section 3: Passport
  if (applicationData.section3) {
    addSection('Section 3: Passport Details', applicationData.section3)
  }

  // Section 4: CDC
  if (applicationData.section4) {
    addSection('Section 4: CDC / Seaman\'s Book', applicationData.section4)
  }

  // Section 5: Visas
  if (applicationData.section5?.visas?.length > 0) {
    addSection('Section 5: Visas', applicationData.section5.visas)
  }

  // Section 6: Education
  if (applicationData.section6?.education?.length > 0) {
    addSection('Section 6: Education Background', applicationData.section6.education)
  }

  // Section 7: Dependents
  if (applicationData.section7?.dependents?.length > 0) {
    addSection('Section 7: Dependents', applicationData.section7.dependents)
  }

  // Section 8: Certificates
  if (applicationData.section8?.certificates?.length > 0) {
    addSection('Section 8: Certificates of Competency', applicationData.section8.certificates)
  }

  // Section 9: GMDSS
  if (applicationData.section9?.gmdss?.length > 0) {
    addSection('Section 9: GMDSS Certificates', applicationData.section9.gmdss)
  }

  // Section 10: Medical
  if (applicationData.section10?.medicalFitness?.length > 0) {
    addSection('Section 10: Medical Fitness', applicationData.section10.medicalFitness)
  }

  // Section 11: Medical History
  if (applicationData.section11?.medicalHistory) {
    addSection('Section 11: Medical History', applicationData.section11.medicalHistory)
  }

  // Section 12: Languages
  if (applicationData.section12?.languages?.length > 0) {
    addSection('Section 12: Foreign Languages', applicationData.section12.languages)
  }

  // Section 13: Physical Details
  if (applicationData.section13) {
    addSection('Section 13: Physical & Uniform Details', applicationData.section13)
  }

  // Section 14: STCW Courses
  if (applicationData.section14?.courses?.length > 0) {
    addSection('Section 14: STCW Courses', applicationData.section14.courses)
  }

  // Section 15: Flag State Endorsements
  if (applicationData.section15?.endorsements?.length > 0) {
    addSection('Section 15: Flag State Endorsements', applicationData.section15.endorsements)
  }

  // Section 16: Sea Service
  if (applicationData.section16?.seaService?.length > 0) {
    addSection('Section 16: Sea Service / Employment History', applicationData.section16.seaService)
  }

  // Section 18: References
  if (applicationData.section18?.references?.length > 0) {
    addSection('Section 18: Professional References', applicationData.section18.references)
  }

  // Section 19: Emergency Contacts
  if (applicationData.section19?.contacts?.length > 0) {
    addSection('Section 19: Emergency Contact Information', applicationData.section19.contacts)
  }

  // Section 20: Declarations
  if (applicationData.section20) {
    addSection('Section 20: Declarations & Signature', {
      'Accuracy Declaration': applicationData.section20.accuracyDeclaration ? 'Accepted' : 'Not Accepted',
      'Background Check Consent': applicationData.section20.backgroundCheckConsent ? 'Accepted' : 'Not Accepted',
      'Data Processing Consent': applicationData.section20.dataProcessingConsent ? 'Accepted' : 'Not Accepted',
      'Signature Name': applicationData.section20.fullName,
      'Signature Date': applicationData.section20.signatureDate,
      'Place of Signing': applicationData.section20.placeOfSigning,
    })
  }

  // Footer on last page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text(
      `Page ${i} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
    doc.text(
      'This is a computer-generated document',
      105,
      285,
      { align: 'center' }
    )
  }

  // Generate filename
  const applicantName = applicationData.section2?.firstName 
    ? `${applicationData.section2.firstName}_${applicationData.section2.lastName || ''}`
    : 'Application'
  
  const filename = `${applicantName.replace(/\s+/g, '_')}_${application.id.slice(0, 8)}.pdf`

  // Save the PDF
  doc.save(filename)
}