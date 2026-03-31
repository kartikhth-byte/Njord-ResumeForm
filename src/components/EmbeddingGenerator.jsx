import { useState, useEffect } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { generateMissingEmbeddings } from '../services/embeddingService'

const COOLDOWN_MINUTES = 5 // 5 minute cooldown
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000

export default function EmbeddingGenerator({ onGenerated, onFailed }) {
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
        onGenerated?.(result)
      } else {
        setError(result.error || 'Failed to generate embeddings')
        // Remove timestamp on failure so user can retry
        localStorage.removeItem('lastEmbeddingGeneration')
        onFailed?.(result.error || 'Failed to generate embeddings')
      }
    } catch (err) {
      setError(err.message)
      // Remove timestamp on error so user can retry
      localStorage.removeItem('lastEmbeddingGeneration')
      onFailed?.(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const isDisabled = isGenerating || cooldownRemaining > 0

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-5">
      <div className="mb-4 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <div>
          <h3 className="text-base font-semibold text-gray-900">AI Search Setup</h3>
          <p className="text-sm text-gray-600">Generate embeddings for semantic search</p>
        </div>
      </div>

      {!result && !error && !isGenerating && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Generate embeddings once to enable AI Search for the current application pool. Recruiters do not need to run this before every search.
          </p>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">When to run this</p>
            <p className="mt-1">
              Run it the first time AI Search is used, then run it again only after new applications are submitted or when you want recently updated applicant data included in AI results.
            </p>
          </div>
          
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
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-colors ${
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
          <p className="text-xs text-gray-500">
            Safe default: run this once after new applications arrive, then use AI Search normally.
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
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
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
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
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
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
