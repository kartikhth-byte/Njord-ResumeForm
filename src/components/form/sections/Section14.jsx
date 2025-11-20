import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const STCW_COURSE_OPTIONS = [
  { value: 'Basic Training (VI/1)', label: 'Basic Training (VI/1)' },
  { value: 'Personal Survival Techniques', label: 'Personal Survival Techniques' },
  { value: 'Fire Prevention and Fire Fighting', label: 'Fire Prevention and Fire Fighting' },
  { value: 'Elementary First Aid', label: 'Elementary First Aid' },
  { value: 'Personal Safety and Social Responsibilities', label: 'Personal Safety and Social Responsibilities' },
  { value: 'Security Awareness (VI/6-1)', label: 'Security Awareness (VI/6-1)' },
  { value: 'Designated Security Duties (VI/6-2)', label: 'Designated Security Duties (VI/6-2)' },
  { value: 'Ship Security Officer (VI/5)', label: 'Ship Security Officer (VI/5)' },
  { value: 'Proficiency in Survival Craft and Rescue Boats (VI/2-1)', label: 'Proficiency in Survival Craft and Rescue Boats (VI/2-1)' },
  { value: 'Advanced Fire Fighting (VI/3)', label: 'Advanced Fire Fighting (VI/3)' },
  { value: 'Medical First Aid (VI/4-1)', label: 'Medical First Aid (VI/4-1)' },
  { value: 'Medical Care (VI/4-2)', label: 'Medical Care (VI/4-2)' },
  { value: 'GMDSS/GOC', label: 'GMDSS General Operator Certificate (GOC)' },
  { value: 'GMDSS/ROC', label: 'GMDSS Restricted Operator Certificate (ROC)' },
  { value: 'Bridge Resource Management (BRM)', label: 'Bridge Resource Management (BRM)' },
  { value: 'Engine Resource Management (ERM)', label: 'Engine Resource Management (ERM)' },
  { value: 'Bridge Team Management (BTM)', label: 'Bridge Team Management (BTM)' },
  { value: 'Electronic Chart Display and Information System (ECDIS)', label: 'ECDIS' },
  { value: 'Radar Navigation (Operational Level)', label: 'Radar Navigation (Operational Level)' },
  { value: 'Radar Navigation (Management Level)', label: 'Radar Navigation (Management Level)' },
  { value: 'ARPA (Automatic Radar Plotting Aids)', label: 'ARPA (Automatic Radar Plotting Aids)' },
  { value: 'High Voltage Safety', label: 'High Voltage Safety' },
  { value: 'Tanker Familiarization', label: 'Tanker Familiarization' },
  { value: 'Oil Tanker - Cargo Operations (Advanced)', label: 'Oil Tanker - Cargo Operations (Advanced)' },
  { value: 'Chemical Tanker - Cargo Operations (Advanced)', label: 'Chemical Tanker - Cargo Operations (Advanced)' },
  { value: 'Liquefied Gas Tanker - Cargo Operations (Advanced)', label: 'Liquefied Gas Tanker - Cargo Operations (Advanced)' },
  { value: 'Crowd Management', label: 'Crowd Management' },
  { value: 'Crisis Management and Human Behavior', label: 'Crisis Management and Human Behavior' },
  { value: 'Passenger Ship Safety', label: 'Passenger Ship Safety' },
  { value: 'Ro-Ro Passenger Ship Safety', label: 'Ro-Ro Passenger Ship Safety' },
  { value: 'Dynamic Positioning (Basic)', label: 'Dynamic Positioning (Basic)' },
  { value: 'Dynamic Positioning (Advanced)', label: 'Dynamic Positioning (Advanced)' },
  { value: 'Offshore Installation Manager', label: 'Offshore Installation Manager' },
  { value: 'Offshore Crane Operator', label: 'Offshore Crane Operator' },
  { value: 'Proficiency in Crisis Management and Human Behavior', label: 'Proficiency in Crisis Management and Human Behavior' },
  { value: 'Leadership and Managerial Skills', label: 'Leadership and Managerial Skills' },
  { value: 'Other', label: 'Other (Please specify in comments)' },
]

const emptyCourse = {
  courseName: '',
  issuingAuthority: '',
  certificateNumber: '',
  placeOfIssue: '',
  dateOfIssue: '',
  dateOfExpiry: '',
}

