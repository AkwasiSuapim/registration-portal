 Project Todo List

## Current Strategy

Build the frontend first, then the backend.

Current priority:

```text
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
```

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

Success condition:

```text
Frontend runs on localhost:5173
Backend runs on localhost:8000
FastAPI docs run on localhost:8000/docs
```

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

Success condition:

```text
All frontend folders and files exist.
The app still runs without errors.
```

## Phase 3: Home Page and Navigation

- [ ] Build Navbar component
- [ ] Build Home page
- [ ] Add project title
- [ ] Add short project explanation
- [ ] Add button/link to Register page
- [ ] Add button/link to Admin Dashboard
- [ ] Add basic CSS styling

Success condition:

```text
The browser shows a clean Home page.
Navigation links are visible.
```

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

Success condition:

```text
Student can type information into the form.
When submitted, the data appears in the browser console.
```

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

Success condition:

```text
Admin dashboard shows a table of student registrations.
```

## Phase 6: Connect Form to Dashboard Locally

- [ ] Move registration state into App.jsx
- [ ] Pass registrations to AdminDashboard
- [ ] Pass submit function to RegisterStudent
- [ ] Add new submitted registration to the list
- [ ] Display new registration in admin dashboard
- [ ] Add success message after submission

Success condition:

```text
Student submits form.
New student appears in admin dashboard.
```

## Phase 7: Frontend Polish

- [ ] Add required field validation
- [ ] Add empty dashboard message
- [ ] Improve table layout
- [ ] Improve form spacing
- [ ] Improve mobile responsiveness
- [ ] Clean CSS
- [ ] Remove unused code

Success condition:

```text
Frontend feels like a real prototype.
```

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

Success condition:

```text
Backend can create a database file.
Registration table exists.
```

## Phase 9: Backend Registration API

- [ ] Create POST /api/registrations
- [ ] Create GET /api/registrations
- [ ] Create GET /api/registrations/{id}
- [ ] Create PATCH /api/registrations/{id}/status
- [ ] Create DELETE /api/registrations/{id}
- [ ] Test all endpoints in FastAPI docs

Success condition:

```text
A registration can be created through FastAPI docs.
All registrations can be viewed through FastAPI docs.
```

## Phase 10: Connect React to FastAPI

- [ ] Create frontend API helper file
- [ ] Submit registration form to FastAPI
- [ ] Fetch registrations from FastAPI
- [ ] Display backend data in admin dashboard
- [ ] Add loading states
- [ ] Add error handling

Success condition:

```text
Student submits form in React.
FastAPI saves it.
Admin dashboard displays it.
```

## Phase 11: Admin Actions

- [ ] Add approve button
- [ ] Add reject button
- [ ] Add delete button
- [ ] Connect buttons to backend
- [ ] Update dashboard after action

Success condition:

```text
Admin can approve, reject, and delete registrations.
```

## Phase 12: Authentication

Do not start until earlier phases work.

- [ ] Create users table
- [ ] Add password hashing
- [ ] Create signup route
- [ ] Create login route
- [ ] Add student/admin roles
- [ ] Protect admin routes
- [ ] Protect admin dashboard

Success condition:

```text
Only admin users can access admin features.
```

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

Success condition:

```text
Project is presentable on GitHub and resume-ready.
```

## Git Commit Rule

Commit after each completed phase.

Example:

```bash
git add .
git commit -m "Set up frontend folder structure"
git push
```

## Main Rule

Do not jump ahead.

Finish one small task, test it, commit it, then continue.

