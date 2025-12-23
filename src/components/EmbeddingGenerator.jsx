import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { generateMissingEmbeddings } from '../services/embeddingService'

export default function EmbeddingGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setProgress({ current: 0, total: 0 })

    try {
      const result = await generateMissingEmbeddings((current, total) => {
        setProgress({ current, total })
      })

      if (result.success) {
        setResult(result)
      } else {
        setError(result.error || 'Failed to generate embeddings')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-6 h-6 text-purple-600" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI Search Setup</h3>
          <p className="text-sm text-gray-600">Generate embeddings for semantic search</p>
        </div>
      </div>

      {!result && !error && !isGenerating && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Click the button below to generate AI embeddings for all applications. This is a one-time setup required for semantic search to work.
          </p>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <Sparkles className="w-4 h-4" />
            Generate Embeddings
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            <span className="text-sm font-medium text-gray-700">
              Generating embeddings... {progress.current} of {progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%'
              }}
            />
          </div>
          <p className="text-xs text-gray-500">This may take a minute...</p>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900">Success!</p>
            <p className="text-sm text-green-700">{result.message}</p>
            {result.failed > 0 && (
              <p className="text-xs text-orange-600 mt-1">
                Note: {result.failed} embeddings failed. Check console for details.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={handleGenerate}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}