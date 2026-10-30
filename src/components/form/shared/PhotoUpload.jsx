import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, X, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'

export default function PhotoUpload({ currentPhotoPath, onPhotoUploaded }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(currentPhotoPath ? getPhotoUrl(currentPhotoPath) : null)
  const fileInputRef = useRef(null)

  function getPhotoUrl(path) {
    if (!path) return null
    const { data } = supabase.storage.from('application-photos').getPublicUrl(path)
    return data.publicUrl
  }

  // Update preview when currentPhotoPath prop changes (e.g., after loading from database)
  useEffect(() => {
    console.log('🖼️ PhotoUpload: currentPhotoPath changed to:', currentPhotoPath)
    if (currentPhotoPath) {
      const url = getPhotoUrl(currentPhotoPath)
      console.log('🖼️ PhotoUpload: Setting preview URL to:', url)
      setPreviewUrl(url)
    } else {
      console.log('🖼️ PhotoUpload: No photo path, clearing preview')
      setPreviewUrl(null)
    }
  }, [currentPhotoPath])

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('📸 PhotoUpload: File selected:', file.name, file.type, file.size)

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG or PNG)')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    try {
      setUploading(true)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        console.log('📸 PhotoUpload: Preview created')
        setPreviewUrl(e.target.result)
      }
      reader.readAsDataURL(file)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      console.log('📸 PhotoUpload: Uploading to:', filePath)

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('application-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      console.log('✅ PhotoUpload: Upload successful, path:', filePath)

      // Callback with the file path
      onPhotoUploaded(filePath)

    } catch (error) {
      console.error('❌ PhotoUpload: Error uploading photo:', error)
      alert('Failed to upload photo. Please try again.')
      setPreviewUrl(currentPhotoPath ? getPhotoUrl(currentPhotoPath) : null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!currentPhotoPath) {
      setPreviewUrl(null)
      return
    }

    try {
      // Delete from storage
      const { error } = await supabase.storage
        .from('application-photos')
        .remove([currentPhotoPath])

      if (error) throw error

      setPreviewUrl(null)
      onPhotoUploaded(null)
    } catch (error) {
      console.error('Error removing photo:', error)
      alert('Failed to remove photo. Please try again.')
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-fg-secondary">
        Passport Photo
      </label>

      <div className="flex items-start gap-4">
        {/* Preview or Upload Area */}
        <div className="relative">
          {previewUrl ? (
            // Photo Preview
            <div className="relative w-32 h-40 border-2 border-line-input rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="Passport photo"
                className="w-full h-full object-cover"
              />
              {!uploading && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-1 right-1 p-1 bg-danger text-bg rounded-full hover:bg-danger transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            // Upload Area
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-32 h-40 border-2 border-dashed border-line-input rounded-lg flex flex-col items-center justify-center hover:border-accent hover:bg-accent-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 text-accent-text animate-spin" />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-fg-muted mb-2" />
                  <span className="text-xs text-fg-muted text-center px-2">
                    Click to upload
                  </span>
                </>
              )}
            </button>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Instructions */}
        <div className="flex-1">
          <div className="text-sm text-fg-secondary space-y-1">
            <p className="font-medium text-fg-secondary">Photo Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Recent passport-size photo</li>
              <li>Clear face, looking at camera</li>
              <li>Plain background (white or light colored)</li>
              <li>File format: JPG or PNG</li>
              <li>Maximum size: 5MB</li>
            </ul>
          </div>
          
          {!previewUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent-text hover:bg-accent-soft rounded-lg transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Choose Photo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}