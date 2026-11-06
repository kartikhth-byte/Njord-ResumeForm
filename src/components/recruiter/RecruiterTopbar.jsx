import RecruiterSidebar from './RecruiterSidebar'

// Recruiter pages render <RecruiterTopbar />; the shell is now a left sidebar.
export default function RecruiterTopbar(props) {
  return <RecruiterSidebar {...props} />
}
