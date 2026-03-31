import { useState } from 'react'
import { Briefcase, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function OfferModal({ application, onClose, onOfferSent }) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('form') // 'form' or 'upload'
  const [uploadedFile, setUploadedFile] = useState(null)
  const [formData, setFormData] = useState({
    position: application.applied_rank || '',
    vesselType: application.application_data?.data?.section1?.vesselType || '',
    vesselName: '',
    salary: '',
    currency: 'USD',
    contractDuration: '',
    joiningDate: '',
    additionalBenefits: '',
    notes: ''
  })

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF or Word document')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      setUploadedFile(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation based on mode
    if (mode === 'form') {
      if (!formData.position || !formData.salary || !formData.contractDuration || !formData.joiningDate) {
        alert('Please fill in all required fields')
        return
      }
    } else if (mode === 'upload') {
      if (!uploadedFile) {
        alert('Please upload an offer letter document')
        return
      }
    }

    try {
      setLoading(true)

      let offerData = {}
      let documentUrl = null

      if (mode === 'upload') {
        // Upload file to Supabase Storage
        const fileExt = uploadedFile.name.split('.').pop()
        const fileName = `${application.id}/offer-letter-${Date.now()}.${fileExt}`
        
      const { error: uploadError } = await supabase.storage
        .from('offer-letters')
          .upload(fileName, uploadedFile)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('offer-letters')
          .getPublicUrl(fileName)
        
        documentUrl = urlData.publicUrl

        offerData = {
          mode: 'document',
          document_url: documentUrl,
          document_name: uploadedFile.name,
          offered_at: new Date().toISOString(),
          notes: formData.notes
        }
      } else {
        // Form mode - prepare offer data
        offerData = {
          mode: 'form',
          position: formData.position,
          vessel_type: formData.vesselType,
          vessel_name: formData.vesselName,
          salary: `${formData.salary} ${formData.currency}`,
          contract_duration: formData.contractDuration,
          joining_date: formData.joiningDate,
          additional_benefits: formData.additionalBenefits,
          offered_at: new Date().toISOString(),
          notes: formData.notes
        }
      }

      // Update application status and store offer details
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'offered',
          offer_details: offerData,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id)

      if (updateError) throw updateError

      // Send offer letter email with appropriate payload
      const emailPayload = mode === 'upload' 
        ? {
            mode: 'upload',
            applicantEmail: application.email || application.application_data?.data?.section2?.email,
            applicantName: application.full_name,
            referenceNumber: application.reference_number,
            documentUrl: documentUrl,
            documentName: uploadedFile.name
          }
        : {
            mode: 'form',
            applicantEmail: application.email || application.application_data?.data?.section2?.email,
            applicantName: application.full_name,
            referenceNumber: application.reference_number,
            position: formData.position,
            vesselType: formData.vesselType,
            vesselName: formData.vesselName,
            salary: `${formData.salary} ${formData.currency}`,
            contractDuration: formData.contractDuration,
            joiningDate: formData.joiningDate,
            additionalBenefits: formData.additionalBenefits
          }

      const emailResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-offer-letter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(emailPayload)
        }
      )

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        console.error('Failed to send offer email:', errorData)
        // Don't fail the whole operation if email fails
        alert('Offer created but email notification failed. Please contact the candidate manually.')
      } else {
        console.log('Offer letter email sent successfully')
      }

      // Success - close modal and refresh
      if (onOfferSent) {
        onOfferSent()
      }
      onClose()

      alert('Offer successfully sent to candidate!')

    } catch (error) {
      console.error('Error sending offer:', error)
      alert('Failed to send offer: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="recruiter-modal-backdrop">
      <div className="recruiter-modal max-w-2xl">
        {/* Header */}
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <p className="recruiter-modal__eyebrow">Offer workflow</p>
              <h2 className="recruiter-modal__title">Make job offer</h2>
              <p className="recruiter-modal__subtitle">
                {application.reference_number} - {application.full_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="recruiter-modal__close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="recruiter-modal__body space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('form')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'form'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📝 Fill Details
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'upload'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📄 Upload Document
            </button>
          </div>

          {/* Upload Mode */}
          {mode === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  id="offer-document"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="offer-document"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="p-4 bg-blue-50 rounded-full mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-base font-medium text-gray-900 mb-1">
                    {uploadedFile ? uploadedFile.name : 'Click to upload offer letter'}
                  </p>
                  <p className="text-sm text-gray-500">
                    PDF or Word document (Max 5MB)
                  </p>
                </label>
                {uploadedFile && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-green-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">File ready to send</span>
                  </div>
                )}
              </div>

              {/* Internal Notes (for upload mode) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Internal Notes <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any internal notes about this offer..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>📧 What happens next:</strong> The candidate will receive an email with your uploaded offer letter document attached. The application status will be changed to "Offered".
                </p>
              </div>
            </div>
          )}

          {/* Form Mode */}
          {mode === 'form' && (
            <>
          {/* Position Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Position Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position / Rank <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  placeholder="e.g., Chief Engineer"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vessel Type
                </label>
                <input
                  type="text"
                  value={formData.vesselType}
                  onChange={(e) => handleChange('vesselType', e.target.value)}
                  placeholder="e.g., Container Ship"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vessel Name <span className="text-gray-400">(if assigned)</span>
              </label>
              <input
                type="text"
                value={formData.vesselName}
                onChange={(e) => handleChange('vesselName', e.target.value)}
                placeholder="e.g., MV Ocean Explorer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Compensation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Compensation Package</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Salary <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => handleChange('salary', e.target.value)}
                  placeholder="e.g., 5000"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Benefits <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={formData.additionalBenefits}
                onChange={(e) => handleChange('additionalBenefits', e.target.value)}
                placeholder="e.g., Health insurance, Annual leave allowance, Flight tickets, etc."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Contract Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Contract Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Duration <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.contractDuration}
                  onChange={(e) => handleChange('contractDuration', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select duration</option>
                  <option value="3 months">3 Months</option>
                  <option value="4 months">4 Months</option>
                  <option value="6 months">6 Months</option>
                  <option value="9 months">9 Months</option>
                  <option value="12 months">12 Months</option>
                  <option value="24 months">24 Months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Joining Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => handleChange('joiningDate', e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internal Notes <span className="text-gray-400">(Not sent to candidate)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any internal notes about this offer..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>📧 What happens next:</strong> The candidate will receive an offer letter email with all the details above. 
              The application status will be changed to "Offered".
            </p>
          </div>
          </>
          )}

          {/* Action Buttons */}
          <div className="recruiter-modal__footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="workspace-action-button workspace-action-button--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="workspace-action-button workspace-action-button--primary min-w-[12rem] justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending Offer...
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  Send Offer Letter
                </>
              )}
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
  )
}
