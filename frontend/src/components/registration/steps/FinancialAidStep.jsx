import { useState } from 'react'
import { downloadDocument } from '../../../services/api'
import { formatFileSize, formatUploadedAt } from '../formatters'

// Step 4 — Financial Aid: this is a read-only step. The Financial Aid
// office uploads its own document (award letter / aid form) — the
// student does not upload anything here. We show it if one already
// exists on the student's most recent application; otherwise a clearly
// labeled placeholder. The download always goes through the same
// authenticated download_document call the rest of the app uses — no
// URL is ever guessed or hard-coded client-side.
function FinancialAidStep({ document: financialAidDocument, loading, error }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadDocument(financialAidDocument.id)
    } catch (err) {
      setDownloadError(err.message || 'Could not download this document.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <fieldset className="reg-fieldset">
      <legend className="reg-fieldset__legend">Financial aid document</legend>

      {loading && <p className="reg-fieldset__note">Checking for a financial aid document on file…</p>}

      {!loading && error && (
        <p className="reg-warning" role="alert">
          We could not check for an existing financial aid document ({error}). You can continue —
          this will not block your registration.
        </p>
      )}

      {!loading && !error && financialAidDocument && (
        <div className="reg-document-card">
          <div>
            <span className="reg-document-card__name">{financialAidDocument.original_filename}</span>
            <span className="reg-document-card__meta">
              {financialAidDocument.content_type} · {formatFileSize(financialAidDocument.size_bytes)} ·{' '}
              Uploaded {formatUploadedAt(financialAidDocument.uploaded_at)}
            </span>
          </div>
          <button type="button" className="btn btn--outline btn--small" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading…' : 'View document'}
          </button>
          {downloadError && <p className="reg-upload__error" role="alert">{downloadError}</p>}
        </div>
      )}

      {!loading && !error && !financialAidDocument && (
        <div className="reg-placeholder">
          <span className="reg-placeholder__title">No financial aid document on file yet</span>
          <p className="reg-placeholder__text">
            Your award letter or financial aid form will appear here once the Financial Aid office
            uploads it. You can continue with your registration in the meantime.
          </p>
        </div>
      )}
    </fieldset>
  )
}

export default FinancialAidStep
