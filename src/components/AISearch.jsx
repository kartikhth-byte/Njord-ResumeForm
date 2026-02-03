import { useState } from 'react'
import { searchBySemanticSimilarity } from '../services/embeddingService'

export default function AISearch({ onResults, onLoading, onClearSearch }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [analyzingWithLLM, setAnalyzingWithLLM] = useState(false)  // ← THIS WAS MISSING
  const [error, setError] = useState(null)

  const handleSearch = async () => {
  if (!query.trim()) return
  
  setSearching(true)
  setError(null)
  onLoading?.(true)
  
  try {
    console.log('🔍 Starting search:', query)
    
    // STAGE 1: Get vector results FAST (1-2 seconds)
    const vectorResults = await searchBySemanticSimilarity(query, 0.3, 20, false)
    
    console.log('✅ Vector results:', vectorResults.length)
    
    // Show results immediately
    onResults(vectorResults, query, false)  // ← ADD false (not analyzing yet)
    setSearching(false)
    onLoading?.(false)
    
    // STAGE 2: Add LLM analysis in background (10+ seconds)
    if (vectorResults.length > 0) {
      setAnalyzingWithLLM(true)
      onResults(vectorResults, query, true)  // ← ADD true (analyzing started)
      console.log('🧠 Starting LLM analysis in background...')
        
        // Run search again with LLM enabled for top 10 results
        const llmResults = await searchBySemanticSimilarity(query, 0.3, 10, true)
        
        console.log('✅ LLM analysis complete:', llmResults.length)
        console.log('📊 Sample LLM result:', llmResults[0])
        
        // Merge LLM data back into original results
        const finalResults = vectorResults.map(result => {
          const llmMatch = llmResults.find(r => r.application_id === result.application_id)
          if (llmMatch?.llmAnalysis) {
            return { ...result, llmAnalysis: llmMatch.llmAnalysis }
          }
          return result
        })
        
        console.log('📊 Final enriched result sample:', finalResults[0])
        
        // Update results with LLM data
onResults(finalResults, query, false)  // ← ADD false (analyzing complete)
        setAnalyzingWithLLM(false)
        
        console.log('✅ Results updated with LLM analysis')
      }
      
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message)
      setSearching(false)
      setAnalyzingWithLLM(false)
      onLoading?.(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setError(null)
    onClearSearch?.()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Enhanced AI Semantic Search
        </h3>
        <p className="text-sm text-gray-600">
          Search by skills, experience, and qualifications
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSearch() }} className="space-y-4">
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='E.g., "Chief Officer with tanker experience" or "US visa required"'
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={searching}
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          
{query.trim() && (
  <button onClick={handleClear}>
    Clear
  </button>
)}
        </div>

        {analyzingWithLLM && (
          <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Analyzing with AI for confidence scores...</span>
          </div>
        )}
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">💡 <strong>Quick Examples (click to use):</strong></p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setQuery('Chief Officer with tanker experience')}
            className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
          >
            Chief Officer with tanker experience
          </button>
          <button
            onClick={() => setQuery('US visa required')}
            className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
          >
            US visa required
          </button>
          <button
            onClick={() => setQuery('excellent communication skills')}
            className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
          >
            excellent communication skills
          </button>
        </div>
      </div>
    </div>
  )
}