import { useState, useEffect } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { generateMissingEmbeddings } from '../services/embeddingService'

const COOLDOWN_MINUTES = 5 // 5 minute cooldown
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000

export default function EmbeddingGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // Check cooldown on mount and set up interval
  useEffect(() => {
    checkCooldown()
    
    // Update cooldown timer every second
    const interval = setInterval(() => {
      checkCooldown()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const checkCooldown = () => {
    const lastGeneration = localStorage.getItem('lastEmbeddingGeneration')
    
    if (!lastGeneration) {
      setCooldownRemaining(0)
      return
    }

    const lastTime = parseInt(lastGeneration)
    const now = Date.now()
    const elapsed = now - lastTime
    const remaining = COOLDOWN_MS - elapsed

    if (remaining > 0) {
      setCooldownRemaining(Math.ceil(remaining / 1000)) // Convert to seconds
    } else {
      setCooldownRemaining(0)
    }
  }

  const formatCooldown = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleGenerate = async () => {
    // Check cooldown
    if (cooldownRemaining > 0) {
      setError(`Please wait ${formatCooldown(cooldownRemaining)} before generating again`)
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)
    setProgress({ current: 0, total: 0 })

    try {
      // Store generation start time
      localStorage.setItem('lastEmbeddingGeneration', Date.now().toString())
      
      const result = await generateMissingEmbeddings((current, total) => {
        setProgress({ current, total })
      })

      if (result.success) {
        setResult(result)
        // Start cooldown timer
        checkCooldown()
      } else {
        setError(result.error || 'Failed to generate embeddings')
        // Remove timestamp on failure so user can retry
        localStorage.removeItem('lastEmbeddingGeneration')
      }
    } catch (err) {
      setError(err.message)
      // Remove timestamp on error so user can retry
      localStorage.removeItem('lastEmbeddingGeneration')
    } finally {
      setIsGenerating(false)
    }
  }

  const isDisabled = isGenerating || cooldownRemaining > 0

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
          
          {cooldownRemaining > 0 && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-700">
                Rate limit active. Try again in {formatCooldown(cooldownRemaining)}
              </span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Generate Embeddings
            {cooldownRemaining > 0 && (
              <span className="text-xs">({formatCooldown(cooldownRemaining)})</span>
            )}
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
            <p className="text-xs text-gray-500 mt-2">
              Rate limit: {COOLDOWN_MINUTES} minute cooldown active
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
            {cooldownRemaining === 0 && (
              <button
                onClick={handleGenerate}
                className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}