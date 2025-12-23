import { useState } from 'react'
import { Search, Sparkles, X, Zap } from 'lucide-react'
import { searchBySemanticSimilarity } from '../services/embeddingService'

export default function AISearch({ onResults, onLoading, onClearSearch }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    
    if (!query.trim()) {
      setError('Please enter a search query')
      return
    }

    try {
      setSearching(true)
      setError(null)
      onLoading?.(true)

      console.log('🔍 Starting enhanced semantic search:', query)

      // Enhanced semantic search with compound query support
      const results = await searchBySemanticSimilarity(query, 0.3, 20)

      console.log('✅ Search results:', results.length)
      
      onResults(results, {}, query)
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message || 'Search failed. Please try again.')
    } finally {
      setSearching(false)
      onLoading?.(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setError(null)
    onClearSearch?.()
  }

  const insertExample = (example) => {
    setQuery(example)
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Enhanced AI Semantic Search</h3>
          <p className="text-sm text-gray-600">Search by skills, experience, and qualifications • Now with AND/OR logic!</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., 'tanker experience AND strong leadership' or 'problem solving OR crisis management'"
              className="w-full px-4 py-3 pr-24 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={searching}
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
          
          <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
            <Zap className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">New: Compound Queries!</span>
              <span> Use AND to require all conditions, OR for any condition.</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
      </form>

      <div className="mt-4 pt-4 border-t border-purple-200">
        <p className="text-xs font-semibold text-gray-700 mb-2">Quick Examples (click to use):</p>
        <div className="space-y-1">
          <button
            onClick={() => insertExample('tanker experience AND strong leadership')}
            className="block w-full text-left px-3 py-2 text-xs bg-white hover:bg-purple-50 border border-gray-200 rounded-md transition-colors"
          >
            <span className="font-medium text-purple-600">Compound AND:</span> tanker experience AND strong leadership
          </button>
          <button
            onClick={() => insertExample('crisis management OR emergency response')}
            className="block w-full text-left px-3 py-2 text-xs bg-white hover:bg-purple-50 border border-gray-200 rounded-md transition-colors"
          >
            <span className="font-medium text-blue-600">Compound OR:</span> crisis management OR emergency response
          </button>
          <button
            onClick={() => insertExample('excellent communication skills')}
            className="block w-full text-left px-3 py-2 text-xs bg-white hover:bg-purple-50 border border-gray-200 rounded-md transition-colors"
          >
            <span className="font-medium text-gray-600">Simple:</span> excellent communication skills
          </button>
        </div>
        
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> For exact matches (position, nationality, dates), use Manual Filters. 
            AI Search works best for skills, qualities, and experience descriptions.
          </p>
        </div>
      </div>
    </div>
  )
}