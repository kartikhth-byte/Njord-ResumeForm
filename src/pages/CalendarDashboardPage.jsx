// Page wrapper for the Calendar screen. Access is checked by the route guard in App.jsx.
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import CalendarDashboard from '../components/dashboard/CalendarDashboard'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'

export default function CalendarDashboardPage() {
  const { user, profile, signOut } = useAuth()
  const { role } = usePermissions(user)

  return (
    <div className="recruiter-shell">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CalendarDashboard />
      </div>
    </div>
  )
}