export default function Section14({ data = {}, onUpdate }) {
  const [courses, setCourses] = useState(data.courses || [])

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.courses) {
      setCourses(data.courses)
    }
  }, [data])

  const handleAddCourse = () => {
    const newCourses = [...courses, { ...emptyCourse }]
    setCourses(newCourses)
    onUpdate({ section14: { courses: newCourses } })
  }

  const handleRemoveCourse = (index) => {
    const newCourses = courses.filter((_, i) => i !== index)
    setCourses(newCourses)
    onUpdate({ section14: { courses: newCourses } })
  }

  const handleCourseChange = (index, field, value) => {
    const newCourses = [...courses]
    newCourses[index] = {
      ...newCourses[index],
      [field]: value
    }
    setCourses(newCourses)
    onUpdate({ section14: { courses: newCourses } })
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Section 14: STCW Courses & Competencies</h2>
        <p className="text-gray-600 mt-1">
          List all your STCW certificates and maritime training courses
        </p>
      </div>

      {/* Courses List */}
      <div className="space-y-6">
        {courses.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-600 mb-2">No STCW courses added yet</p>
            <p className="text-sm text-gray-500 mb-4">Add your mandatory and additional training certificates</p>
            <button
              onClick={handleAddCourse}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add STCW Course
            </button>
          </div>
        ) : (
          <>
            {courses.map((course, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Course Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    STCW Course {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveCourse(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Course Fields */}
                <div className="space-y-4">
                  <FormSelect
                    label="Course Name"
                    name={`course-${index}-courseName`}
                    required
                    value={course.courseName}
                    onChange={(e) => handleCourseChange(index, 'courseName', e.target.value)}
                    options={STCW_COURSE_OPTIONS}
                    helpText="Select from the list or choose 'Other' to specify"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Issuing Authority"
                      name={`course-${index}-issuingAuthority`}
                      required
                      value={course.issuingAuthority}
                      onChange={(e) => handleCourseChange(index, 'issuingAuthority', e.target.value)}
                      placeholder="e.g., MAERSK Training, MCA, DG Shipping"
                      helpText="Training institution or authority"
                    />

                    <FormInput
                      label="Certificate Number"
                      name={`course-${index}-certificateNumber`}
                      required
                      value={course.certificateNumber}
                      onChange={(e) => handleCourseChange(index, 'certificateNumber', e.target.value)}
                      placeholder="e.g., STCW123456"
                    />
                  </div>

                  <FormInput
                    label="Place of Issue"
                    name={`course-${index}-placeOfIssue`}
                    required
                    value={course.placeOfIssue}
                    onChange={(e) => handleCourseChange(index, 'placeOfIssue', e.target.value)}
                    placeholder="e.g., Mumbai, India"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="Date of Issue"
                      name={`course-${index}-dateOfIssue`}
                      required
                      value={course.dateOfIssue}
                      onChange={(e) => handleCourseChange(index, 'dateOfIssue', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`course-${index}-dateOfExpiry`}
                      required
                      value={course.dateOfExpiry}
                      onChange={(e) => handleCourseChange(index, 'dateOfExpiry', e.target.value)}
                      min={course.dateOfIssue || new Date().toISOString().split('T')[0]}
                      helpText="Most STCW certificates expire after 5 years"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddCourse}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another STCW Course</span>
            </button>
          </>
        )}
      </div>

      {/* Info Boxes */}
      <div className="space-y-4">
        {/* Mandatory Courses Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">
                Mandatory STCW Courses
              </h3>
              <p className="text-sm text-amber-800 mb-2">
                All seafarers must have the following STCW VI/1 Basic Training certificates:
              </p>
              <ul className="text-sm text-amber-800 list-disc list-inside space-y-1">
                <li>Personal Survival Techniques</li>
                <li>Fire Prevention and Fire Fighting</li>
                <li>Elementary First Aid</li>
                <li>Personal Safety and Social Responsibilities</li>
                <li>Security Awareness Training</li>
              </ul>
            </div>
          </div>
        </div>

        {/* General Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Important Information
              </h3>
              <p className="text-sm text-blue-800">
                Most STCW certificates are valid for 5 years and must be revalidated before expiry. Ensure all your certificates are current and upload copies during the documentation phase. Advanced courses like Medical Care, Advanced Fire Fighting, and ECDIS may be required depending on your rank and vessel type.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}