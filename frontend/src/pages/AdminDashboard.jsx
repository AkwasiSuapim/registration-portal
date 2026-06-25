function AdminDashboard({ onNavigate }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__header">
        <h1 className="placeholder-page__title">Admin Dashboard</h1>
        <p className="placeholder-page__desc">
          Registrar and admin review tools will be built here. Staff will be able
          to view, filter, and process student registration submissions digitally.
        </p>
      </div>

      <div className="placeholder-card">
        <h2 className="placeholder-card__heading">Application review workflow coming next</h2>
        <p className="placeholder-card__text">
          Planned features: submission inbox, student status tracking,
          approval and rejection workflow, and data export tools.
        </p>
      </div>

      <button
        type="button"
        className="btn btn--outline"
        onClick={() => onNavigate('home')}
      >
        ← Back to Home
      </button>
    </div>
  )
}

export default AdminDashboard
