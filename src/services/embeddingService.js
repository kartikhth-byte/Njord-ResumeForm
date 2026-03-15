// src/services/embeddingService.js
// UPDATED: Two-stage analysis with LLM reasoning and confidence scoring

import { supabase } from '../lib/supabase'

/**
 * Helper to normalize RPC response (maps text_content to chunk_text)
 */
function normalizeSearchResults(data) {
  if (!data) return []
  return data.map(item => ({
    ...item,
    chunk_text: item.text_content || item.chunk_text,
    // Keep both for compatibility
    text_content: item.text_content
  }))
}

function getApplicationSearchProfile(applicationData = {}) {
  const section1 = applicationData.section1 || {}
  const section2 = applicationData.section2 || {}
  const section8 = applicationData.section8 || {}
  const section10 = applicationData.section10 || {}
  const section14 = applicationData.section14 || {}
  const section15 = applicationData.section15 || {}
  const section16 = applicationData.section16 || {}

  return {
    desiredRank: section1.appliedForRank || '',
    vesselType: section1.vesselType || '',
    availableFrom: section1.availableFrom || '',
    certificates: Array.isArray(section8.certificates) ? section8.certificates : [],
    medicalFitness: Array.isArray(section10.medicalFitness) ? section10.medicalFitness : [],
    stcwCertificates: Array.isArray(section14.certificates) ? section14.certificates : [],
    endorsements: Array.isArray(section15.endorsements) ? section15.endorsements : [],
    seaService: Array.isArray(section16.seaService) ? section16.seaService : [],
    section2
  }
}


/**
 * Generate embedding for text using secure proxy
 */
