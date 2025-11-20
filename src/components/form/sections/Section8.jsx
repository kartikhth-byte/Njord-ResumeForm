import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const emptyCertificate = {
  grade: '',
  issuingAuthority: '',
  certificateNumber: '',
  dateOfIssue: '',
  dateOfExpiry: '',
  placeOfIssue: '',
  dateRevalidated: '',
  dateRevalidationExpiry: '',
}

export default function Section8({ data = {}, onUpdate }) {
  const [certificates, setCertificates] = useState(data.certificates || [])

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.certificates) {
      setCertificates(data.certificates)
    }
  }, [data])

  const handleAddCertificate = () => {
    const newCertificates = [...certificates, { ...emptyCertificate }]
    setCertificates(newCertificates)
    onUpdate({ section8: { certificates: newCertificates } })
  }

  const handleRemoveCertificate = (index) => {
    const newCertificates = certificates.filter((_, i) => i !== index)
    setCertificates(newCertificates)
    onUpdate({ section8: { certificates: newCertificates } })
  }

  const handleCertificateChange = (index, field, value) => {
    const newCertificates = [...certificates]
    newCertificates[index] = {
      ...newCertificates[index],
      [field]: value
    }
    setCertificates(newCertificates)
    onUpdate({ section8: { certificates: newCertificates } })
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 8: National Certificates of Competency</h2>
        <p className="text-gray-600 mt-1">
          List all your Certificates of Competency (CoC) including revalidation details
        </p>
      </div>

      {/* Certificates List */}
      <div className="space-y-6">
        {certificates.length === 0 ? (
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
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <p className="text-gray-600 mb-4">No certificates added yet</p>
            <button
              onClick={handleAddCertificate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Certificate
            </button>
          </div>
        ) : (
          <>
            {certificates.map((cert, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Certificate Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Certificate {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveCertificate(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Certificate Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Grade"
                      name={`cert-${index}-grade`}
                      required
                      value={cert.grade}
                      onChange={(e) => handleCertificateChange(index, 'grade', e.target.value)}
                      placeholder="e.g., Master Unlimited, Chief Officer"
                      helpText="Certificate grade/rank"
                    />

                    <FormInput
                      label="Issuing Authority"
                      name={`cert-${index}-issuingAuthority`}
                      required
                      value={cert.issuingAuthority}
                      onChange={(e) => handleCertificateChange(index, 'issuingAuthority', e.target.value)}
                      placeholder="e.g., USCG, Indian DG Shipping, UK MCA"
                    />
                  </div>

                  <FormInput
                    label="Certificate Number"
                    name={`cert-${index}-certificateNumber`}
                    required
                    value={cert.certificateNumber}
                    onChange={(e) => handleCertificateChange(index, 'certificateNumber', e.target.value)}
                    placeholder="e.g., COC123456"
                  />

                  <FormInput
                    label="Place of Issue"
                    name={`cert-${index}-placeOfIssue`}
                    required
                    value={cert.placeOfIssue}
                    onChange={(e) => handleCertificateChange(index, 'placeOfIssue', e.target.value)}
                    placeholder="e.g., Mumbai, India"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="Date of Issue"
                      name={`cert-${index}-dateOfIssue`}
                      required
                      value={cert.dateOfIssue}
                      onChange={(e) => handleCertificateChange(index, 'dateOfIssue', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`cert-${index}-dateOfExpiry`}
                      required
                      value={cert.dateOfExpiry}
                      onChange={(e) => handleCertificateChange(index, 'dateOfExpiry', e.target.value)}
                      min={cert.dateOfIssue || new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* Revalidation Section */}
                  <div className="border-t border-gray-300 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Revalidation Details (if applicable)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormDatePicker
                        label="Date Revalidated"
                        name={`cert-${index}-dateRevalidated`}
                        value={cert.dateRevalidated}
                        onChange={(e) => handleCertificateChange(index, 'dateRevalidated', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        helpText="Leave blank if not revalidated"
                      />

                      <FormDatePicker
                        label="Revalidation Expiry"
                        name={`cert-${index}-dateRevalidationExpiry`}
                        value={cert.dateRevalidationExpiry}
                        onChange={(e) => handleCertificateChange(index, 'dateRevalidationExpiry', e.target.value)}
                        min={cert.dateRevalidated || new Date().toISOString().split('T')[0]}
                        helpText="Leave blank if not revalidated"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddCertificate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Certificate</span>
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
              📜 Important
            </h3>
            <p className="text-sm text-blue-800">
              Include all valid Certificates of Competency. If you have revalidated your certificate, please provide those dates as well. Ensure certificates are not expired or close to expiry.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}