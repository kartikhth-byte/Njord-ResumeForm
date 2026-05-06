// supabase/functions/extract-document-expiries/index.ts
// CORRECTED VERSION - Matches actual application data structure

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

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
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
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

    console.log('Extracting documents from application:', applicationId)

    // ========================================================================
    // SECTION 3: PASSPORT
    // ========================================================================
    if (appData.section3?.passport?.expiryDate) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'passport',
        document_name: 'Passport',
        section_number: 3,
        expiry_date: appData.section3.passport.expiryDate,
        issuing_authority: null,
        certificate_number: appData.section3.passport.number || null,
        place_of_issue: appData.section3.passport.placeOfIssue || null
      })
    }

    // ========================================================================
    // SECTION 3: SEAMAN'S BOOK (CDC)
    // ========================================================================
    if (appData.section3?.seamanBook?.expiryDate) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'seaman_book',
        document_name: 'Seaman\'s Book (CDC)',
        section_number: 3,
        expiry_date: appData.section3.seamanBook.expiryDate,
        issuing_authority: null,
        certificate_number: appData.section3.seamanBook.number || null,
        place_of_issue: appData.section3.seamanBook.placeOfIssue || null
      })
    }

    // ========================================================================
    // SECTION 5: CERTIFICATE OF COMPETENCY (CoC)
    // ========================================================================
    if (appData.section5?.cocExpiryDate) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'coc',
        document_name: `Certificate of Competency - ${appData.section5.cocRank || 'Unknown'}`,
        section_number: 5,
        expiry_date: appData.section5.cocExpiryDate,
        issuing_authority: appData.section5.cocIssuingAuthority || null,
        certificate_number: appData.section5.cocNumber || null,
        place_of_issue: null
      })
    }

    // ========================================================================
    // SECTION 10: MEDICAL CERTIFICATES & STCW COURSES
    // ========================================================================
    
    // Medical First Aid
    if (appData.section10?.medicalFirstAid?.expiryDate) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'medical',
        document_name: 'Medical First Aid Certificate',
        section_number: 10,
        expiry_date: appData.section10.medicalFirstAid.expiryDate,
        issuing_authority: null,
        certificate_number: appData.section10.medicalFirstAid.certificateNumber || null,
        place_of_issue: null
      })
    }

    // STCW Basic Safety
    if (appData.section10?.stcwBasicSafety?.expiryDate) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'course',
        document_name: 'STCW Basic Safety Training',
        section_number: 10,
        expiry_date: appData.section10.stcwBasicSafety.expiryDate,
        issuing_authority: null,
        certificate_number: appData.section10.stcwBasicSafety.certificateNumber || null,
        place_of_issue: null
      })
    }

    // Advanced Fire Fighting
    if (appData.section10?.advancedFireFighting?.expiryDate) {
      documents.push({
        application_id: applicationId,
        user_id: userId,
        document_type: 'course',
        document_name: 'Advanced Fire Fighting Certificate',
        section_number: 10,
        expiry_date: appData.section10.advancedFireFighting.expiryDate,
        issuing_authority: null,
        certificate_number: appData.section10.advancedFireFighting.certificateNumber || null,
        place_of_issue: null
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

      console.log(`✅ Extracted ${documents.length} documents with expiry dates`)
    } else {
      console.log('⚠️ No documents with expiry dates found')
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