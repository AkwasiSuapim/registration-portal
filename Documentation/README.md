# Student Registration Portal

A full-stack student registration system built to digitize manual college registration workflows and reduce long physical registration queues.

## Overview

The Student Registration Portal is a web-based application that allows students to submit their registration information online and allows administrators to review submitted registrations through a dashboard.

This project is inspired by a real campus problem: students spending hours in registration lines for information that could be collected digitally in minutes.

The goal is to build a working prototype that shows how a school can move from manual registration to a faster, cleaner, and more organized online process.

## Problem Statement

Many schools still use manual registration systems. This creates:

- Long queues
- Slow administrative processing
- Paperwork overload
- Missing or duplicated records
- Student frustration
- Poor access to registration data
- Inefficient staff workflow

This project solves that problem by allowing students to register online while administrators manage records from one place.

## Project Goals

The main goals are to:

- Build a real full-stack application using React and FastAPI
- Allow students to submit registration information online
- Allow administrators to view and manage submissions
- Store registration records in a database
- Learn full-stack development by building a real project
- Create a project that can be shown on GitHub, a resume, and a portfolio

## Tech Stack

### Frontend

- React
- Vite
- JavaScript
- HTML
- CSS

### Backend

- Python
- FastAPI
- Uvicorn

### Database

- SQLite for development
- PostgreSQL planned for production

### Tools

- VS Code
- Git
- GitHub
- FastAPI Docs
- Browser Developer Tools
- Codex or another AI coding assistant

## Current Build Strategy

This project is being built using a frontend-first strategy.

The plan is:

```text
Build frontend interface
↓
Use fake/sample data first
↓
Build backend API
↓
Connect frontend to backend
↓
Add database storage
↓
Add authentication
↓
Polish and deploy
```

This approach helps make the product visible early before adding complex backend logic.

## Core Features

### Student Features

- View homepage
- Open registration form
- Enter registration details
- Submit registration information
- Receive confirmation after submission

### Admin Features

- View all submitted registrations
- Search student registrations
- View student information
- See registration status
- Approve or reject registrations later

## MVP Features

The first working version will include:

- Homepage
- Student registration form
- Admin dashboard
- Fake registration data
- Table showing submitted registrations
- Local frontend state before backend connection

The MVP is complete when:

```text
Student fills form
↓
Student submits form
↓
Submitted data appears in admin dashboard
```

At first, data does not need to be saved permanently. Permanent storage will come when the backend and database are connected.

## Planned Features

Future versions will include:

- Backend API with FastAPI
- SQLite database
- Admin approval and rejection
- Student registration status
- Authentication
- Role-based access
- File upload for documents
- CSV export
- Deployment
- Mobile responsiveness

## Running the Frontend

Go into the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend should run at:

```text
http://localhost:5173
```

## Running the Backend

Go into the backend folder:

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv venv
```

Activate it:

```bash
source venv/bin/activate
```

Install FastAPI:

```bash
pip install "fastapi[standard]"
```

Run the backend:

```bash
fastapi dev app/main.py
```

Or with Uvicorn:

```bash
uvicorn app.main:app --reload
```

The backend should run at:

```text
http://localhost:8000
```

FastAPI docs should be available at:

```text
http://localhost:8000/docs
```

## Development Rule

Build small. Test often. Understand the code. Commit progress. Improve gradually.

Do not jump to authentication, deployment, or advanced features until the MVP works.

## Resume Description

Built a full-stack student registration portal using React, FastAPI, and SQLite to digitize manual student registration workflows. Developed a student registration form, admin dashboard, REST API design, and planned database-backed registration management features.

## Author

Francis Suapim

## Project Status

Currently in active development.

Current focus:

```text
Frontend structure and frontend MVP
```
