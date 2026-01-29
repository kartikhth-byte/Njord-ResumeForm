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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <UserX className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Reject Application</h2>
              <p className="text-red-100 text-sm">
                {/* FIX: Use applicant prop */}
                {applicant?.name || applicant?.applicant_name || 'Unknown Candidate'}
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

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          
          {/* Warning Banner */}
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-900 font-medium">
                This action cannot be undone
              </p>
              <p className="text-sm text-red-700 mt-1">
                The candidate will be notified via email. Please provide detailed feedback to help maintain a positive candidate experience.
              </p>
            </div>
          </div>

          {/* Section 1: Rejection Category */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Rejection Category <span className="text-red-600">*</span>
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
                      ? 'border-red-600 bg-red-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {category.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
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
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Predefined Tags (Optional)
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Select relevant tags to categorize this candidate for future reference
            </p>
            
            {Object.entries(tagsByCategory).map(([category, tags]) => (
              <div key={category} className="mb-4">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
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
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Custom Tags (Optional)
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Add custom tags for specific notes (e.g., "Mumbai based", "Speaks Hindi")
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
                placeholder="Type and press Enter..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add
              </button>
            </div>
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {tag}
                    <button
                      onClick={() => removeCustomTag(tag)}
                      className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
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
            <label className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
              <input
                type="checkbox"
                checked={contactForFutureRoles}
                onChange={(e) => setContactForFutureRoles(e.target.checked)}
                className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-gray-900 text-sm">
                    Contact for Future Roles
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  Mark this candidate for future consideration. They will appear in "Find Past Candidates" searches.
                </p>
              </div>
            </label>
          </div>

          {/* Section 5: Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Rejection Notes {rejectionCategory === 'other' && <span className="text-red-600">*</span>}
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Provide detailed feedback for internal records
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., 'Great technical skills but lacks sufficient experience for Chief Officer role. Consider for 2nd Officer positions in 2 years.'"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="mt-2 text-xs text-gray-500">
              {notes.length} characters
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!rejectionCategory || isSubmitting}
            className={`
              px-6 py-2 rounded-lg font-medium transition-all
              ${!rejectionCategory || isSubmitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg'
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