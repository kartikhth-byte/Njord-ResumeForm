import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Settings } from 'lucide-react'
import BrandLockup from '../ui/BrandLockup'
import { usePermissions } from '../../hooks/usePermissions'

export default function RecruiterTopbar({ user, profile, role, signOut }) {
  const navigate = useNavigate()
  const { canManageSettings } = usePermissions()
  const showSettings = role === 'Master Recruiter' || canManageSettings()
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

        <div className="flex items-center gap-2">
        {showSettings ? (
          <button
            type="button"
            onClick={() => navigate('/recruiter/settings')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-fg-muted transition hover:bg-raised hover:text-fg"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        ) : null}

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="applicant-topbar__user-button"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-fill text-on-accent">
              <span className="text-sm font-medium text-fg">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-fg">{displayName}</div>
              <div className="text-xs text-fg-muted">{displayEmail}</div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-fg-muted transition-transform ${
 showUserMenu ? 'rotate-180' : ''
 }`}
            />
          </button>

          {showUserMenu ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[24px] border border-line bg-surface py-2 shadow-overlay">
              <div className="border-b border-line px-4 py-3">
                <div className="text-sm font-medium text-fg">{displayName}</div>
                <div className="text-xs text-fg-muted">{displayEmail}</div>
                <div className="mt-1 text-xs font-medium text-accent-text">{role || 'Recruiter'}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/dashboard')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-fg-secondary transition-colors hover:bg-raised"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/workspace')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-fg-secondary transition-colors hover:bg-raised"
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/applications')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-fg-secondary transition-colors hover:bg-raised"
              >
                Applications
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/recruiter/workspace?tab=candidates')
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-fg-secondary transition-colors hover:bg-raised"
              >
                Candidates
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
              >
                Sign Out
              </button>
            </div>
          ) : null}
        </div>
        </div>
      </div>
    </nav>
  )
}
