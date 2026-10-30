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
    <div className="rounded-card border border-progress-line p-5 bg-raised">
      <div className="mb-4 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-progress" />
        <div>
          <h3 className="text-base font-semibold text-fg">AI Search Setup</h3>
          <p className="text-sm text-fg-secondary">Generate embeddings for semantic search</p>
        </div>
      </div>

      {!result && !error && !isGenerating && (
        <div className="space-y-3">
          <div className="rounded-control border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-text">
            <p className="font-medium">When to run this</p>
          </div>
          
          {cooldownRemaining > 0 && (
            <div className="flex items-center gap-2 p-3 bg-warning-soft border border-warning-line rounded-lg">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-sm text-warning">
                Rate limit active. Try again in {formatCooldown(cooldownRemaining)}
              </span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isDisabled}
            className={`inline-flex items-center gap-2 rounded-control px-4 py-2.5 font-medium transition-colors ${
 isDisabled
 ? 'bg-line-strong text-fg-muted cursor-not-allowed'
 : 'bg-progress text-bg hover:bg-progress'
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
            <Loader2 className="h-5 w-5 animate-spin text-progress" />
            <span className="text-sm font-medium text-fg-secondary">
              Generating embeddings... {progress.current} of {progress.total}
            </span>
          </div>
          <div className="w-full bg-line rounded-full h-2">
            <div
              className="bg-progress h-2 rounded-full transition-all duration-300"
              style={{
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%'
              }}
            />
          </div>
          <p className="text-xs text-fg-muted">This may take a minute...</p>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-3 rounded-card border border-success-line bg-success-soft p-4">
          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">Success!</p>
            <p className="text-sm text-success">{result.message}</p>
            {result.failed > 0 && (
              <p className="text-xs text-warning mt-1">
                Note: {result.failed} embeddings failed. Check console for details.
              </p>
            )}
            <p className="text-xs text-fg-muted mt-2">
              Rate limit: {COOLDOWN_MINUTES} minute cooldown active
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-card border border-danger-line bg-danger-soft p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          <div>
            <p className="font-medium text-danger">Error</p>
            <p className="text-sm text-danger">{error}</p>
            {cooldownRemaining === 0 && (
              <button
                onClick={handleGenerate}
                className="mt-2 text-sm text-danger hover:text-danger underline"
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
