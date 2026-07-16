import { useState } from 'react'
import { downloadDocument } from '../services/api'
import { formatDocumentType, formatDocumentStatus } from '../utils/backendLabels'
import StatusBadge from './StatusBadge'

function formatFileSize(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUploadedAt(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Shared by the student's own document panel and the official review
// panel — the download button always goes through the document_id, the
// backend never exposes a raw file path for us to link to directly.
function DocumentList({ documents }) {
  const [downloadingId, setDownloadingId] = useState(null)
  const [downloadError, setDownloadError] = useState('')

  const handleDownload = async (documentId) => {
    setDownloadingId(documentId)
    setDownloadError('')
    try {
      await downloadDocument(documentId)
    } catch (err) {
      setDownloadError(err.message || 'Could not download this document.')
    } finally {
      setDownloadingId(null)
    }
  }

  if (documents.length === 0) {
    return <p className="document-list__empty">No documents uploaded yet.</p>
  }

  return (
    <div className="document-list--uploaded">
      {downloadError && <p className="document-list__error">{downloadError}</p>}
      {documents.map((doc) => (
        <div key={doc.id} className="document-list__row">
          <div className="document-list__info">
            <span className="document-list__type">{formatDocumentType(doc.document_type)}</span>
            <span className="document-list__filename">{doc.original_filename}</span>
            <span className="document-list__meta">
              {doc.content_type} · {formatFileSize(doc.size_bytes)} · Uploaded {formatUploadedAt(doc.uploaded_at)}
            </span>
          </div>
          <div className="document-list__actions">
            <StatusBadge status={formatDocumentStatus(doc.status)} />
            <button
              type="button"
              className="doc-btn doc-btn--upload"
              onClick={() => handleDownload(doc.id)}
              disabled={downloadingId === doc.id}
            >
              {downloadingId === doc.id ? 'Downloading…' : 'Download'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default DocumentList
