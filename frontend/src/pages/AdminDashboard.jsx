import { useState, useEffect, useCallback } from 'react'
import { getOfficialQueue } from '../services/api'
import { getOwnClearanceKey } from '../utils/backendLabels'
import WorkspaceNav from '../components/WorkspaceNav'
import OfficialDashboardTab from '../components/official/OfficialDashboardTab'
import ReviewHistoryTab from '../components/official/ReviewHistoryTab'
import ApplicationReviewPanel from '../components/official/ApplicationReviewPanel'
import { deriveOfficialDisplayName } from '../components/official/officialStatus'
import AdminWorkspace from './AdminWorkspace'
import '../components/official/officialWorkspace.css'

const OFFICIAL_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'history',   label: 'Review History' },
]

/* -------------------------------------------------------
   AdminDashboard — the Official Workspace shell.

   Extends the same shell Student Workspace uses (workspace /
   workspace-shell / workspace-sidebar / workspace-main from App.css,
   WorkspaceNav for the sidebar) rather than a separate design system.
   Office identity (role_key / role_name) comes from the backend
   session (App.jsx / GET /auth/me); the queue itself is already scoped
   server-side to the caller's own office.

   A signed-in system_admin account has no personal office queue (see
   loadQueue) — that existing, working behavior is preserved unchanged.
------------------------------------------------------- */
function AdminDashboard({ onNavigate, currentSession }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [queue, setQueue]                     = useState([])
  const [queueLoading, setQueueLoading]       = useState(true)
  const [queueError, setQueueError]           = useState('')
  const [openApplication, setOpenApplication] = useState(null) // { applicationId, fromTab }

  const officeRole      = currentSession?.role_name || null
  const ownClearanceKey = getOwnClearanceKey(currentSession?.role_key)
  const isPublicSafety  = currentSession?.role_key === 'public_safety'
  const isAdmin         = currentSession?.account_type === 'admin'

  // GET /officials/me/queue is official-only — a system_admin account
  // gets a 403 (not an empty list) if it calls this, so admins simply
  // never make the request and see an explanatory message instead.
  // Shared refetch used after a decision is recorded and by the retry
  // button — neither call site is inside a useEffect body.
  const loadQueue = useCallback(() => {
    if (isAdmin) {
      setQueueLoading(false)
      return
    }
    setQueueLoading(true)
    setQueueError('')
    getOfficialQueue()
      .then(setQueue)
      .catch((err) => setQueueError(err.message))
      .finally(() => setQueueLoading(false))
  }, [isAdmin])

  // Inlined (rather than calling loadQueue above) so this effect's
  // body never calls setState directly.
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (isAdmin) {
        if (!cancelled) setQueueLoading(false)
        return
      }
      setQueueLoading(true)
      setQueueError('')
      try {
        const result = await getOfficialQueue()
        if (!cancelled) setQueue(result)
      } catch (err) {
        if (!cancelled) setQueueError(err.message)
      } finally {
        if (!cancelled) setQueueLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [isAdmin])

  const handleOpenApplication = (applicationId, fromTab = activeTab) => {
    setOpenApplication({ applicationId, fromTab })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCloseApplication = () => {
    setOpenApplication(null)
  }

  // Brief loading gate — App.jsx already guards this route.
  if (!officeRole) return null

  // system_admin accounts get the full Admin Workspace (dashboard, user
  // management, office assignments, student records) instead of an
  // office queue — admins have no clearance key of their own (see
  // loadQueue above), so there is nothing for them to review here.
  if (isAdmin) {
    return <AdminWorkspace onNavigate={onNavigate} currentSession={currentSession} />
  }

  return (
    <div className="workspace">
      <div className="workspace-shell">
        <WorkspaceNav
          activeTab={openApplication ? openApplication.fromTab : activeTab}
          onSelect={(tab) => { setActiveTab(tab); setOpenApplication(null) }}
          items={OFFICIAL_TABS}
          label="Official Workspace sections"
          heading="Official Workspace"
        />

        <main className="workspace-main">
          {openApplication ? (
            <ApplicationReviewPanel
              applicationId={openApplication.applicationId}
              currentSession={currentSession}
              ownClearanceKey={ownClearanceKey}
              isPublicSafety={isPublicSafety}
              onClose={handleCloseApplication}
              onQueueChanged={loadQueue}
            />
          ) : (
            <div className="workspace-panel">
              <div className="workspace-hero">
                <div>
                  <h1 className="workspace-hero__title">
                    Welcome, {deriveOfficialDisplayName(currentSession?.email)}
                  </h1>
                  <p className="workspace-hero__subtitle">{officeRole} · Official Workspace</p>
                </div>
              </div>

              {activeTab === 'dashboard' && (
                <OfficialDashboardTab
                  currentSession={currentSession}
                  queue={queue}
                  queueLoading={queueLoading}
                  queueError={queueError}
                  onRetry={loadQueue}
                  onOpenApplication={(applicationId) => handleOpenApplication(applicationId, 'dashboard')}
                />
              )}
              {activeTab === 'history' && (
                <ReviewHistoryTab
                  queue={queue}
                  queueLoading={queueLoading}
                  queueError={queueError}
                  onRetry={loadQueue}
                  onOpenApplication={(applicationId) => handleOpenApplication(applicationId, 'history')}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
