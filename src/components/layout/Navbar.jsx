import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ChevronDown, Menu } from 'lucide-react'

const SECTIONS = [
  { number: 1, name: 'Availability Details' },
  { number: 2, name: 'Personal & Contact Details' },
  { number: 3, name: 'Passport Details' },
  { number: 4, name: 'CDC Details' },
  { number: 5, name: 'Vaccination Status' },
  { number: 6, name: 'Certificates of Competency' },
  { number: 7, name: 'Tanker Experience' },
  { number: 8, name: 'STCW Courses' },
  { number: 9, name: 'Additional Training' },
  { number: 10, name: 'Sea Service' },
  { number: 11, name: 'Additional Information' },
  { number: 12, name: 'Declaration' },
]

export default function Navbar({ onMobileMenuToggle, currentSection = 1 }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSectionDropdown, setShowSectionDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const sectionDropdownRef = useRef(null)
  const userMenuRef = useRef(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(event.target)) {
        setShowSectionDropdown(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSectionClick = (sectionNumber) => {
    navigate(`/application/form/section/${sectionNumber}`)
    setShowSectionDropdown(false)
  }

  const isInForm = location.pathname.includes('/application/form')

  return (
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Mobile Menu Button */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button - Only show in form */}
            {isInForm && (
              <button
                onClick={onMobileMenuToggle}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}

            {/* Logo */}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-gray-900">Njordships</div>
                <div className="text-xs text-gray-500">Maritime Portal</div>
              </div>
            </button>
          </div>

          {/* Center: Section Dropdown - Only show in form on desktop */}
          {isInForm && (
            <div className="hidden lg:block relative" ref={sectionDropdownRef}>
              <button
                onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">
                  Section {currentSection}: {SECTIONS[currentSection - 1]?.name}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showSectionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showSectionDropdown && (
                <div className="absolute top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                  {SECTIONS.map((section) => (
                    <button
                      key={section.number}
                      onClick={() => handleSectionClick(section.number)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                        currentSection === section.number ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          currentSection === section.number
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {section.number}
                        </span>
                        <span className="text-sm">{section.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right: User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-gray-900">
                  {user?.user_metadata?.full_name || 'User'}
                </div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.user_metadata?.full_name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                </div>
                <button
                  onClick={() => {
                    navigate('/dashboard')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Dashboard
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}