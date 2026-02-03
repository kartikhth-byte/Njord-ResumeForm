// src/components/ConfidenceBadge.jsx
// Displays LLM confidence scores with color-coded badges

import { useState } from 'react'

export default function ConfidenceBadge({ llmAnalysis, compact = false }) {
  const [showReasoning, setShowReasoning] = useState(false)

  if (!llmAnalysis) {
    return null
  }

  const { is_match, isMatch, confidence, reason, isUncertain } = llmAnalysis
  
  // Support both snake_case and camelCase field names
  const matchStatus = is_match ?? isMatch

  // Determine badge color and label
  const getBadgeStyle = () => {
    if (!matchStatus || confidence < 0.6) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        icon: '🔴',
        label: 'Low Match'
      }
    } else if (confidence >= 0.85) {
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        icon: '🟢',
        label: 'High Confidence'
      }
    } else {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-700',
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
          <div className="absolute z-50 top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-700">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-gray-900">AI Analysis:</span>
              <button
                onClick={() => setShowReasoning(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="whitespace-pre-wrap">{reason}</p>
            <div className="mt-2 pt-2 border-t border-gray-200 text-gray-500 italic">
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
        <span className={`text-lg font-bold ${style.text}`}>
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
            <div className="mt-2 text-sm text-gray-700 bg-white rounded p-2 border border-gray-200">
              <p className="whitespace-pre-wrap">{reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}