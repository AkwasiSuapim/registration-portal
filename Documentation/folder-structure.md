# Folder Structure Documentation

## Root Project Structure

The project should be organized like this:

```text
student-registration-portal/
│
├── docs/
│   ├── README.md
│   ├── project-description.md
│   ├── architecture.md
│   ├── database-design.md
│   ├── todo.md
│   └── folder-structure.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── StudentForm.jsx
│   │   │   └── RegistrationTable.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── RegisterStudent.jsx
│   │   │   └── AdminDashboard.jsx
│   │   │
│   │   ├── data/
│   │   │   └── sampleRegistrations.js
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── routes/
│   │       └── registrations.py
│   │
│   ├── requirements.txt
│   └── venv/
│
├── README.md
└── .gitignore
```

## docs Folder

The docs folder contains project planning and documentation files.

### README.md

Project overview and setup guide.

### project-description.md

Explains what the project is, what problem it solves, and who it is for.

### architecture.md

Explains how the frontend, backend, and database work together.

### database-design.md

Explains database tables and fields.

### todo.md

Step-by-step build checklist.

### folder-structure.md

Explains the folder and file organization.

## frontend Folder

The frontend folder contains the React application.

## frontend/src/components

Reusable interface pieces.

### Navbar.jsx

Navigation bar shared across pages.

### StudentForm.jsx

Registration form component.

### RegistrationTable.jsx

Table component for displaying submitted registrations.

## frontend/src/pages

Full pages shown to users.

### Home.jsx

Landing page.

### RegisterStudent.jsx

Page that displays the student registration form.

### AdminDashboard.jsx

Page that displays student registrations.

## frontend/src/data

Temporary data before backend integration.

### sampleRegistrations.js

Contains fake registration records for frontend testing.

## frontend/src/App.jsx

Main React app component.

This file controls which pages and components are displayed.

## frontend/src/main.jsx

React entry point.

This connects the React app to the browser.

## frontend/src/index.css

Global CSS styling.

## backend Folder

The backend folder contains the FastAPI application.

## backend/app/main.py

Creates the FastAPI application.

Example responsibility:

```text
Create app
Add routes
Start backend logic
```

## backend/app/database.py

Handles database connection.

Example responsibility:

```text
Connect to SQLite
Create database session
```

## backend/app/models.py

Defines database tables.

Example responsibility:

```text
Registration table
User table later
```

## backend/app/schemas.py

Defines request and response data shapes.

Example responsibility:

```text
Validate registration data
Control response format
```

## backend/app/routes

Stores route files.

### registrations.py

Contains registration API routes.

Example routes:

```text
POST /api/registrations
GET /api/registrations
PATCH /api/registrations/{id}/status
DELETE /api/registrations/{id}
```

## requirements.txt

Lists backend Python packages.

Example:

```text
fastapi
uvicorn
sqlalchemy
```

## .gitignore

Prevents unnecessary files from being pushed to GitHub.

Should ignore:

```text
venv/
__pycache__/
.env
node_modules/
dist/
*.db
```

## Rule

Open the full root folder in VS Code, not only frontend or backend.

This allows AI coding assistants to see the documentation, frontend, and backend together.
