import { useRef, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { searchBySemanticSimilarity } from '../services/embeddingService'

const QUICK_QUERIES = [
  'Chief Officer with tanker experience',
  'Engine cadet ready within 30 days',
  'C1/D visa and strong English communication'
]

export default function AISearch({
  onResults,
  onLoading,
  onClearSearch,
  embeddingsReady = true,
  embeddingStatusMessage = '',
  onRequireEmbeddings
}) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [analyzingWithLLM, setAnalyzingWithLLM] = useState(false)
  const [error, setError] = useState(null)
  const latestRunIdRef = useRef(0)

  const handleSearch = async () => {
    if (!query.trim()) return
    if (!embeddingsReady) {
      setError(embeddingStatusMessage || 'Generate embeddings before running AI Search.')
      onRequireEmbeddings?.()
      return
    }

    const runId = Date.now()
    latestRunIdRef.current = runId
    setSearching(true)
    setError(null)
    onLoading?.(true)

    try {
      const vectorResults = await searchBySemanticSimilarity(query, 0.3, 20, false)
      if (runId !== latestRunIdRef.current) return

      onResults(vectorResults, query, false)

      if (vectorResults.length > 0) {
        setAnalyzingWithLLM(true)
        onResults(vectorResults, query, true)

        const llmResults = await searchBySemanticSimilarity(query, 0.3, 10, true)
        if (runId !== latestRunIdRef.current) return
        const finalResults = vectorResults.map(result => {
          const llmMatch = llmResults.find(item => item.application_id === result.application_id)
          return llmMatch?.llmAnalysis ? { ...result, llmAnalysis: llmMatch.llmAnalysis } : result
        })

        onResults(finalResults, query, false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
      setAnalyzingWithLLM(false)
      onLoading?.(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setError(null)
    setAnalyzingWithLLM(false)
    onClearSearch?.()
  }

  return (
    <section className="space-y-4">
      <form
        onSubmit={event => {
          event.preventDefault()
          handleSearch()
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Recruiter prompt</span>
            <textarea
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={'Try something like:\nNeed a Chief Officer for oil tanker operations with strong English communication, valid C1/D visa, recent tanker sea service, and availability within the next 30 days.'}
              className="min-h-[180px] w-full resize-y rounded-2xl border border-gray-300 bg-white px-4 py-4 text-sm leading-6 text-gray-900 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
              disabled={searching}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={searching || !query.trim() || !embeddingsReady}
              className="workspace-action-button workspace-action-button--primary min-w-[148px] rounded-2xl"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {searching ? 'Searching' : 'Search'}
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={!query.trim() && !analyzingWithLLM}
              className="workspace-action-button workspace-action-button--secondary rounded-2xl"
            >
              Clear
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!embeddingsReady ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {embeddingStatusMessage || 'Generate embeddings before running AI Search.'}
          </div>
        ) : null}

        {analyzingWithLLM ? (
          <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Confidence analysis is running for the highest-matching profiles.</span>
          </div>
        ) : null}
      </form>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Starter queries</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_QUERIES.map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setQuery(example)}
              className="rounded-full border border-white/70 bg-white/85 px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-teal-200 hover:text-teal-800"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
