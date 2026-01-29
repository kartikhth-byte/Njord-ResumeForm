import { supabase } from '../lib/supabase'

/**
 * Generate embedding for text using Gemini API (via secure proxy)
 */
export async function generateEmbedding(text) {
  try {
    // Call secure edge function instead of direct API ✅
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
      const error = await response.text()
      console.error('Proxy error:', error)
      throw new Error(`Failed to generate embedding: ${response.statusText}`)
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
 * Parse compound queries (AND/OR logic)
 * Returns: { isCompound, operator, subQueries }
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
  
  // Simple query
  return { isCompound: false, operator: null, subQueries: [query] }
}

/**
 * Search for a single sub-query
 */
async function searchSubQuery(subQuery, threshold = 0.3, limit = 30) {
  console.log(`[SUBQUERY] Searching: "${subQuery}"`)
  
  // Generate embedding
  const queryEmbedding = await generateEmbedding(subQuery)
  
  // Search database
  const { data, error } = await supabase.rpc('search_similar_applications', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit
  })
  
  if (error) throw error
  
  console.log('[SUBQUERY] Raw database response:', data?.[0]) // Debug: see what database returns
  
  // Group by application_id
  const resultsByApp = {}
  for (const match of data || []) {
    const appId = match.application_id
    if (!resultsByApp[appId]) {
      resultsByApp[appId] = []
    }
    resultsByApp[appId].push(match)
  }
  
  console.log(`[SUBQUERY] Found ${Object.keys(resultsByApp).length} applications`)
  return resultsByApp
}

/**
 * Merge results from multiple sub-queries based on operator
 */
function mergeCompoundResults(operator, subQueryResults) {
  if (subQueryResults.length === 0) return {}
  if (subQueryResults.length === 1) return subQueryResults[0]
  
  // Get application IDs from each sub-query
  const appIdSets = subQueryResults.map(results => new Set(Object.keys(results)))
  
  let candidateAppIds
  if (operator === 'AND') {
    // Intersection: Only apps in ALL sub-queries
    candidateAppIds = appIdSets[0]
    for (let i = 1; i < appIdSets.length; i++) {
      candidateAppIds = new Set([...candidateAppIds].filter(id => appIdSets[i].has(id)))
    }
    console.log(`[MERGE AND] ${candidateAppIds.size} applications match ALL conditions`)
  } else {
    // Union: Apps in ANY sub-query
    candidateAppIds = new Set()
    appIdSets.forEach(set => {
      set.forEach(id => candidateAppIds.add(id))
    })
    console.log(`[MERGE OR] ${candidateAppIds.size} applications match ANY condition`)
  }
  
  // Collect all chunks for each candidate application
  const merged = {}
  for (const appId of candidateAppIds) {
    merged[appId] = []
    const seenChunkIds = new Set()
    
    // Gather chunks from all sub-queries
    for (const results of subQueryResults) {
      if (results[appId]) {
        for (const chunk of results[appId]) {
          if (!seenChunkIds.has(chunk.id)) {
            merged[appId].push(chunk)
            seenChunkIds.add(chunk.id)
          }
        }
      }
    }
    
    // Calculate combined similarity score (average of top matches)
    if (merged[appId].length > 0) {
      const topScores = merged[appId]
        .map(c => c.similarity)
        .sort((a, b) => b - a)
        .slice(0, 3) // Average top 3 scores
      
      merged[appId].combinedScore = topScores.reduce((a, b) => a + b, 0) / topScores.length
    }
  }
  
  return merged
}

/**
 * Enhanced semantic search with compound query support
 */
