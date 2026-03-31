// supabase/functions/gemini-reasoning-proxy/index.ts
// LLM reasoning for candidate matching with confidence scoring

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReasoningRequest {
  query: string
  applicationContext: string
  matchedChunks: string[]
  pastFeedback?: Array<{
    query: string
    llm_decision: string
    user_decision: string
    reason: string
  }>
}

interface ReasoningResponse {
  is_match: boolean
  reason: string
  confidence: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, applicationContext, matchedChunks, pastFeedback } = await req.json() as ReasoningRequest

    // Validate input
    if (!query || !applicationContext) {
      throw new Error('Missing required fields: query, applicationContext')
    }

    const runtimeSettings = await getRuntimeSettings(['GEMINI_API_KEY'])
    const apiKey = runtimeSettings.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Build context from matched chunks
    const resumeContext = matchedChunks?.length 
      ? matchedChunks.join('\n\n---\n\n')
      : 'No specific matching sections found.'

    // Build feedback context (for learning)
    let feedbackContext = ''
    if (pastFeedback && pastFeedback.length > 0) {
      feedbackContext = '\n\nPast Similar Cases (for reference):\n'
      pastFeedback.forEach((fb, i) => {
        feedbackContext += `${i + 1}. Query: "${fb.query}"\n`
        feedbackContext += `   AI said: ${fb.llm_decision}, User decided: ${fb.user_decision}\n`
        if (fb.reason) feedbackContext += `   Reason: ${fb.reason}\n`
      })
    }

    // Detect compound query
    const isCompound = /\s+(and|or)\s+/i.test(query)
    const compoundNote = isCompound 
      ? '\n**NOTE: This is a compound query with AND/OR logic. Verify ALL conditions.**\n'
      : ''

    // Build the reasoning prompt (adapted from ai_analyzer.py)
    const reasoningPrompt = `
Analyze the application data below to determine if it matches the requirements.

User Requirements: "${query}"
${compoundNote}

Application Context:
${applicationContext}

Matched Resume Sections:
${resumeContext}
${feedbackContext}

Instructions:

1. **CERTIFICATE VALIDATION (Maritime-Specific):**
   - Certificate of Competency (CoC): Verify rank matches requirement
   - Check expiry dates in certificate data
   - STCW certificates must be valid and not expired
   - If certificates are missing or expired → Mark with lower confidence

2. **VISA VALIDATION - VERY STRICT:**
   - If "US Visa / Other" field shows "Other" → This means NO US VISA (mark FALSE)
   - If field shows "US Visa", "C1/D", "B1/B2", etc. → Check expiry date
   - If expiry date is before ${new Date().getFullYear()} → EXPIRED (mark FALSE)
   - If expiry date shows year "0001" or "-0001" → INVALID (mark FALSE)
   - If field is blank or "N/A" → NO VISA (mark FALSE)
   - ONLY mark TRUE if there's a specific visa type (not "Other") with valid future expiry

3. **VESSEL EXPERIENCE VALIDATION:**
   - Oil tanker experience: Look for specific vessel types in sea service history
   - Verify duration and rank held on each vessel type
   - Check if experience matches the required years
   - Recent experience (last 5 years) should be weighted higher

4. **COMPOUND REQUIREMENTS:**
   - "A and B" requires BOTH A AND B to be present
   - "A or B" requires EITHER A OR B (or both) to be present
   - If ANY required condition (in AND queries) is missing → mark FALSE
   - Be strict with AND logic, flexible with OR logic

5. **TERMINOLOGY FLEXIBILITY (Maritime-Specific):**
   - "US visa" matches: "C1/D visa", "B1/B2 visa", "American visa", "US work authorization"
   - "Oil tanker" matches: "crude oil tanker", "product tanker", "VLCC", "Aframax", "oil/chem tanker"
   - "Bulk carrier" matches: "dry cargo vessel", "handy size", "capesize", "panamax", "bulker"
   - "Container vessel" matches: "container ship", "containership", "feeder vessel", "post-panamax"
   - "Chief Officer" matches: "C/O", "First Officer", "First Mate", "Chief Mate"
   - "Chief Engineer" matches: "C/E", "First Engineer", "1st Engineer"
   - "Second Officer" matches: "2/O", "Second Mate", "2nd Officer"
   - "Second Engineer" matches: "2/E", "2nd Engineer"

6. **CONFIDENCE SCORING:**
   - 0.9-1.0: Perfect match - All requirements clearly met with strong evidence
     * Example: "Chief Officer with 8 years tanker experience, valid US visa until 2027"
   
   - 0.7-0.89: Good match - Requirements met but some minor gaps or ambiguity
     * Example: "Chief Officer with 6 years tanker, but US visa expires in 6 months"
   
   - 0.5-0.69: Uncertain - Some requirements unclear or borderline (FLAG FOR REVIEW)
     * Example: "Chief Officer but only 3 years tanker (requirement was 5+)"
     * Example: "Has tanker experience but rank is Second Officer (requirement was Chief)"
   
   - 0.0-0.49: Poor match - Requirements clearly not met
     * Example: "No US visa", "Wrong vessel type", "Insufficient experience"
   
   **Flag as "uncertain" if confidence < 0.7 - recruiter will manually review these**

7. **REASON CLARITY (Critical for Recruiters):**
   - Be specific about visa status: Include visa type and expiry date
   - Quantify experience: State years and specific vessel types
   - State what's missing if no-match: "No US visa" or "Only 3 years tanker experience"
   - Use natural language that maritime recruiters understand
   - Mention specific sections from the application if helpful

Respond ONLY with valid JSON (no markdown, no code blocks):
{{"is_match": boolean, "reason": "Clear specific explanation", "confidence": 0.0-1.0}}

Examples of GOOD responses:

{{"is_match": true, "reason": "Strong match: Candidate has valid US C1/D visa expiring March 2028 and 12 years as Chief Engineer on oil tankers including 5 years on VLCCs. All requirements met.", "confidence": 0.95}}

{{"is_match": false, "reason": "US visa field shows 'Other' which indicates no valid US visa, though candidate has extensive oil tanker experience (8 years as Chief Officer). Visa is the blocking requirement.", "confidence": 0.25}}

{{"is_match": true, "reason": "Valid US B1/B2 visa until 2027, but only 3 years oil tanker experience as Second Officer (requirement was 5+ years as Chief Officer). Experience gap is significant.", "confidence": 0.58}}

{{"is_match": false, "reason": "US visa expired in 2023 (no longer valid). Candidate has excellent tanker experience but current valid visa is required.", "confidence": 0.15}}

{{"is_match": true, "reason": "Candidate meets rank requirement (Chief Officer) and has valid US C1/D visa until 2026, but vessel experience is primarily bulk carriers (only 1 year on tankers). Borderline match.", "confidence": 0.62}}
`

    // Call Gemini API with correct model name
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: reasoningPrompt }]
          }],
          generationConfig: {
            temperature: 0.2,  // Lower temperature for more consistent reasoning
            maxOutputTokens: 3000  // Increased for detailed maritime analysis
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Gemini API error:', error)
      throw new Error(`Gemini API failed: ${response.status}`)
    }

    const data = await response.json()
    
    // Extract the response text
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Log raw response for debugging
    console.log('Raw LLM response length:', resultText.length)
    console.log('Raw LLM response:', resultText.substring(0, 200) + '...')
    
    // Remove markdown code blocks if present
    resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to parse JSON from the response
    try {
      // First try direct parse
      const parsed = JSON.parse(resultText)
      
      // Validate required fields
      if (typeof parsed.is_match !== 'boolean' || 
          typeof parsed.reason !== 'string' ||
          typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response format')
      }
      
      // Ensure confidence is between 0 and 1
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence))
      
      // Mark as uncertain if confidence is low
      if (parsed.confidence < 0.7) {
        parsed.isUncertain = true
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          ...parsed
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
      
    } catch (parseError) {
      // Try to extract JSON from text with improved regex
      console.log('Direct parse failed, attempting extraction...')
      
      // Try to find JSON object - be more flexible
      let jsonMatch = resultText.match(/\{[\s\S]*?"is_match"[\s\S]*?\}/);
      
      // If that didn't work, try to find any JSON-like structure
      if (!jsonMatch) {
        jsonMatch = resultText.match(/\{[^}]*"is_match"[^}]*\}/);
      }
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          parsed.confidence = parsed.confidence || 0.5
          
          return new Response(
            JSON.stringify({
              success: true,
              ...parsed
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          )
        } catch (e) {
          console.error('JSON extraction parse error:', e.message)
        }
      }
      
      // Fallback: Return uncertain match with more context
      console.error('Failed to parse LLM response:', resultText.substring(0, 500))
      return new Response(
        JSON.stringify({
          success: true,
          is_match: false,
          reason: 'Unable to analyze application conclusively. Please review manually.',
          confidence: 0.4,
          isUncertain: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

  } catch (error) {
    console.error('Reasoning error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Reasoning failed',
        is_match: false,
        reason: 'Analysis failed due to system error',
        confidence: 0.0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
