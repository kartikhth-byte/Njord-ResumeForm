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
        <h2 className="applicant-section-title">STCW courses and competencies</h2>
      </div>

      <p className="applicant-field__help">
        Required for everyone (STCW VI/1 Basic Training): Personal Survival Techniques, Fire Prevention and Fire Fighting,
        Elementary First Aid, Personal Safety and Social Responsibilities, Security Awareness Training.
      </p>

      {/* Courses List */}
      <div className="space-y-6">
        {courses.length === 0 ? (
          <div className="applicant-empty-state">
            <svg
              className="w-12 h-12 text-fg-muted mx-auto mb-4"
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
            <p className="text-fg-secondary mb-2">No STCW courses added yet</p>
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
                    error={touched[`course-${index}-courseName`] ? errors[`course-${index}-courseName`] : ''}
                  />

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
                      error={touched[`course-${index}-dateOfExpiry`] ? errors[`course-${index}-dateOfExpiry`] : ''}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddCourse}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-line-input"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another STCW Course</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