export async function searchBySemanticSimilarity(query, threshold = 0.3, limit = 20) {
  console.log('=== ENHANCED SEMANTIC SEARCH ===')
  console.log('Query:', query)
  console.log('Threshold:', threshold)

  try {
    // Parse query for compound logic
    const { isCompound, operator, subQueries } = parseCompoundQuery(query)
    
    let resultsByApp
    
    if (isCompound) {
      console.log(`[COMPOUND QUERY] Operator: ${operator}, Sub-queries: ${subQueries.length}`)
      
      // Search each sub-query separately
      const subQueryResults = []
      for (const subQuery of subQueries) {
        const results = await searchSubQuery(subQuery, threshold, limit * 2)
        subQueryResults.push(results)
      }
      
      // Merge based on operator (AND/OR)
      resultsByApp = mergeCompoundResults(operator, subQueryResults)
    } else {
      // Simple query
      console.log('[SIMPLE QUERY]')
      resultsByApp = await searchSubQuery(query, threshold, limit)
    }
    
    // Convert to flat array - return in same format as database
    const results = []
    for (const [appId, chunks] of Object.entries(resultsByApp)) {
      // Sort chunks by similarity (best first)
      const sortedChunks = chunks.sort((a, b) => b.similarity - a.similarity)
      
      // For each application, return the best matching chunk
      // This maintains compatibility with RecruiterApplications
      results.push(sortedChunks[0]) // Just return the best chunk for this app
    }
    
    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity)
    const finalResults = results.slice(0, limit)
    
    console.log(`Search complete: ${finalResults.length} applications`)
    finalResults.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. App ${r.application_id.substring(0, 8)}: ${(r.similarity * 100).toFixed(1)}%`)
    })
    
    return finalResults
  } catch (error) {
    console.error('Enhanced semantic search error:', error)
    throw error
  }
}

/**
 * Generate embeddings for applications that don't have them yet
 */
export async function generateMissingEmbeddings() {
  try {
    console.log('Checking for applications without embeddings...')

    // Get all applications with their data
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select(`
        id,
        user_id,
        application_data!inner (
          data
        )
      `)
      .not('application_data', 'is', null)

    if (appsError) throw appsError

    console.log(`Found ${applications.length} total applications`)

    // Check which ones already have embeddings
    const { data: existingEmbeddings, error: embError } = await supabase
      .from('application_embeddings')
      .select('application_id')

    if (embError) throw embError

    const existingIds = new Set(existingEmbeddings.map(e => e.application_id))
    const missingApps = applications.filter(app => !existingIds.has(app.id))

    console.log(`${missingApps.length} applications need embeddings`)

    if (missingApps.length === 0) {
      return { success: true, count: 0, message: 'All applications already have embeddings' }
    }

    // Generate embeddings for missing applications
    let successCount = 0
    let errorCount = 0

    for (const app of missingApps) {
      try {
        const text = extractTextForEmbedding(app.application_data.data)
        const embedding = await generateEmbedding(text)

        const { error: insertError } = await supabase
          .from('application_embeddings')
          .insert({
            application_id: app.id,
            embedding: embedding,
            embedded_text: text,
            model_version: 'text-embedding-004'
          })

        if (insertError) throw insertError

        successCount++
        console.log(`✅ Generated embedding for application ${app.id} (${successCount}/${missingApps.length})`)

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`❌ Failed to generate embedding for application ${app.id}:`, error)
        errorCount++
      }
    }

    return {
      success: true,
      count: successCount,
      errors: errorCount,
      message: `Generated ${successCount} embeddings${errorCount > 0 ? `, ${errorCount} failed` : ''}`
    }
  } catch (error) {
    console.error('Error in generateMissingEmbeddings:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Extract text from application data for embedding
 */
function extractTextForEmbedding(applicationData) {
  const sections = []

  // Section 1: Availability & Application
  if (applicationData.section1) {
    const s = applicationData.section1
    sections.push(`Position: ${s.appliedForRank || ''}`)
    sections.push(`Vessel type: ${s.vesselType || ''}`)
    sections.push(`Available from: ${s.availableFrom || ''}`)
  }

  // Section 2: Personal & Contact Details
  if (applicationData.section2) {
    const s = applicationData.section2
    sections.push(`Name: ${s.firstName || ''} ${s.middleName || ''} ${s.surname || ''}`)
    sections.push(`Nationality: ${s.nationality || ''}`)
    sections.push(`Age: ${s.age || ''}`)
  }

  // Section 8: Certificates
  if (applicationData.section8?.certificates) {
    const certs = applicationData.section8.certificates
      .map(c => `${c.name} (${c.grade || ''})`)
      .join(', ')
    sections.push(`Certificates: ${certs}`)
  }

  // Section 16: Sea Service
  if (applicationData.section16?.seaService) {
    const vessels = applicationData.section16.seaService
      .map(v => `${v.rank || ''} on ${v.vesselName || ''} (${v.vesselType || ''})`)
      .join('; ')
    sections.push(`Experience: ${vessels}`)
  }

  // Section 17: Experience Summary
  if (applicationData.section17) {
    const s = applicationData.section17
    sections.push(`Total sea time: ${s.totalSeaTime || ''}`)
    sections.push(`Vessel types: ${s.vesselTypesWorked || ''}`)
    sections.push(`Cargo handled: ${s.cargoTypes || ''}`)
  }

  // Section 18: References
  if (applicationData.section18?.references) {
    const refs = applicationData.section18.references
      .map(r => `Reference from ${r.name} (${r.company})`)
      .join('; ')
    sections.push(`References: ${refs}`)
  }

  return sections.filter(Boolean).join('. ')
}