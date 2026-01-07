// supabase/functions/extract-document-expiries/index.ts
// Extracts all document expiry dates from application data and stores them in document_expiries table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractionRequest {
  applicationId: string
}

interface DocumentExpiry {
  application_id: string
  user_id: string
  document_type: string
  document_name: string
  section_number: number
  expiry_date: string
  issuing_authority?: string
  certificate_number?: string
  place_of_issue?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { applicationId } = await req.json() as ExtractionRequest

    if (!applicationId) {
      throw new Error('applicationId is required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get application with data
    const { data: application, error: appError } = await supabaseClient
      .from('applications')
      .select('id, user_id, application_data(data)')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      throw new Error('Application not found')
    }

    const appData = application.application_data?.data || {}
    const userId = application.user_id
    const documents: DocumentExpiry[] = []

    // ========================================================================
    // SECTION 3: PASSPORT
    // ========================================================================
    if (appData.section3?.dateOfExpiry) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'passport',
        document_name: 'Passport',
        section_number: 3,
        expiry_date: appData.section3.dateOfExpiry,
        issuing_authority: appData.section3.issuingAuthority || null,
        certificate_number: appData.section3.passportNumber || null,
        place_of_issue: appData.section3.placeOfIssue || null
      })
    }

    // ========================================================================
    // SECTION 4: SEAMAN'S BOOK (CDC)
    // ========================================================================
    if (appData.section4?.dateOfExpiry) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'seaman_book',
        document_name: 'Seaman\'s Book (CDC)',
        section_number: 4,
        expiry_date: appData.section4.dateOfExpiry,
        issuing_authority: appData.section4.issuingAuthority || null,
        certificate_number: appData.section4.cdcNumber || null,
        place_of_issue: appData.section4.placeOfIssue || null
      })
    }

    // ========================================================================
    // SECTION 5: VISAS
    // ========================================================================
    if (appData.section5?.visas && Array.isArray(appData.section5.visas)) {
      appData.section5.visas.forEach((visa: any, index: number) => {
        if (visa.dateOfExpiry) {
          documents.push({
            application_id: applicationId,
            user_id: userId,
            document_type: 'visa',
            document_name: `${visa.country || 'Unknown'} Visa`,
            section_number: 5,
            expiry_date: visa.dateOfExpiry,
            issuing_authority: visa.issuingAuthority || null,
            certificate_number: visa.visaNumber || null,
            place_of_issue: visa.placeOfIssue || null
          })
        }
      })
    }

    // ========================================================================
    // SECTION 8: CERTIFICATES OF COMPETENCY (CoC)
    // ========================================================================
    if (appData.section8?.certificates && Array.isArray(appData.section8.certificates)) {
      appData.section8.certificates.forEach((cert: any, index: number) => {
        if (cert.dateOfExpiry) {
          documents.push({
            application_id: applicationId,
            user_id: userId,
            document_type: 'coc',
            document_name: `${cert.certificateType || 'CoC'} - ${cert.rank || 'Unknown'}`,
            section_number: 8,
            expiry_date: cert.dateOfExpiry,
            issuing_authority: cert.issuingAuthority || null,
            certificate_number: cert.certificateNumber || null,
            place_of_issue: cert.placeOfIssue || null
          })
        }
      })
    }

    // ========================================================================
    // SECTION 9: GMDSS CERTIFICATES
    // ========================================================================
    if (appData.section9?.gmdss && Array.isArray(appData.section9.gmdss)) {
      appData.section9.gmdss.forEach((cert: any, index: number) => {
        if (cert.dateOfExpiry) {
          documents.push({
            application_id: applicationId,
            user_id: userId,
            document_type: 'gmdss',
            document_name: `GMDSS - ${cert.certificateType || 'Certificate'}`,
            section_number: 9,
            expiry_date: cert.dateOfExpiry,
            issuing_authority: cert.issuingAuthority || null,
            certificate_number: cert.certificateNumber || null,
            place_of_issue: cert.placeOfIssue || null
          })
        }
      })
    }

    // ========================================================================
    // SECTION 10: MEDICAL CERTIFICATES
    // ========================================================================
    if (appData.section10?.medicals && Array.isArray(appData.section10.medicals)) {
      appData.section10.medicals.forEach((medical: any, index: number) => {
        if (medical.dateOfExpiry) {
          documents.push({
            application_id: applicationId,
            user_id: userId,
            document_type: 'medical',
            document_name: `Medical Certificate - ${medical.certificateType || 'Unknown'}`,
            section_number: 10,
            expiry_date: medical.dateOfExpiry,
            issuing_authority: medical.issuingAuthority || null,
            certificate_number: medical.certificateNumber || null,
            place_of_issue: medical.placeOfIssue || null
          })
        }
      })
    }

    // ========================================================================
    // SECTION 10: YELLOW FEVER VACCINATION
    // ========================================================================
    // Only add if NOT lifetime validity
    if (appData.section10?.vaccinations?.yellowFever) {
      const yellowFever = appData.section10.vaccinations.yellowFever
      
      // Check if it has lifetime validity flag (will be added in Section 10 update)
      const hasLifetimeValidity = yellowFever.lifetimeValidity === true
      
      if (!hasLifetimeValidity && yellowFever.dateOfExpiry) {
        documents.push({
          application_id: applicationId,
          user_id: userId,
          document_type: 'yellow_fever',
          document_name: 'Yellow Fever Vaccination',
          section_number: 10,
          expiry_date: yellowFever.dateOfExpiry,
          issuing_authority: yellowFever.issuingAuthority || null,
          certificate_number: yellowFever.certificateNumber || null,
          place_of_issue: yellowFever.placeOfIssue || null
        })
      }
    }

    // ========================================================================
    // SECTION 14: ADDITIONAL COURSES
    // ========================================================================
    if (appData.section14?.courses && Array.isArray(appData.section14.courses)) {
      appData.section14.courses.forEach((course: any, index: number) => {
        if (course.dateOfExpiry) {
          documents.push({
            application_id: applicationId,
            user_id: userId,
            document_type: 'course',
            document_name: `Course - ${course.courseName || 'Unknown'}`,
            section_number: 14,
            expiry_date: course.dateOfExpiry,
            issuing_authority: course.issuingAuthority || null,
            certificate_number: course.certificateNumber || null,
            place_of_issue: course.placeOfIssue || null
          })
        }
      })
    }

    // ========================================================================
    // SECTION 15: ENDORSEMENTS
    // ========================================================================
    if (appData.section15?.endorsements && Array.isArray(appData.section15.endorsements)) {
      appData.section15.endorsements.forEach((endorsement: any, index: number) => {
        if (endorsement.dateOfExpiry) {
          documents.push({
            application_id: applicationId,
            user_id: userId,
            document_type: 'endorsement',
            document_name: `${endorsement.flagState || 'Unknown'} Endorsement - ${endorsement.endorsementType || ''}`,
            section_number: 15,
            expiry_date: endorsement.dateOfExpiry,
            issuing_authority: endorsement.flagState || null,
            certificate_number: endorsement.endorsementNumber || null,
            place_of_issue: endorsement.placeOfIssue || null
          })
        }
      })
    }

    // ========================================================================
    // DELETE OLD RECORDS & INSERT NEW ONES
    // ========================================================================
    
    // Delete existing expiry records for this application
    const { error: deleteError } = await supabaseClient
      .from('document_expiries')
      .delete()
      .eq('application_id', applicationId)

    if (deleteError) {
      console.error('Error deleting old expiries:', deleteError)
    }

    // Insert new records
    if (documents.length > 0) {
      const { data: inserted, error: insertError } = await supabaseClient
        .from('document_expiries')
        .insert(documents)

      if (insertError) {
        console.error('Error inserting expiries:', insertError)
        throw insertError
      }

      console.log(`Extracted ${documents.length} documents with expiry dates`)
    } else {
      console.log('No documents with expiry dates found')
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentsExtracted: documents.length,
        documents: documents.map(d => ({
          type: d.document_type,
          name: d.document_name,
          expiryDate: d.expiry_date,
          section: d.section_number
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})