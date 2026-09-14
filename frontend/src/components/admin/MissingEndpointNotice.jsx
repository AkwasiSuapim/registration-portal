/* -------------------------------------------------------
   MissingEndpointNotice — shown wherever an Admin Workspace screen
   calls a real, defined API function (services/adminApi.js) whose
   backend route does not exist yet. Deliberately distinct from the
   generic workspace-error panel (used for real network/server
   failures) so nobody reading the screen mistakes "not built yet" for
   "broken" or, worse, for "zero" — this never renders next to a
   number or a list that could be misread as real data.
------------------------------------------------------- */
function MissingEndpointNotice({ title = 'This isn’t available yet', endpoint, onRetry }) {
  return (
    <div className="admin-missing" role="status">
      <span className="admin-missing__icon" aria-hidden="true">i</span>
      <div className="admin-missing__body">
        <span className="admin-missing__title">{title}</span>
        <p className="admin-missing__text">
          This screen is fully built on the frontend, but the backend does not yet expose{' '}
          <code>{endpoint}</code>. Nothing is shown here rather than guessed at — see the
          implementation report for the full list of endpoints this workspace needs.
        </p>
        {onRetry && (
          <button type="button" className="btn btn--outline btn--small" onClick={onRetry}>
            Check again
          </button>
        )}
      </div>
    </div>
  )
}

export default MissingEndpointNotice
