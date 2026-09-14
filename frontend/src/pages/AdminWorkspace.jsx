import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import WorkspaceNav from '../components/WorkspaceNav'
import AdminDashboardHome from '../components/admin/AdminDashboardHome'
import UserManagementPage from '../components/admin/UserManagementPage'
import AdminStudentForm from '../components/admin/AdminStudentForm'
import AdminOfficialForm from '../components/admin/AdminOfficialForm'
import StudentRecordPage from '../components/admin/StudentRecordPage'
import OfficeAssignmentsPage from '../components/admin/OfficeAssignmentsPage'
import { deriveOfficialDisplayName } from '../components/official/officialStatus'
import '../components/official/officialWorkspace.css'
import '../components/admin/adminWorkspace.css'

const ADMIN_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users',      label: 'User Management' },
  { key: 'offices',    label: 'Office Assignments' },
]

// The three top-level sections each have their own workspace-hero
// greeting (mirroring the Official Workspace). The deeper screens
// reached from them (Add/Edit forms, Student Record) supply their own
// focused header + Back button instead, so no hero is shown there.
function tabForPath(pathname) {
  if (pathname === '/admin' || pathname === '/admin/') return 'dashboard'
  if (pathname.startsWith('/admin/offices')) return 'offices'
  return 'users'
}

/* -------------------------------------------------------
   AdminWorkspace — the Admin Workspace shell for system_admin
   accounts. Reuses the same workspace-shell / WorkspaceNav / btn /
   status-badge design system as the Student and Official Workspaces
   (see officialWorkspace.css's own header comment) — adminWorkspace.css
   only adds the handful of classes those don't already cover.

   Mounted at "/admin/*" (see App.jsx) so every screen below is a real,
   addressable, deep-linkable URL rather than an in-memory tab.
------------------------------------------------------- */
function AdminWorkspace({ onNavigate, currentSession }) {
  const location = useLocation()
  const activeTab = tabForPath(location.pathname)
  const showHero = location.pathname === '/admin' || location.pathname === '/admin/users' || location.pathname === '/admin/offices'

  const handleSelect = (key) => {
    onNavigate(key === 'dashboard' ? '/admin' : `/admin/${key}`)
  }

  return (
    <div className="workspace">
      <div className="workspace-shell">
        <WorkspaceNav
          activeTab={activeTab}
          onSelect={handleSelect}
          items={ADMIN_TABS}
          label="Admin Workspace sections"
          heading="Admin Workspace"
        />

        <main className="workspace-main">
          {showHero && (
            <div className="workspace-hero">
              <div>
                <h1 className="workspace-hero__title">
                  Welcome, {deriveOfficialDisplayName(currentSession?.email)}
                </h1>
                <p className="workspace-hero__subtitle">System Administrator · Admin Workspace</p>
              </div>
            </div>
          )}

          <Routes>
            <Route index element={<AdminDashboardHome onNavigate={onNavigate} currentSession={currentSession} />} />
            <Route path="users" element={<UserManagementPage onNavigate={onNavigate} />} />
            <Route path="users/new-student" element={<AdminStudentForm mode="create" onNavigate={onNavigate} />} />
            <Route path="users/new-official" element={<AdminOfficialForm mode="create" onNavigate={onNavigate} />} />
            <Route path="students/:studentId/edit" element={<AdminStudentForm mode="edit" onNavigate={onNavigate} />} />
            <Route path="officials/:officialId/edit" element={<AdminOfficialForm mode="edit" onNavigate={onNavigate} />} />
            <Route path="records/:applicationId" element={<StudentRecordPage onNavigate={onNavigate} currentSession={currentSession} />} />
            <Route path="offices" element={<OfficeAssignmentsPage onNavigate={onNavigate} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default AdminWorkspace