export async function generateEmbedding(text) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-embedding-proxy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ text })
      }
    )

    if (!response.ok) {
      throw new Error(`Embedding generation failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Embedding generation failed')
    }
    
    return data.embedding
    
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}


/**
 * Analyze candidate with LLM reasoning (NEW - Two-stage analysis)
 */
async function analyzeWithLLM(query, application, matchedChunks) {
  try {
    // Build application context
    const appData = application.application_data?.data || {}
    const profile = getApplicationSearchProfile(appData)
    
    const applicationContext = `
Application ID: ${application.reference_number}
Candidate: ${profile.section2?.firstName} ${profile.section2?.surname}
Nationality: ${profile.section2?.nationality || 'Not specified'}
Date of Birth: ${profile.section2?.dateOfBirth || 'Not specified'}
Email: ${profile.section2?.email || 'Not specified'}
Phone: ${profile.section2?.phoneNumber || 'Not specified'}

Applied Rank: ${application.applied_rank || 'Not specified'}
Desired Rank: ${profile.desiredRank || 'Not specified'}
Type of Vessel: ${profile.vesselType || 'Not specified'}
Available From: ${profile.availableFrom || 'Not specified'}

Certificate of Competency:
${profile.certificates.map((certificate, i) => `
  ${i + 1}. ${certificate.grade || 'Not specified'}
     Number: ${certificate.certificateNumber || 'Not specified'}
     Issue Date: ${certificate.dateOfIssue || 'Not specified'}
     Expiry Date: ${certificate.dateOfExpiry || 'Not specified'}
`).join('\n') || 'No CoC data'}

Sea Service History:
${profile.seaService.map((service, i) => `
  ${i + 1}. ${service.vesselName || 'Unknown vessel'} (${service.vesselType || 'Unknown type'})
     Rank: ${service.rankHeld || 'Not specified'}
     Period: ${service.signOnDate || '?'} to ${service.signOffDate || '?'}
     Flag: ${service.flag || 'Not specified'}
`).join('\n') || 'No sea service data'}

STCW Certificates:
${profile.stcwCertificates.map((certificate, i) => `
  ${i + 1}. ${certificate.certificateName || certificate.courseName || 'Certificate'}
     Number: ${certificate.certificateNumber || 'Not specified'}
     Expiry: ${certificate.dateOfExpiry || 'Not specified'}
`).join('\n') || 'No STCW certificates listed'}

Visas/Endorsements:
${profile.endorsements.map((end, i) => `
  ${i + 1}. ${end.flagState || 'Unknown'} ${end.endorsementType || 'Endorsement'}
     Number: ${end.endorsementNumber || 'Not specified'}
     Expiry: ${end.dateOfExpiry || 'Not specified'}
`).join('\n') || 'No endorsements listed'}
`.trim()

    // Get past feedback for learning (TODO: implement feedback store)
    const pastFeedback = [] // Will be populated from feedback system

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-reasoning-proxy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          query,
          applicationContext,
          matchedChunks,
          pastFeedback
        })
      }
    )

    if (!response.ok) {
      console.error('LLM reasoning failed:', response.statusText)
      return {
        isMatch: null,
        reason: 'Unable to perform LLM analysis',
        confidence: 0.5,
        isUncertain: true
      }
    }

    const data = await response.json()
    
    return {
      isMatch: data.is_match,
      reason: data.reason,
      confidence: data.confidence,
      isUncertain: data.confidence < 0.7
    }

  } catch (error) {
    console.error('LLM analysis error:', error)
    return {
      isMatch: null,
      reason: 'LLM analysis unavailable',
      confidence: 0.5,
      isUncertain: true
    }
  }
}

/**
 * Parse compound queries (AND/OR logic)
 */
function parseCompoundQuery(query) {
  const queryLower = query.toLowerCase()
  
  // Check for AND logic
  if (queryLower.includes(' and ')) {
    const subQueries = query.split(/\s+and\s+/i).map(q => q.trim())
    return { isCompound: true, operator: 'AND', subQueries }
  }
  
  // Check for OR logic
  if (queryLower.includes(' or ')) {
    const subQueries = query.split(/\s+or\s+/i).map(q => q.trim())
    return { isCompound: true, operator: 'OR', subQueries }
  }
  
  return { isCompound: false, operator: null, subQueries: [query] }
}

/**
 * Search for a single sub-query
 */
async function searchSubQuery(subQuery, threshold = 0.3, limit = 30) {
  try {
    const embedding = await generateEmbedding(subQuery)
    
    // FIXED: Use correct RPC function name
    const { data, error } = await supabase.rpc('search_similar_applications', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_status: null,
      filter_position: null,
      filter_nationality: null,
      filter_vessel_type: null
    })

    if (error) throw error
        return normalizeSearchResults(data)  // ✅ ADD THIS
    
    // FIXED: Map text_content to chunk_text for consistency
//    return (data || []).map(item => ({
//      ...item,
//      chunk_text: item.text_content || item.chunk_text  // Fallback for compatibility
//    }))
    
  } catch (error) {
    console.error(`Error searching sub-query "${subQuery}":`, error)
    return []
  }
}

/**
 * Merge results from multiple sub-queries (IMPROVED from ai_analyzer.py)
 */
function mergeCompoundResults(operator, subQueryResults) {
  if (operator === 'AND') {
    // For AND: Only return applications that appear in ALL sub-query results
    // Group by application_id
    const applicationMatches = {}
    
    subQueryResults.forEach((results) => {
      results.forEach(match => {
        const appId = match.application_id
        if (!applicationMatches[appId]) {
          applicationMatches[appId] = {
            count: 0,
            matches: [],
            minSimilarity: 1.0
          }
        }
        applicationMatches[appId].count++
        applicationMatches[appId].matches.push(match)
        applicationMatches[appId].minSimilarity = Math.min(
          applicationMatches[appId].minSimilarity,
          match.similarity
        )
      })
    })
    
    // Filter: Keep only apps that matched ALL sub-queries
    const requiredMatches = subQueryResults.length
    const andResults = {}
    
    Object.entries(applicationMatches).forEach(([appId, data]) => {
      if (data.count >= requiredMatches) {
        // Use minimum similarity (weakest link)
        andResults[appId] = {
          matches: data.matches,
          combinedScore: data.minSimilarity
        }
      }
    })
    
    console.log(`[AND] ${Object.keys(andResults).length} apps matched all ${requiredMatches} conditions`)
    return andResults
    
  } else if (operator === 'OR') {
    // For OR: Return applications from ANY sub-query
    // Use maximum similarity (best match)
    const applicationMatches = {}
    
    subQueryResults.forEach((results) => {
      results.forEach(match => {
        const appId = match.application_id
        if (!applicationMatches[appId]) {
          applicationMatches[appId] = {
            matches: [],
            maxSimilarity: 0.0
          }
        }
        applicationMatches[appId].matches.push(match)
        applicationMatches[appId].maxSimilarity = Math.max(
          applicationMatches[appId].maxSimilarity,
          match.similarity
        )
      })
    })
    
    const orResults = {}
    Object.entries(applicationMatches).forEach(([appId, data]) => {
      orResults[appId] = {
        matches: data.matches,
        combinedScore: data.maxSimilarity
      }
    })
    
    console.log(`[OR] ${Object.keys(orResults).length} apps matched at least one condition`)
    return orResults
  }
  
  return {}
}

/**
 * Enhanced semantic search with compound query support and LLM reasoning
 * NEW: Two-stage analysis (vector search + LLM reasoning)
 */
export async function searchBySemanticSimilarity(query, threshold = 0.3, limit = 20, enableLLM = true) {
  try {
    console.log('[SEARCH] Query:', query)
    console.log('[SEARCH] LLM reasoning:', enableLLM ? 'ENABLED' : 'DISABLED')
    
    // Parse query for compound logic
    const { isCompound, operator, subQueries } = parseCompoundQuery(query)
    
    let candidates = {}
    
    if (isCompound) {
      console.log(`[COMPOUND] Detected ${operator} query with ${subQueries.length} conditions`)
      console.log('[COMPOUND] Sub-queries:', subQueries)
      
      // Multi-stage retrieval: Search each condition separately
      const subQueryResults = []
      for (const subQuery of subQueries) {
        console.log(`[COMPOUND] Searching: "${subQuery}"`)
        const results = await searchSubQuery(subQuery, threshold, 60)
        subQueryResults.push(results)
        console.log(`[COMPOUND] Found ${results.length} matches for "${subQuery}"`)
      }
      
      // Merge based on AND/OR logic
      candidates = mergeCompoundResults(operator, subQueryResults)
      
} else {
  // Simple query: Standard vector search
  const embedding = await generateEmbedding(query)
  
  // FIXED: Use correct RPC function name
  const { data, error } = await supabase.rpc('search_similar_applications', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 50,
    filter_status: null,
    filter_position: null,
    filter_nationality: null,
    filter_vessel_type: null
  })

  if (error) throw error
        const normalizedData = normalizeSearchResults(data)  // ✅ ADD THIS
   
  // Group by application_id
  normalizedData.forEach(match => {
    const appId = match.application_id
    if (!candidates[appId]) {
      candidates[appId] = { matches: [] }
    }
    candidates[appId].matches.push(match)
  })
}

    console.log(`[SEARCH] Found ${Object.keys(candidates).length} candidate applications`)
    
    // Get full application data
    const applicationIds = Object.keys(candidates)
    
    if (applicationIds.length === 0) {
      return []
    }
    
    const { data: applications, error: appError } = await supabase
      .from('applications')
      .select(`
        id,
        user_id,
        applied_rank,
        status,
        reference_number,
        application_data (
          data
        )
      `)
      .in('id', applicationIds)

    if (appError) throw appError
    
    // Build final results with metadata
    const results = applications.map(app => {
      const candidateData = candidates[app.id]
      const matches = candidateData.matches
      
      // Calculate similarity (average or combined score)
      const similarity = candidateData.combinedScore !== undefined
        ? candidateData.combinedScore
        : matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
      
      // Get matched chunks for context
      const matchedChunks = matches.map(m => ({
        chunk_text: m.chunk_text,
        similarity: m.similarity
      }))
      
      return {
        application_id: app.id,
        reference_number: app.reference_number,
        similarity,
          chunk_text: matchedChunks[0]?.chunk_text || '',  // ✅ Add this for backward compatibility
        application_data: app.application_data?.data,
        matched_chunks: matchedChunks,
        // Metadata for UI
        full_application: app
      }
    })
    
    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity)
    
    // STAGE 2: LLM Reasoning on top results (NEW!)
    if (enableLLM) {
      console.log('[LLM] Starting two-stage analysis on top results...')
      const topResults = results.slice(0, Math.min(10, results.length))
      
      for (const result of topResults) {
        console.log(`[LLM] Analyzing ${result.reference_number}...`)
        
        const llmAnalysis = await analyzeWithLLM(
          query,
          result.full_application,
          result.matched_chunks.map(c => c.chunk_text)
        )
        
        result.llmAnalysis = llmAnalysis
        
        console.log(`[LLM] ${result.reference_number}: ${llmAnalysis.isMatch ? 'MATCH' : 'NO MATCH'} (${(llmAnalysis.confidence * 100).toFixed(0)}% confidence)`)
        
        // Rate limiting between LLM calls
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Sort again by confidence if available
      results.sort((a, b) => {
        const confA = a.llmAnalysis?.confidence ?? a.similarity
        const confB = b.llmAnalysis?.confidence ?? b.similarity
        return confB - confA
      })
    }
    
    return results.slice(0, limit)
    
  } catch (error) {
    console.error('[SEARCH] Error:', error)
    throw error
  }
}

/**
 * Generate missing embeddings (with progress callback fix)
 */
export async function generateMissingEmbeddings(progressCallback) {
  try {
    console.log('[EMBEDDING] Starting generation process...')
    
    // Get all applications without embeddings
    const { data: applications, error } = await supabase
      .from('applications')
      .select(`
        id,
        reference_number,
        application_data (
          data
        )
      `)
        // Generate embeddings for all applications regardless of status
  .not('reference_number', 'is', null)  // Only applications with reference numbers

    if (error) throw error

    const total = applications.length
    let processed = 0
    let failed = 0

    console.log(`[EMBEDDING] Found ${total} applications to process`)

    for (const app of applications) {
      try {
        // Check if embeddings already exist
        const { data: existing } = await supabase
          .from('application_embeddings')
          .select('id')
          .eq('application_id', app.id)
          .limit(1)

        if (existing && existing.length > 0) {
          processed++
          if (progressCallback) progressCallback(processed, total)
          continue
        }

        // Extract text and generate embeddings
        const text = extractTextForEmbedding(app.application_data?.data || {})
        
        if (!text || text.length < 50) {
          console.warn(`[EMBEDDING] Skipping ${app.reference_number}: insufficient text`)
          failed++
          processed++
          if (progressCallback) progressCallback(processed, total)
          continue
        }

        const embedding = await generateEmbedding(text)
        
        // Store embedding
const { error: insertError } = await supabase
  .from('application_embeddings')
  .insert({
    application_id: app.id,
    embedding,
    text_content: text.substring(0, 1000),  // FIXED: Use correct column name
  })

        if (insertError) {
          console.error(`[EMBEDDING] Failed to store ${app.reference_number}:`, insertError)
          failed++
        } else {
          console.log(`[EMBEDDING] ✓ ${app.reference_number}`)
        }

        processed++
        if (progressCallback) progressCallback(processed, total)
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`[EMBEDDING] Error processing ${app.reference_number}:`, error)
        failed++
        processed++
        if (progressCallback) progressCallback(processed, total)
      }
    }

    return {
      success: true,
      message: `Processed ${processed} applications. ${failed} failed.`,
      processed,
      failed
    }

  } catch (error) {
    console.error('[EMBEDDING] Generation failed:', error)
    return {
      success: false,
      error: error.message,
      processed: 0,
      failed: 0
    }
  }
}

/**
 * Extract text from application data for embedding
 */
function extractTextForEmbedding(applicationData) {
  const sections = []
  const profile = getApplicationSearchProfile(applicationData)
  
  // Section 2: Personal Info
  if (profile.section2) {
    const s = profile.section2
    sections.push(`
      Name: ${s.firstName} ${s.surname}
      Nationality: ${s.nationality}
      Desired Rank: ${profile.desiredRank}
      Vessel Type: ${profile.vesselType}
      Available From: ${profile.availableFrom}
    `)
  }
  
  profile.certificates.forEach(certificate => {
    sections.push(`
      Certificate of Competency: ${certificate.grade}
      CoC Number: ${certificate.certificateNumber}
      Issuing Authority: ${certificate.issuingAuthority}
      Expiry Date: ${certificate.dateOfExpiry}
    `)
  })
  
  profile.endorsements.forEach(endorsement => {
    sections.push(`
      Flag State Endorsement: ${endorsement.flagState}
      Endorsement Type: ${endorsement.endorsementType}
      Rank Endorsed: ${endorsement.rankEndorsed}
    `)
  })

  profile.seaService.forEach(service => {
    sections.push(`
      Vessel: ${service.vesselName} (${service.vesselType})
      Rank: ${service.rankHeld}
      Period: ${service.signOnDate} to ${service.signOffDate}
      Company: ${service.companyName}
      Trade Route: ${service.tradeRoute}
    `)
  })
  
  return sections.join('\n\n').trim()
}
