// src/components/ConfidenceBadge.jsx
// Displays LLM confidence scores with color-coded badges

import { useState } from 'react'

export default function ConfidenceBadge({ llmAnalysis, compact = false }) {
  const [showReasoning, setShowReasoning] = useState(false)

  if (!llmAnalysis) {
    return null
  }

  const { is_match, isMatch, confidence, reason } = llmAnalysis
  
  // Support both snake_case and camelCase field names
  const matchStatus = is_match ?? isMatch

  // Determine badge color and label
  const getBadgeStyle = () => {
    if (!matchStatus || confidence < 0.6) {
      return {
        bg: 'bg-danger-soft',
        border: 'border-danger-line',
        text: 'text-danger',
        icon: '🔴',
        label: 'Low Match'
      }
    } else if (confidence >= 0.85) {
      return {
        bg: 'bg-success-soft',
        border: 'border-success-line',
        text: 'text-success',
        icon: '🟢',
        label: 'High Confidence'
      }
    } else {
      return {
        bg: 'bg-warning-soft',
        border: 'border-warning-line',
        text: 'text-warning',
        icon: '🟡',
        label: 'Review Needed'
      }
    }
  }

  const style = getBadgeStyle()
  const confidencePercent = Math.round(confidence * 100)

  if (compact) {
    // Compact badge for table view
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.border} ${style.text} hover:opacity-80 transition-opacity`}
        >
          <span>{style.icon}</span>
          <span>{confidencePercent}%</span>
        </button>

        {/* Reasoning tooltip */}
        {showReasoning && reason && (
          <div className="absolute z-50 top-full left-0 mt-2 w-80 bg-surface border border-line rounded-lg shadow-overlay p-3 text-xs text-fg-secondary">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-fg">AI Analysis:</span>
              <button
                onClick={() => setShowReasoning(false)}
                className="text-fg-muted hover:text-fg-secondary"
              >
                ✕
              </button>
            </div>
            <p className="whitespace-pre-wrap">{reason}</p>
            <div className="mt-2 pt-2 border-t border-line text-fg-muted italic">
              AI-powered match reasoning
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full badge for detail view
  return (
    <div className={`border rounded-lg p-3 ${style.bg} ${style.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{style.icon}</span>
          <span className={`font-semibold ${style.text}`}>
            {style.label}
          </span>
        </div>
        <span className={`text-lg font-semibold ${style.text}`}>
          {confidencePercent}%
        </span>
      </div>

      {reason && (
        <div className="mt-2">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className={`text-xs font-medium ${style.text} hover:underline`}
          >
            {showReasoning ? '▼ Hide reasoning' : '▶ Show reasoning'}
          </button>

          {showReasoning && (
            <div className="mt-2 text-sm text-fg-secondary bg-surface rounded p-2 border border-line">
              <p className="whitespace-pre-wrap">{reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
