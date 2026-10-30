import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Tag, UserX, CheckCircle } from 'lucide-react';
// FIX: Import the named export directly since we are using it that way
import { sendRejectionEmail } from '../../services/emailService';

/**
 * RejectionModal Component
 * Allows recruiters to reject applications with rich metadata:
 * - Rejection category (9 options)
 * - Predefined tags (15 maritime-specific tags)
 * - Custom tags (free text)
 * - Contact for future roles flag
 * - Detailed notes
 */

const RejectionModal = ({ 
  isOpen, 
  onClose, 
  applicant, // FIX: Renamed from 'application' to match Dashboard
  onConfirm  // FIX: Renamed from 'onReject' to match Dashboard
}) => {
  // State
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [selectedPredefinedTags, setSelectedPredefinedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState([]);
  const [contactForFutureRoles, setContactForFutureRoles] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Rejection categories (matches DB enum)
  const rejectionCategories = [
    { value: 'unqualified', label: 'Unqualified', icon: '❌', description: 'Does not meet basic requirements' },
    { value: 'failed_assessment', label: 'Failed Assessment', icon: '📝', description: 'Did not pass test/assessment' },
    { value: 'failed_interview', label: 'Failed Interview', icon: '💬', description: 'Did not perform well in interview' },
    { value: 'no_show', label: 'No Show', icon: '⏰', description: 'Did not attend scheduled interview/test' },
    { value: 'overqualified', label: 'Overqualified', icon: '⭐', description: 'Too experienced for this position' },
    { value: 'wrong_role', label: 'Wrong Role', icon: '🔄', description: 'Better suited for different position' },
    { value: 'future_consideration', label: 'Future Consideration', icon: '🔮', description: 'Good candidate, wrong timing' },
    { value: 'withdrew', label: 'Withdrew', icon: '👋', description: 'Candidate withdrew application' },
    { value: 'other', label: 'Other', icon: '📋', description: 'Other reason (specify in notes)' },
  ];

  // Predefined tags (matches DB enum)
  const predefinedTags = [
    { value: '2nd_officer_candidate', label: '2nd Officer Candidate', category: 'rank' },
    { value: 'chief_officer_candidate', label: 'Chief Officer Candidate', category: 'rank' },
    { value: '3rd_officer_candidate', label: '3rd Officer Candidate', category: 'rank' },
    { value: 'engineer_candidate', label: 'Engineer Candidate', category: 'rank' },
    { value: 'deck_crew_candidate', label: 'Deck Crew Candidate', category: 'rank' },
    { value: 'strong_technical', label: 'Strong Technical Skills', category: 'skill' },
    { value: 'strong_leadership', label: 'Strong Leadership', category: 'skill' },
    { value: 'excellent_communication', label: 'Excellent Communication', category: 'skill' },
    { value: 'needs_more_experience', label: 'Needs More Experience', category: 'note' },
    { value: 'contact_for_other_roles', label: 'Contact for Other Roles', category: 'note' },
    { value: 'tanker_experience', label: 'Tanker Experience', category: 'vessel' },
    { value: 'container_experience', label: 'Container Experience', category: 'vessel' },
    { value: 'bulk_carrier_experience', label: 'Bulk Carrier Experience', category: 'vessel' },
    { value: 'lng_experience', label: 'LNG Experience', category: 'vessel' },
    { value: 'chemical_tanker_experience', label: 'Chemical Tanker Experience', category: 'vessel' },
  ];

  // Group tags by category
  const tagsByCategory = predefinedTags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {});

  const categoryLabels = {
    rank: 'Rank Suitability',
    skill: 'Skills & Strengths',
    note: 'General Notes',
    vessel: 'Vessel Experience',
  };

  // Handlers
  const togglePredefinedTag = (tagValue) => {
    setSelectedPredefinedTags(prev => 
      prev.includes(tagValue)
        ? prev.filter(t => t !== tagValue)
        : [...prev, tagValue]
    );
  };

  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !customTags.includes(trimmed)) {
      setCustomTags([...customTags, trimmed]);
      setCustomTagInput('');
    }
  };

  const removeCustomTag = (tagToRemove) => {
    setCustomTags(customTags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async () => {
    if (!rejectionCategory) {
      alert('Please select a rejection category');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // FIX: Robust name handling
      const applicantName = applicant?.name || applicant?.firstName || 'Applicant';

      // FIX: Call service with merged object pattern
      await sendRejectionEmail({
        to: applicant.email,
        name: applicantName,
        reason: rejectionCategory,
        customMessage: notes,
        position: applicant.position || 'N/A',
        contactForFutureRoles: contactForFutureRoles
      });

      // FIX: Call onConfirm (renamed from onReject)
      await onConfirm({
        applicationId: applicant.id,
        status: 'rejected',
        rejectionCategory,
        predefinedTags: selectedPredefinedTags,
        customTags,
        contactForFutureRoles,
        rejectionNotes: notes,
        rejectedAt: new Date().toISOString(),
      });
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert('Failed to reject application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setRejectionCategory('');
    setSelectedPredefinedTags([]);
    setCustomTags([]);
    setCustomTagInput('');
    setContactForFutureRoles(false);
    setNotes('');
  };

  const handleClose = () => {
    if (rejectionCategory || notes) {
      if (window.confirm('Are you sure you want to close? All changes will be lost.')) {
        resetForm();
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="recruiter-modal-backdrop overflow-y-auto">
      <div className="recruiter-modal my-auto max-w-4xl">
        
        {/* Header */}
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <UserX className="h-6 w-6" />
            </div>
            <div>
              <h2 className="recruiter-modal__title">Reject application</h2>
              <p className="recruiter-modal__subtitle">
                {applicant?.name || applicant?.applicant_name || 'Unknown Candidate'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="recruiter-modal__close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="recruiter-modal__body max-h-[calc(90vh-176px)]">
          
          {/* Warning Banner */}
          <div className="recruiter-note recruiter-note--danger mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="recruiter-note__title">
                This action cannot be undone
              </p>
              <p className="recruiter-note__body">
                The candidate is notified by email.
              </p>
            </div>
          </div>

          {/* Section 1: Rejection Category */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-fg mb-3">
              Rejection Category <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rejectionCategories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setRejectionCategory(category.value)}
                  className={`
 p-4 rounded-lg border-2 text-left transition-all
 ${rejectionCategory === category.value
 ? 'border-danger bg-danger-soft '
 : 'border-line hover:border-line-input hover:bg-raised'
 }
 `}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-fg text-sm">
                        {category.label}
                      </div>
                      <div className="text-xs text-fg-secondary mt-1 line-clamp-2">
                        {category.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Predefined Tags */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-fg mb-3">
              Predefined Tags (Optional)
            </label>
            
            {Object.entries(tagsByCategory).map(([category, tags]) => (
              <div key={category} className="mb-4">
                <h4 className="text-xs font-semibold text-fg-secondary mb-2">
                  {categoryLabels[category]}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => togglePredefinedTag(tag.value)}
                      className={`
 px-3 py-1.5 rounded-full text-sm font-medium transition-all
 ${selectedPredefinedTags.includes(tag.value)
 ? 'bg-accent-fill text-on-accent '
 : 'bg-raised text-fg-secondary hover:bg-line'
 }
 `}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Section 3: Custom Tags */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-fg mb-3">
              Custom Tags (Optional)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
                placeholder="Type and press Enter..."
                className="flex-1 px-4 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="px-4 py-2 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-fill-hover transition-colors font-medium"
              >
                Add
              </button>
            </div>
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-progress-soft text-progress rounded-full text-sm font-medium"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {tag}
                    <button
                      onClick={() => removeCustomTag(tag)}
                      className="hover:bg-progress-soft rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Contact for Future Roles */}
          <div className="mb-6">
            <label className="flex items-start gap-3 p-4 bg-success-soft border border-success-line rounded-lg cursor-pointer hover:bg-success-soft transition-colors">
              <input
                type="checkbox"
                checked={contactForFutureRoles}
                onChange={(e) => setContactForFutureRoles(e.target.checked)}
                className="mt-1 w-4 h-4 text-success border-line-input rounded focus:ring-success/40"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="font-semibold text-fg text-sm">
                    Contact for Future Roles
                  </span>
                </div>
                <p className="text-sm text-fg-secondary mt-1">Shows up in Find Past Candidates.</p>
              </div>
            </label>
          </div>

          {/* Section 5: Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-fg mb-3">
              Rejection Notes {rejectionCategory === 'other' && <span className="text-danger">*</span>}
            </label>
            <p className="text-sm text-fg-secondary mb-3">
              Provide detailed feedback for internal records
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., 'Great technical skills but lacks sufficient experience for Chief Officer role. Consider for 2nd Officer positions in 2 years.'"
              rows={4}
              className="w-full px-4 py-3 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
            <div className="mt-2 text-xs text-fg-muted">
              {notes.length} characters
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="recruiter-modal__footer justify-between">
          <button
            onClick={handleClose}
            className="workspace-action-button workspace-action-button--secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!rejectionCategory || isSubmitting}
            className={`
 px-6 py-2 rounded-lg font-medium transition-all
 ${!rejectionCategory || isSubmitting
 ? 'bg-line-strong text-fg-muted cursor-not-allowed'
 : 'border border-danger-line bg-danger-soft text-danger hover:border-danger '
 }
 `}
          >
            {isSubmitting ? 'Rejecting...' : 'Reject Application'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectionModal;
