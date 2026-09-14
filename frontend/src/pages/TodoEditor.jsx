import { useState } from 'react'
import { marked } from 'marked'

const INITIAL_MARKDOWN = `# Project Todo List

## Current Strategy

Build the frontend first, then the backend.

Current priority:

\`\`\`text
Frontend structure
↓
Home page
↓
Registration form
↓
Admin dashboard with fake data
↓
Backend
↓
Database
↓
Frontend-backend connection
\`\`\`

## Phase 1: Project Setup

Status: Mostly complete

- [x] Create GitHub repository
- [x] Create frontend folder
- [x] Create backend folder
- [x] Install React with Vite
- [x] Install FastAPI
- [x] Run frontend locally
- [x] Run backend locally
- [x] Confirm FastAPI docs page works

## Phase 2: Frontend Folder Structure

Status: Next task

- [ ] Open the full project folder in VS Code
- [ ] Go to frontend/src
- [ ] Create components folder
- [ ] Create pages folder
- [ ] Create data folder
- [ ] Create Navbar.jsx
- [ ] Create StudentForm.jsx
- [ ] Create RegistrationTable.jsx
- [ ] Create Home.jsx
- [ ] Create RegisterStudent.jsx
- [ ] Create AdminDashboard.jsx
- [ ] Create sampleRegistrations.js
- [ ] Run app and confirm no errors

## Phase 3: Home Page and Navigation

- [ ] Build Navbar component
- [ ] Build Home page
- [ ] Add project title
- [ ] Add short project explanation
- [ ] Add button/link to Register page
- [ ] Add button/link to Admin Dashboard
- [ ] Add basic CSS styling

## Phase 4: Student Registration Form UI

- [ ] Build StudentForm component
- [ ] Add full name field
- [ ] Add student ID field
- [ ] Add email field
- [ ] Add phone field
- [ ] Add major field
- [ ] Add classification dropdown
- [ ] Add address field
- [ ] Add emergency contact name field
- [ ] Add emergency contact phone field
- [ ] Add submit button
- [ ] Store input using React state
- [ ] Print submitted data to console

## Phase 5: Admin Dashboard with Fake Data

- [ ] Add sample registrations to sampleRegistrations.js
- [ ] Build RegistrationTable component
- [ ] Build AdminDashboard page
- [ ] Display fake registrations in a table
- [ ] Show full name
- [ ] Show student ID
- [ ] Show email
- [ ] Show major
- [ ] Show classification
- [ ] Show status

## Phase 6: Connect Form to Dashboard Locally

- [ ] Move registration state into App.jsx
- [ ] Pass registrations to AdminDashboard
- [ ] Pass submit function to RegisterStudent
- [ ] Add new submitted registration to the list
- [ ] Display new registration in admin dashboard
- [ ] Add success message after submission

## Phase 7: Frontend Polish

- [ ] Add required field validation
- [ ] Add empty dashboard message
- [ ] Improve table layout
- [ ] Improve form spacing
- [ ] Improve mobile responsiveness
- [ ] Clean CSS
- [ ] Remove unused code

## Phase 8: Backend Database Setup

- [ ] Install SQLAlchemy
- [ ] Create backend/app folder
- [ ] Create main.py
- [ ] Create database.py
- [ ] Create models.py
- [ ] Create schemas.py
- [ ] Create routes folder
- [ ] Create registrations.py
- [ ] Create SQLite database connection
- [ ] Create registrations table

## Phase 9: Backend Registration API

- [ ] Create POST /api/registrations
- [ ] Create GET /api/registrations
- [ ] Create GET /api/registrations/{id}
- [ ] Create PATCH /api/registrations/{id}/status
- [ ] Create DELETE /api/registrations/{id}
- [ ] Test all endpoints in FastAPI docs

## Phase 10: Connect React to FastAPI

- [ ] Create frontend API helper file
- [ ] Submit registration form to FastAPI
- [ ] Fetch registrations from FastAPI
- [ ] Display backend data in admin dashboard
- [ ] Add loading states
- [ ] Add error handling

## Phase 11: Admin Actions

- [ ] Add approve button
- [ ] Add reject button
- [ ] Add delete button
- [ ] Connect buttons to backend
- [ ] Update dashboard after action

## Phase 12: Authentication

Do not start until earlier phases work.

- [ ] Create users table
- [ ] Add password hashing
- [ ] Create signup route
- [ ] Create login route
- [ ] Add student/admin roles
- [ ] Protect admin routes
- [ ] Protect admin dashboard

## Phase 13: Polish and Deployment

- [ ] Improve UI design
- [ ] Add responsive layout
- [ ] Add loading states
- [ ] Add error messages
- [ ] Add success messages
- [ ] Update README
- [ ] Add screenshots
- [ ] Deploy frontend
- [ ] Deploy backend

## Git Commit Rule

Commit after each completed phase.

\`\`\`bash
git add .
git commit -m "Set up frontend folder structure"
git push
\`\`\`

## Main Rule

Do not jump ahead.

Finish one small task, test it, commit it, then continue.
`

marked.setOptions({ breaks: true, gfm: true })

export default function TodoEditor() {
  const [markdown, setMarkdown] = useState(INITIAL_MARKDOWN)
  const [mode, setMode] = useState('split') // 'edit' | 'preview' | 'split'
  const [copied, setCopied] = useState(false)

  const html = marked(markdown)

  function handleCopy() {
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleReset() {
    if (window.confirm('Reset to original todo.md content?')) {
      setMarkdown(INITIAL_MARKDOWN)
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>todo.md</h1>
        <div style={styles.toolbar}>
          <div style={styles.modeGroup}>
            {['edit', 'split', 'preview'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={handleCopy} style={styles.actionBtn}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleReset} style={{ ...styles.actionBtn, ...styles.resetBtn }}>
            Reset
          </button>
        </div>
      </header>

      <div style={{ ...styles.workspace, ...(mode === 'split' ? styles.split : {}) }}>
        {(mode === 'edit' || mode === 'split') && (
          <div style={styles.pane}>
            <div style={styles.paneLabel}>Editor</div>
            <textarea
              style={styles.editor}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        {(mode === 'preview' || mode === 'split') && (
          <div style={styles.pane}>
            <div style={styles.paneLabel}>Preview</div>
            <div
              style={styles.preview}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1117',
    color: '#e2e8f0',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid #1e2530',
    background: '#161b27',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#7dd3fc',
    letterSpacing: '0.02em',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modeGroup: {
    display: 'flex',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  modeBtn: {
    padding: '5px 14px',
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background 0.15s, color 0.15s',
  },
  modeBtnActive: {
    background: '#1e40af',
    color: '#fff',
  },
  actionBtn: {
    padding: '5px 14px',
    background: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  resetBtn: {
    color: '#f87171',
    borderColor: '#7f1d1d',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    height: 'calc(100vh - 57px)',
  },
  split: {
    flexDirection: 'row',
  },
  pane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid #1e2530',
  },
  paneLabel: {
    padding: '6px 16px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#4a5568',
    background: '#131720',
    borderBottom: '1px solid #1e2530',
  },
  editor: {
    flex: 1,
    background: '#0d1117',
    color: '#c9d1d9',
    border: 'none',
    outline: 'none',
    padding: '20px 24px',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: '13.5px',
    lineHeight: '1.7',
    resize: 'none',
    overflowY: 'auto',
    tabSize: 2,
  },
  preview: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
    lineHeight: '1.75',
    fontSize: '15px',
  },
}
