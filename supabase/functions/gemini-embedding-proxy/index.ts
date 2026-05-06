// supabase/functions/gemini-embedding-proxy/index.ts
// Secure proxy for Gemini embedding API calls

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getRuntimeSettings } from '../_shared/runtime-settings.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface EmbeddingRequest {
  text: string
  model?: string
  outputDimensionality?: number
}

serve(async (req) => {
  const corsHeaders = await getCorsHeaders(req, { allowMethods: 'POST, OPTIONS' })
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const {
      text,
      model = 'gemini-embedding-001',
      outputDimensionality = 768,
    } = await req.json() as EmbeddingRequest

    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input')
    }

    // Length limit: 10,000 characters
    if (text.length > 10000) {
      throw new Error('Text too long (max 10,000 characters)')
    }

    const runtimeSettings = await getRuntimeSettings(['GEMINI_API_KEY'])
    const apiKey = runtimeSettings.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text }]
          },
          outputDimensionality,
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Gemini API error:', error)
      throw new Error(`Gemini API failed: ${response.status}`)
    }

    const data = await response.json()

    return new Response(
      JSON.stringify({
        success: true,
        embedding: data.embedding.values
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Embedding proxy error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
