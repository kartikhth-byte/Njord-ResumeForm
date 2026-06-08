import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import BrandLockup from '../ui/BrandLockup'

export default function RecruiterTopbar({ user, profile, role, signOut }) {
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
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

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Recruiter'
  const displayEmail = profile?.email || user?.email || 'No email available'

  return (
    <nav className="applicant-topbar">
      <div className="applicant-topbar__inner">
        <button
          type="button"
          onClick={() => navigate('/recruiter/dashboard')}
          className="applicant-topbar__brand"
        >
          <BrandLockup compact />
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="applicant-topbar__user-button"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
              <span className="text-sm font-medium text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-gray-900">{displayName}</div>
              <div className="text-xs text-gray-500">{displayEmail}</div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform ${
                showUserMenu ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[24px] border border-slate-200 bg-white py-2 shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="text-sm font-medium text-gray-900">{displayName}</div>
                <div className="text-xs text-gray-500">{displayEmail}</div>
                <div className="mt-1 text-xs font-medium text-teal-700">{role || 'Recruiter'}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/dashboard')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/workspace')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/applications')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/workspace?tab=candidates')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Candidates
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
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
