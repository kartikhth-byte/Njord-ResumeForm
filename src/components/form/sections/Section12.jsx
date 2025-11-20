import { useState, useEffect } from 'react'
import FormSelect from '../shared/FormSelect'
import { Plus, Trash2 } from 'lucide-react'

const LANGUAGE_OPTIONS = [
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Russian', label: 'Russian' },
  { value: 'Chinese', label: 'Chinese (Mandarin)' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Bengali', label: 'Bengali' },
  { value: 'Tagalog', label: 'Tagalog (Filipino)' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Turkish', label: 'Turkish' },
  { value: 'Polish', label: 'Polish' },
  { value: 'Ukrainian', label: 'Ukrainian' },
  { value: 'Vietnamese', label: 'Vietnamese' },
  { value: 'Thai', label: 'Thai' },
  { value: 'Bahasa Indonesia', label: 'Bahasa Indonesia' },
  { value: 'Malay', label: 'Malay' },
  { value: 'Dutch', label: 'Dutch' },
  { value: 'Swedish', label: 'Swedish' },
  { value: 'Norwegian', label: 'Norwegian' },
  { value: 'Danish', label: 'Danish' },
  { value: 'Finnish', label: 'Finnish' },
  { value: 'Other', label: 'Other' },
]

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner - Basic words and phrases' },
  { value: 'elementary', label: 'Elementary - Simple conversations' },
  { value: 'intermediate', label: 'Intermediate - Comfortable in most situations' },
  { value: 'advanced', label: 'Advanced - Fluent in professional contexts' },
  { value: 'native', label: 'Native/Bilingual - Complete fluency' },
]

const emptyLanguage = {
  language: '',
  level: '',
}

export default function Section12({ data = {}, onUpdate }) {
  const [languages, setLanguages] = useState(data.languages || [])

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.languages) {
      setLanguages(data.languages)
    }
  }, [data])

  const handleAddLanguage = () => {
    const newLanguages = [...languages, { ...emptyLanguage }]
    setLanguages(newLanguages)
    onUpdate({ section12: { languages: newLanguages } })
  }

  const handleRemoveLanguage = (index) => {
    const newLanguages = languages.filter((_, i) => i !== index)
    setLanguages(newLanguages)
    onUpdate({ section12: { languages: newLanguages } })
  }

  const handleLanguageChange = (index, field, value) => {
    const newLanguages = [...languages]
    newLanguages[index] = {
      ...newLanguages[index],
      [field]: value
    }
    setLanguages(newLanguages)
    onUpdate({ section12: { languages: newLanguages } })
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 12: Foreign Languages</h2>
        <p className="text-gray-600 mt-1">
          List all foreign languages you can speak and your proficiency level
        </p>
      </div>

      {/* Languages List */}
      <div className="space-y-6">
        {languages.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
            <p className="text-gray-600 mb-2">No foreign languages added yet</p>
            <p className="text-sm text-gray-500 mb-4">English is assumed as the primary working language</p>
            <button
              onClick={handleAddLanguage}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Language
            </button>
          </div>
        ) : (
          <>
            {languages.map((lang, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Language Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Language {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveLanguage(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Language Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormSelect
                    label="Language"
                    name={`language-${index}-language`}
                    required
                    value={lang.language}
                    onChange={(e) => handleLanguageChange(index, 'language', e.target.value)}
                    options={LANGUAGE_OPTIONS}
                  />

                  <FormSelect
                    label="Proficiency Level"
                    name={`language-${index}-level`}
                    required
                    value={lang.level}
                    onChange={(e) => handleLanguageChange(index, 'level', e.target.value)}
                    options={LEVEL_OPTIONS}
                  />
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddLanguage}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Language</span>
            </button>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              🌐 Tip
            </h3>
            <p className="text-sm text-blue-800">
              English is the international maritime language and is required for all seafarers. Additional language skills are a valuable asset and can increase your employment opportunities, especially for vessels trading in specific regions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}