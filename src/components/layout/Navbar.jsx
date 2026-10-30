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
                className="lg:hidden rounded-card border border-line bg-surface p-2 text-fg-secondary transition hover:bg-raised"
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
                <span className="text-sm font-medium text-fg-secondary">
                  Section {currentSection}: {FORM_SECTION_NAME_MAP[currentSection]}
                </span>
                <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform ${showSectionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showSectionDropdown && (
                <div className="absolute top-full z-50 mt-2 max-h-96 w-96 overflow-y-auto rounded-[24px] border border-line bg-surface py-2 shadow-overlay">
                  {SECTIONS.map((section) => (
                    <button
                      key={section.number}
                      onClick={() => handleSectionClick(section.number)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-raised ${
 currentSection === section.number ? 'bg-accent-soft text-accent-text' : 'text-fg-secondary'
 }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
 currentSection === section.number
 ? 'bg-accent-fill text-on-accent'
 : 'bg-line text-fg-secondary'
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-fill text-on-accent">
                <span className="text-sm font-medium text-fg">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-fg">
                  {user?.user_metadata?.full_name || 'User'}
                </div>
                <div className="text-xs text-fg-muted">{user?.email}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-[24px] border border-line bg-surface py-2 shadow-overlay">
                <div className="px-4 py-2 border-b border-line">
                  <div className="text-sm font-medium text-fg">
                    {user?.user_metadata?.full_name || 'User'}
                  </div>
                  <div className="text-xs text-fg-muted truncate">{user?.email}</div>
                </div>
                <button
                  onClick={() => {
                    navigate('/dashboard')
                    setShowUserMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-fg-secondary hover:bg-raised transition-colors"
                >
                  Dashboard
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger-soft transition-colors"
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
