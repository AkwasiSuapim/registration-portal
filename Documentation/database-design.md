# Database Design

## Database Strategy

The project will begin with SQLite for development.

SQLite is simple, local, and easy to set up. It is enough for the first working version.

Later, PostgreSQL can be used for production deployment.

## Main Tables

The first database design will include one main table:

```text
registrations
```

Later, the system will add:

```text
users
```

for login and role-based access.

## Registrations Table

The registrations table stores student registration submissions.

### Table Name

```text
registrations
```

### Fields

| Field | Type | Description |
|---|---|---|
| id | Integer | Unique registration ID |
| full_name | String | Student full name |
| student_id | String | School-issued student ID |
| email | String | Student email address |
| phone | String | Student phone number |
| major | String | Student major |
| classification | String | Freshman, Sophomore, Junior, Senior, etc. |
| address | String | Student address |
| emergency_contact_name | String | Emergency contact person |
| emergency_contact_phone | String | Emergency contact phone number |
| status | String | Registration status |
| created_at | DateTime | When the record was created |
| updated_at | DateTime | When the record was last updated |

## Registration Status Values

Allowed status values:

```text
Pending
Approved
Rejected
```

Default status:

```text
Pending
```

When a student submits registration, the system should automatically set the status to Pending.

## Example Registration Record

```json
{
  "id": 1,
  "full_name": "John Doe",
  "student_id": "LC001",
  "email": "john@example.com",
  "phone": "555-123-4567",
  "major": "Computer Science",
  "classification": "Freshman",
  "address": "123 Campus Drive",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "555-987-6543",
  "status": "Pending",
  "created_at": "2026-06-15T10:00:00",
  "updated_at": "2026-06-15T10:00:00"
}
```

## Future Users Table

The users table will be added when authentication begins.

### Table Name

```text
users
```

### Fields

| Field | Type | Description |
|---|---|---|
| id | Integer | Unique user ID |
| full_name | String | User full name |
| email | String | Login email |
| password_hash | String | Hashed password |
| role | String | Student or Admin |
| created_at | DateTime | When the account was created |

## User Roles

Allowed roles:

```text
student
admin
```

## Database Relationships

For the MVP, no relationship is required.

Later, a user may be connected to a registration record.

Possible future relationship:

```text
users.id → registrations.user_id
```

This means one user can own one registration record.

## Database Rules

- Every registration must have a full name.
- Every registration must have a student ID.
- Every registration must have an email.
- Every registration should start with Pending status.
- Admins can update status to Approved or Rejected.
- Registration records should not be deleted accidentally.
- Passwords should never be stored as plain text when authentication is added.

## First Backend Goal

The first database goal is simple:

```text
Create the registrations table
↓
Save one registration
↓
Retrieve all registrations
```

Do not add users, authentication, or roles until the registration table works.
