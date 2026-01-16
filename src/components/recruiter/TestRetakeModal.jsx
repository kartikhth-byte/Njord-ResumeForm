import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle, FileText, Clock } from 'lucide-react';
import { sendTestRetakeApprovedEmail, sendTestFailedEmail } from '../services/emailService';


/**
 * TestRetakeModal Component
 * 
 * Allows recruiters to approve or reject test retake requests after a candidate fails a test.
 * 
 * Features:
 * - Shows test attempt status (1/2 or 2/2)
 * - Display test score/result
 * - Approve retake (allows one more attempt)
 * - Reject application (permanent rejection)
 * - Notes field for decision rationale
 * 
 * Usage:
 * <TestRetakeModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   application={selectedApplication}
 *   onApproveRetake={handleApproveRetake}
 *   onRejectApplication={handleRejectApplication}
 * />
 */

const TestRetakeModal = ({ 
  isOpen, 
  onClose, 
  application,
  onApproveRetake,
  onRejectApplication 
}) => {
  // State
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState(null); // 'approve' or 'reject'

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }

    // Cleanup on unmount
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Calculate attempt info
  const currentAttempt = application?.test_attempt_number || 0;
  const maxAttempts = application?.test_max_attempts || 2;
  const isLastAttempt = currentAttempt >= maxAttempts;
  const canRetake = currentAttempt < maxAttempts;

  // Handle Approve Retake
  const handleApprove = async () => {
    if (!canRetake) {
      alert('Maximum test attempts reached. Cannot approve retake.');
      return;
    }

    setAction('approve');
    setIsSubmitting(true);

    const testLink = `${window.location.origin}/test/${application.id}`;
    await sendTestRetakeApprovedEmail(application, testLink);

    try {
      await onApproveRetake({
        applicationId: application.id,
        notes: notes.trim(),
        currentAttempt,
        nextAttempt: currentAttempt + 1,
      });
      
      // Reset and close
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error approving retake:', error);
      alert('Failed to approve retake. Please try again.');
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  // Handle Reject Application
  const handleReject = async () => {
    if (!notes.trim()) {
      alert('Please provide notes explaining why the application is being rejected.');
      return;
    }

    if (!window.confirm('Are you sure you want to reject this application? This action cannot be undone.')) {
      return;
    }

    setAction('reject');
    setIsSubmitting(true);

    await sendTestFailedEmail(application);

    try {
      await onRejectApplication({
        applicationId: application.id,
        rejectionCategory: 'failed_assessment',
        rejectionNotes: notes.trim(),
        testAttempts: currentAttempt,
      });
      
      // Reset and close
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert('Failed to reject application. Please try again.');
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  const resetForm = () => {
    setNotes('');
    setAction(null);
  };

  const handleClose = () => {
    if (notes.trim() && !window.confirm('Are you sure you want to close? Your notes will be lost.')) {
      return;
    }
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Test Retake Decision</h2>
              <p className="text-orange-100 text-sm">
                {application?.applicant_name || 'Unknown Candidate'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Test Status Card */}
          <div className="mb-6 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Test Result</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>Reference: {application?.reference_number}</span>
                </div>
              </div>
              <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold">
                FAILED
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Test Attempts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {currentAttempt} / {maxAttempts}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <p className="text-sm font-semibold text-red-600">
                  {isLastAttempt ? 'Final Attempt Used' : 'Retake Available'}
                </p>
              </div>
            </div>
          </div>

          {/* Decision Info Banner */}
          {canRetake ? (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Retake Available</p>
                  <p className="text-sm text-blue-700 mt-1">
                    This candidate has <strong>1 attempt remaining</strong>. You can approve a retake or reject the application.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">Maximum Attempts Reached</p>
                  <p className="text-sm text-red-700 mt-1">
                    This candidate has used all <strong>{maxAttempts} attempts</strong>. The application must be rejected.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Decision Notes {!canRetake && <span className="text-red-600">*</span>}
            </label>
            <p className="text-sm text-gray-600 mb-3">
              {canRetake 
                ? 'Provide context for your decision (optional but recommended)'
                : 'Explain the rejection reason for internal records (required)'
              }
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={canRetake 
                ? "e.g., 'Candidate showed effort but needs more preparation. Allowing one more attempt.'" 
                : "e.g., 'Failed both attempts. Insufficient technical knowledge for the position.'"
              }
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="mt-2 text-xs text-gray-500">
              {notes.length} characters
            </div>
          </div>

          {/* Test Details (if available) */}
          {application?.test_score && (
            <div className="mb-6 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Test Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Score</p>
                  <p className="font-semibold text-gray-900">{application.test_score}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Passing Score</p>
                  <p className="font-semibold text-gray-900">{application.passing_score || 70}%</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer - Action Buttons */}
        <div className="border-t bg-gray-50 px-6 py-4">
          {canRetake ? (
            <div className="flex items-center justify-between">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className={`
                    flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all
                    ${isSubmitting && action === 'reject'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
                    }
                  `}
                >
                  <XCircle className="w-4 h-4" />
                  {isSubmitting && action === 'reject' ? 'Rejecting...' : 'Reject Application'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className={`
                    flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all
                    ${isSubmitting && action === 'approve'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                    }
                  `}
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSubmitting && action === 'approve' ? 'Approving...' : 'Approve Retake'}
                </button>
              </div>
            </div>
          ) : (
            // If no retakes left, only show reject button
            <div className="flex items-center justify-between">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !notes.trim()}
                className={`
                  flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all
                  ${isSubmitting || !notes.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
                  }
                `}
              >
                <XCircle className="w-4 h-4" />
                {isSubmitting ? 'Rejecting...' : 'Reject Application'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestRetakeModal;