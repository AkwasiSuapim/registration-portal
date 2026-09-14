import { useEffect, useState } from 'react'
import { listAdminUsers, activateUser, deactivateUser } from '../../services/adminApi'
import { OFFICE_ROLE_OPTIONS } from './adminConstants'
import StatusBadge from '../StatusBadge'
import ConfirmDialog from '../official/ConfirmDialog'

const PAGE_SIZE = 20

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function UserRowActions({ user, onEdit, onView, onToggleActive }) {
  return (
    <div className="admin-row-actions">
      {user.account_type === 'student' && (
        <button
          type="button"
          className="btn btn--outline btn--small"
          disabled={!user.latest_application_id}
          title={user.latest_application_id ? undefined : 'No registration on file yet.'}
          onClick={() => onView(user)}
        >
          View
        </button>
      )}
      <button type="button" className="btn btn--outline btn--small" onClick={() => onEdit(user)}>Edit</button>
      <button
        type="button"
        className={`btn btn--small ${user.is_active ? 'btn--dark' : 'btn--primary'}`}
        onClick={() => onToggleActive(user)}
      >
        {user.is_active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

/* -------------------------------------------------------
   UserManagementPage — searchable, filterable, paginated directory of
   student and official accounts (GET /admin/users — see the missing-
   endpoint note below). Search/filter/pagination controls are fully
   wired to real query params on listAdminUsers() so they work exactly
   as designed once the backend adds this route; today the table body
   shows an honest "not available yet" panel instead of any data.
------------------------------------------------------- */
function UserManagementPage({ onNavigate }) {
  const [searchInput, setSearchInput]   = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [role, setRole]     = useState('')
  const [status, setStatus] = useState('')
  const [office, setOffice] = useState('')
  const [page, setPage]     = useState(1)

  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [pendingToggle, setPendingToggle] = useState(null) // user row awaiting confirmation
  const [toggleSubmitting, setToggleSubmitting] = useState(false)
  const [toggleError, setToggleError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // reloadToken has no meaning beyond "changed" — the Retry button
  // bumps it to re-run the effect below without duplicating its fetch
  // logic in a second, separately-called function.
  const [reloadToken, setReloadToken] = useState(0)
  const load = () => setReloadToken((t) => t + 1)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const result = await listAdminUsers({
          search: appliedSearch || undefined,
          role: role || undefined,
          status: status || undefined,
          office: office || undefined,
          page,
          page_size: PAGE_SIZE,
        })
        if (!cancelled) setResult(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [appliedSearch, role, status, office, page, reloadToken])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedSearch(searchInput)
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setAppliedSearch('')
    setRole('')
    setStatus('')
    setOffice('')
    setPage(1)
  }

  const handleEdit = (user) => {
    // There is no GET /admin/users/{id} — the row already has everything
    // the Edit form needs, so it's passed through router state instead
    // of being re-fetched by id. A direct link/refresh into an edit URL
    // has no state to read; AdminStudentForm/AdminOfficialForm handle
    // that by sending the admin back to User Management.
    const path = user.account_type === 'student'
      ? `/admin/students/${user.id}/edit`
      : `/admin/officials/${user.id}/edit`
    onNavigate(path, { state: { user } })
  }

  const handleView = (user) => {
    if (user.latest_application_id) onNavigate(`/admin/records/${user.latest_application_id}`)
  }

  const handleStartToggle = (user) => {
    setToggleError('')
    setSuccessMessage('')
    setPendingToggle(user)
  }

  const handleConfirmToggle = async () => {
    const user = pendingToggle
    setToggleSubmitting(true)
    setToggleError('')
    try {
      if (user.is_active) await deactivateUser(user.user_id)
      else await activateUser(user.user_id)
      setSuccessMessage(`${user.first_name} ${user.last_name} was ${user.is_active ? 'deactivated' : 'activated'}.`)
      setPendingToggle(null)
      load()
    } catch (err) {
      setToggleError(err.message)
      setPendingToggle(null)
    } finally {
      setToggleSubmitting(false)
    }
  }

  const items = result?.items || []
  const total = result?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(appliedSearch || role || status || office)

  return (
    <div className="workspace-panel">
      <div className="admin-toolbar">
        <div>
          <h1 className="workspace-hero__title">User Management</h1>
          <p className="workspace-hero__subtitle">Search, filter, and manage student &amp; official accounts.</p>
        </div>
        <div className="admin-toolbar__actions">
          <button type="button" className="btn btn--outline" onClick={() => onNavigate('/admin/users/new-student')}>
            Add Student
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onNavigate('/admin/users/new-official')}>
            Add Official
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="official-success-banner" role="status">
          <span aria-hidden="true">✓</span> {successMessage}
        </div>
      )}

      <section className="workspace-card">
        <form className="admin-filters" onSubmit={handleSearchSubmit} role="search" aria-label="Search users">
          <div className="admin-filters__search">
            <input
              type="search"
              placeholder="Search by name, student/employee ID, or college email…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search by name, student or employee ID, or college email"
            />
            <button type="submit" className="btn btn--primary">Search</button>
          </div>

          <label className="admin-filters__field">
            Role
            <select value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }}>
              <option value="">All</option>
              <option value="student">Student</option>
              <option value="official">Official</option>
            </select>
          </label>

          <label className="admin-filters__field">
            Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {role === 'official' && (
            <label className="admin-filters__field">
              Office
              <select value={office} onChange={(event) => { setOffice(event.target.value); setPage(1) }}>
                <option value="">All offices</option>
                {OFFICE_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          )}

          {hasFilters && (
            <button type="button" className="btn btn--outline" onClick={handleClearFilters}>Clear Filters</button>
          )}
        </form>
      </section>

      <section className="workspace-card">
        {loading ? (
          <p className="app-detail__empty">Loading users…</p>
        ) : error ? (
          <div className="workspace-error" role="alert">
            <span className="workspace-error__icon" aria-hidden="true">!</span>
            <div className="workspace-error__body">
              <span className="workspace-error__title">Could not load the user directory</span>
              <p className="workspace-error__text">{error}</p>
              <div className="workspace-error__actions">
                <button type="button" className="btn btn--outline" onClick={load}>Try again</button>
              </div>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="workspace-empty">
            <h3 className="workspace-empty__title">
              {hasFilters ? 'No matching users' : 'No users found'}
            </h3>
            <p className="workspace-empty__text">
              {hasFilters
                ? 'Try a different name, ID, email, or filter combination.'
                : 'No student or official accounts exist yet.'}
            </p>
            {hasFilters && (
              <button type="button" className="btn btn--primary" onClick={handleClearFilters}>Clear Filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="applications-table" aria-label="Student and official accounts">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">ID</th>
                    <th scope="col">College Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Assigned Office</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => (
                    <tr key={`${user.account_type}-${user.id}`}>
                      <td className="admin-cell-name">{user.first_name} {user.last_name}</td>
                      <td>{user.id_number || '—'}</td>
                      <td>{user.email}</td>
                      <td>{user.account_type === 'student' ? 'Student' : 'Official'}</td>
                      <td>{user.role_name || '—'}</td>
                      <td><StatusBadge status={user.is_active ? 'Active' : 'Inactive'} /></td>
                      <td>{formatDate(user.updated_at)}</td>
                      <td>
                        <UserRowActions
                          user={user}
                          onEdit={handleEdit}
                          onView={handleView}
                          onToggleActive={handleStartToggle}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-user-cards">
              {items.map((user) => (
                <div key={`${user.account_type}-${user.id}`} className="admin-user-card">
                  <div className="admin-user-card__top">
                    <span className="admin-cell-name">{user.first_name} {user.last_name}</span>
                    <StatusBadge status={user.is_active ? 'Active' : 'Inactive'} />
                  </div>
                  <dl className="admin-user-card__meta">
                    <div><dt>ID</dt><dd>{user.id_number || '—'}</dd></div>
                    <div><dt>Role</dt><dd>{user.account_type === 'student' ? 'Student' : 'Official'}</dd></div>
                    <div><dt>Email</dt><dd>{user.email}</dd></div>
                    <div><dt>Office</dt><dd>{user.role_name || '—'}</dd></div>
                    <div><dt>Last Updated</dt><dd>{formatDate(user.updated_at)}</dd></div>
                  </dl>
                  <UserRowActions user={user} onEdit={handleEdit} onView={handleView} onToggleActive={handleStartToggle} />
                </div>
              ))}
            </div>

            <div className="admin-pagination">
              <span className="admin-pagination__info">
                Page {page} of {totalPages} · {total} user{total === 1 ? '' : 's'}
              </span>
              <div className="admin-pagination__controls">
                <button type="button" className="btn btn--outline btn--small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button type="button" className="btn btn--outline btn--small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {pendingToggle && (
        <ConfirmDialog
          title={`${pendingToggle.is_active ? 'Deactivate' : 'Activate'} this account?`}
          body={
            pendingToggle.is_active
              ? `${pendingToggle.first_name} ${pendingToggle.last_name} will no longer be able to sign in. This does not delete their record — the account can be reactivated at any time.`
              : `${pendingToggle.first_name} ${pendingToggle.last_name} will be able to sign in again.`
          }
          confirmLabel={pendingToggle.is_active ? 'Deactivate' : 'Activate'}
          tone={pendingToggle.is_active ? 'danger' : 'primary'}
          submitting={toggleSubmitting}
          onConfirm={handleConfirmToggle}
          onCancel={() => { setPendingToggle(null); setToggleError('') }}
        />
      )}
      {toggleError && <p className="admin-field-error" role="alert">{toggleError}</p>}
    </div>
  )
}

export default UserManagementPage
