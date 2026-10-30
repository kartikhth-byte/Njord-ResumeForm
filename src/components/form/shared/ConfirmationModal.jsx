import { X, AlertTriangle, CheckCircle } from 'lucide-react'

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel', isLoading = false }) {
  if (!isOpen) return null

  const typeStyles = {
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-warning',
      bgColor: 'bg-warning-soft',
      borderColor: 'border-warning-line',
      buttonColor: 'bg-warning hover:bg-warning',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-success',
      bgColor: 'bg-success-soft',
      borderColor: 'border-success-line',
      buttonColor: 'bg-success hover:bg-success',
    },
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-danger',
      bgColor: 'bg-danger-soft',
      borderColor: 'border-danger-line',
      buttonColor: 'bg-danger hover:bg-danger',
    },
  }

  const style = typeStyles[type]
  const Icon = style.icon

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface rounded-lg max-w-md w-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-fg-muted hover:text-fg-secondary"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Icon */}
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${style.bgColor} ${style.borderColor} border`}>
              <Icon className={`h-6 w-6 ${style.iconColor}`} />
            </div>

            {/* Title */}
            <h3 className="mt-4 text-lg font-semibold text-fg text-center">
              {title}
            </h3>

            {/* Message */}
            <div className="mt-2 text-sm text-fg-secondary text-center">
              {message}
            </div>

            {/* Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-line-input text-fg-secondary rounded-lg hover:bg-raised transition-colors font-medium"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2 text-fg rounded-lg transition-colors font-medium ${style.buttonColor} disabled:bg-fg-muted disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </span>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}