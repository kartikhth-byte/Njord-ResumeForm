import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'
import {
  createEmptySection14Course,
  getSection14CourseMetadata,
  normalizeSection14Courses,
  SECTION14_COURSE_OPTIONS,
} from '../../../constants/section14Courses'

export default function Section14({ data = {}, onUpdate }) {
  const [courses, setCourses] = useState(normalizeSection14Courses(data.courses))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (data && Array.isArray(data.courses)) {
      const normalizedCourses = normalizeSection14Courses(data.courses)
      setCourses(prevCourses => (
        normalizedCourses.length === 0 && prevCourses.length > 0 ? prevCourses : normalizedCourses
      ))

      if (JSON.stringify(data.courses) !== JSON.stringify(normalizedCourses)) {
        onUpdate({ section14: { courses: normalizedCourses } })
      }
    }
  }, [data, onUpdate])

  // Helper function to validate year in date
  const validateYear = (dateString) => {
    if (!dateString) return null
    const year = dateString.split('-')[0]
    if (year.length !== 4) return 'Year must be 4 digits'
    const yearNum = parseInt(year, 10)
    if (yearNum < 1900 || yearNum > 2100) return 'Year must be between 1900 and 2100'
    return null
  }

  const validateCourseField = (index, field, value) => {
    switch (field) {
      case 'courseName':
        return !value ? 'Course name is required' : ''
      case 'certificateNumber':
        return !value ? 'Certificate number is required' : ''
      case 'dateOfIssue': {
        if (!value) return 'Date of issue is required'
        const issueYearError = validateYear(value)
        if (issueYearError) return issueYearError
        return ''
      }
      case 'dateOfExpiry': {
        if (!value) return 'Date of expiry is required'
        const expiryYearError = validateYear(value)
        if (expiryYearError) return expiryYearError
        if (courses[index]?.dateOfIssue && value <= courses[index].dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''
      }
      default:
        return ''
    }
  }

  const handleAddCourse = () => {
    const newCourses = [...courses, createEmptySection14Course()]
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
    const currentCourse = newCourses[index] || createEmptySection14Course()

    if (field === 'courseName') {
      const metadata = getSection14CourseMetadata(value)
      newCourses[index] = {
        ...currentCourse,
        courseName: value,
        imoModelCourse: metadata.imoModelCourse,
        referenceRegulation: metadata.referenceRegulation,
      }
    } else {
      newCourses[index] = {
        ...currentCourse,
        [field]: value
      }
    }

    setCourses(newCourses)

    const key = `course-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))

    const error = validateCourseField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))

    onUpdate({ section14: { courses: newCourses } })
  }

  const handleBlur = (index, field) => {
    const key = `course-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = courses[index]?.[field]
    const error = validateCourseField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <p className="applicant-section-kicker">Training</p>
        <h2 className="applicant-section-title">STCW courses and competencies</h2>
        <p className="applicant-section-copy">
          List all your STCW certificates and maritime training courses
        </p>
      </div>

      {/* Courses List */}
      <div className="space-y-6">
        {courses.length === 0 ? (
          <div className="applicant-empty-state">
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
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add STCW Course
            </button>
          </div>
        ) : (
          <>
            {courses.map((course, index) => (
              <div key={index} className="applicant-record-card">
                {/* Course Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">STCW Course {index + 1}</h3>
                    <p className="applicant-record-card__subtitle">
                      Select a course and enter the certificate number and validity dates.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveCourse(index)}
                    className="applicant-action applicant-action--secondary"
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
                    onBlur={() => handleBlur(index, 'courseName')}
                    options={SECTION14_COURSE_OPTIONS}
                    helpText="Select the course that matches the certificate you are entering"
                    error={touched[`course-${index}-courseName`] ? errors[`course-${index}-courseName`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="IMO Model Course"
                      name={`course-${index}-imoModelCourse`}
                      value={course.imoModelCourse || ''}
                      readOnly
                      aria-readonly="true"
                      placeholder="Auto-filled from selected course"
                      helpText={course.imoModelCourse ? 'Auto-filled from selected course' : 'No mapped IMO model course for this selection'}
                    />

                    <FormInput
                      label="Reference- Regulation"
                      name={`course-${index}-referenceRegulation`}
                      value={course.referenceRegulation || ''}
                      readOnly
                      aria-readonly="true"
                      placeholder="Auto-filled from selected course"
                      helpText={course.referenceRegulation ? 'Auto-filled from selected course' : 'No mapped reference regulation for this selection'}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Certificate Number"
                      name={`course-${index}-certificateNumber`}
                      required
                      value={course.certificateNumber}
                      onChange={(e) => handleCourseChange(index, 'certificateNumber', e.target.value)}
                      onBlur={() => handleBlur(index, 'certificateNumber')}
                      placeholder="e.g., STCW123456"
                      error={touched[`course-${index}-certificateNumber`] ? errors[`course-${index}-certificateNumber`] : ''}
                    />

                    <FormDatePicker
                      label="Date of Issue"
                      name={`course-${index}-dateOfIssue`}
                      required
                      value={course.dateOfIssue}
                      onChange={(e) => handleCourseChange(index, 'dateOfIssue', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfIssue')}
                      max={new Date().toISOString().split('T')[0]}
                      error={touched[`course-${index}-dateOfIssue`] ? errors[`course-${index}-dateOfIssue`] : ''}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`course-${index}-dateOfExpiry`}
                      required
                      value={course.dateOfExpiry}
                      onChange={(e) => handleCourseChange(index, 'dateOfExpiry', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfExpiry')}
                      min={course.dateOfIssue || new Date().toISOString().split('T')[0]}
                      helpText="Must be after date of issue"
                      error={touched[`course-${index}-dateOfExpiry`] ? errors[`course-${index}-dateOfExpiry`] : ''}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddCourse}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-slate-300"
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
        <div className="applicant-section-card applicant-section-card--muted">
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
        <div className="applicant-section-card applicant-section-card--muted">
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
                Course reference fields are managed automatically from the selected course. Enter the certificate number and validity dates exactly as shown on the certificate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
