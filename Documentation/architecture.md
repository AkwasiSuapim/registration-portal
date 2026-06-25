# Architecture Documentation

## System Architecture

The Student Registration Portal uses a client-server architecture.

The frontend handles the user interface. The backend handles business logic, API routes, validation, and database communication.

## High-Level Flow

```text
Student/Admin
     ↓
React Frontend
     ↓
API Request
     ↓
FastAPI Backend
     ↓
Database
     ↓
FastAPI Response
     ↓
React Updates the Page
```

## Frontend Architecture

The frontend is built with React and Vite.

React is responsible for:

- Displaying pages
- Rendering components
- Handling form input
- Managing frontend state
- Showing registration records
- Sending requests to the backend later

Vite is used as the frontend development tool.

## Frontend Pages

### Home Page

Route:

```text
/
```

Purpose:

- Introduces the project
- Explains what the portal does
- Provides navigation to registration and admin dashboard

### Student Registration Page

Route:

```text
/register
```

Purpose:

- Displays the student registration form
- Captures student input
- Submits registration data

### Admin Dashboard Page

Route:

```text
/admin
```

Purpose:

- Displays submitted registrations
- Shows registration status
- Later supports approve, reject, delete, and search features

## Frontend Components

### Navbar.jsx

Displays navigation links.

### StudentForm.jsx

Handles registration form fields and form submission.

### RegistrationTable.jsx

Displays registration records in a table.

## Backend Architecture

The backend is built with FastAPI.

FastAPI is responsible for:

- Receiving requests from React
- Validating incoming data
- Creating API routes
- Returning JSON responses
- Communicating with the database
- Handling admin actions later

## Backend Files

### main.py

Creates the FastAPI app and includes routes.

### database.py

Creates the database connection.

### models.py

Defines database tables.

### schemas.py

Defines request and response data shapes.

### routes/registrations.py

Contains registration-related API endpoints.

## Database Architecture

The project will start with SQLite for development.

SQLite is simple and works well for local development.

Later, PostgreSQL can be used for production deployment.

## Request Flow Example

When a student submits a form:

```text
Student fills React form
↓
React sends POST request
↓
FastAPI receives data
↓
FastAPI validates data
↓
Backend saves data to database
↓
Backend returns success response
↓
React shows confirmation message
```

## Admin Dashboard Flow

When an admin opens the dashboard:

```text
Admin opens dashboard
↓
React sends GET request
↓
FastAPI fetches registrations
↓
Database returns records
↓
FastAPI sends JSON response
↓
React displays records in a table
```

## Development Architecture Strategy

The project will be developed in this order:

```text
Frontend UI
↓
Frontend fake data
↓
Backend API
↓
Database
↓
Frontend-backend connection
↓
Admin actions
↓
Authentication
↓
Deployment
```

## Why Frontend First?

Frontend-first development is useful here because:

- The product becomes visible early
- The form fields become clear
- The admin dashboard structure becomes clear
- Backend routes can be designed based on real UI needs
- Motivation stays high because progress is visible

## Future Architecture Improvements

Future versions may include:

- Authentication layer
- Role-based access control
- File storage
- Email service
- Cloud-hosted PostgreSQL database
- Deployment pipeline
- Logging and audit trails
