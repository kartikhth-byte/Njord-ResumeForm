import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ChevronDown, Menu } from 'lucide-react'
import BrandLockup from '../ui/BrandLockup'
import { FORM_SECTIONS, FORM_SECTION_NAME_MAP } from '../../constants/formSections'

const SECTIONS = FORM_SECTIONS.map((section) => ({
  number: section.id,
  name: section.title,
}))

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
      <nav className="applicant-topbar">
      <div className="applicant-topbar__inner">
          <div className="flex items-center gap-4">
            {isInForm && (
              <button
                onClick={onMobileMenuToggle}
                className="lg:hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}

            <button
              onClick={() => navigate('/dashboard')}
              className="applicant-topbar__brand"
            >
              <BrandLockup compact />
            </button>
          </div>

          {isInForm && (
            <div className="hidden lg:block relative" ref={sectionDropdownRef}>
              <button
                onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                className="applicant-topbar__section-button"
              >
                <span className="text-sm font-medium text-slate-700">
                  Section {currentSection}: {FORM_SECTION_NAME_MAP[currentSection]}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showSectionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showSectionDropdown && (
                <div className="absolute top-full z-50 mt-2 max-h-96 w-96 overflow-y-auto rounded-[24px] border border-slate-200 bg-white py-2 shadow-xl">
                  {SECTIONS.map((section) => (
                    <button
                      key={section.number}
                      onClick={() => handleSectionClick(section.number)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
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
              className="applicant-topbar__user-button"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
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
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[24px] border border-slate-200 bg-white py-2 shadow-xl">
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
    </nav>
  )
}
