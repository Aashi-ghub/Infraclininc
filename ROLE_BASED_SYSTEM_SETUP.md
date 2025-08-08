# Role-Based Access Control System Setup Guide

## Overview

This document provides a comprehensive guide for setting up and using the role-based access control (RBAC) system in the BackendBore geological logging application.

## User Roles and Permissions

### 1. Admin
- **Full system access**
- **Can**: Create projects, manage users, assign users to projects, view all projects, manage structures
- **Cannot**: Limited by project assignments (can see all projects)

### 2. Project Manager
- **Project-level management**
- **Can**: Create structures and substructures, enter borelog metadata, upload CSV files, assign team members
- **Cannot**: Create projects, assign users to projects

### 3. Site Engineer
- **Field work and data entry**
- **Can**: View/edit borelog details after submission, enter field data
- **Cannot**: Create projects, approve borelogs

### 4. Approval Engineer (Reviewer)
- **Quality assurance and approval**
- **Can**: View submitted logs, approve/reject borelogs
- **Cannot**: Edit borelog details, create projects

### 5. Lab Engineer
- **Laboratory testing**
- **Can**: View assigned projects, enter lab test results
- **Cannot**: Edit borelog details, approve borelogs

### 6. Customer
- **Read-only access**
- **Can**: View assigned projects and borelogs
- **Cannot**: Edit any data, create projects

## Workflow

1. **Admin creates the project**
2. **Project Manager fills basic values and uploads CSV**
3. **Project Manager submits the data**
4. **Borelog opens up for editing**
5. **Site Engineer edits values**
6. **Approval Engineer reviews and approves**

## Database Setup

### 1. Update Database Schema

The system requires a `password_hash` field in the users table. Run the following SQL:

```sql
-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_id ON users(user_id);
```

### 2. Install Dependencies

```bash
cd backend
npm install bcryptjs @types/bcryptjs
```

## Backend Setup

### 1. Seed Initial Users

Run the seeding script to create initial users with different roles:

```bash
cd backend
npm run seed:admin-users
```

This will create the following default users:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@backendbore.com | admin123 |
| Project Manager | pm@backendbore.com | pm123 |
| Site Engineer | site@backendbore.com | site123 |
| Approval Engineer | approval@backendbore.com | approval123 |
| Lab Engineer | lab@backendbore.com | lab123 |
| Customer | customer@backendbore.com | customer123 |

**⚠️ IMPORTANT: Change these passwords in production!**

### 2. Start the Backend

```bash
cd backend
npm run dev
```

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration (Admin only)
- `GET /auth/me` - Get current user info

### User Management (Admin Only)
- `GET /users` - List all users
- `POST /users` - Create new user
- `GET /users/{user_id}` - Get user by ID
- `PUT /users/{user_id}` - Update user
- `DELETE /users/{user_id}` - Delete user

### Project Assignments (Admin Only)
- `POST /assignments` - Assign users to projects

## Usage Guide

### 1. Initial Setup

1. **Login as Admin**: Use `admin@backendbore.com` / `admin123`
2. **Create Users**: Navigate to "Users" in the navbar or dropdown menu
3. **Assign Users to Projects**: Use "Project Assignments" to assign users to specific projects

### 2. Project Workflow

#### Admin Tasks:
1. Create new projects
2. Create users with appropriate roles
3. Assign users to projects
4. Monitor project progress

#### Project Manager Tasks:
1. Fill in basic project information
2. Upload CSV files with borelog data
3. Assign team members to specific tasks
4. Review and submit data for approval

#### Site Engineer Tasks:
1. View assigned projects
2. Edit borelog details
3. Enter field data
4. Submit completed work

#### Approval Engineer Tasks:
1. Review submitted borelogs
2. Flag anomalies
3. Approve or reject submissions
4. Provide feedback

#### Lab Engineer Tasks:
1. View assigned projects
2. Enter laboratory test results
3. Update test data

#### Customer Tasks:
1. View assigned projects
2. Review borelog data
3. Access reports

### 3. Role-Based Navigation

The application automatically shows/hides features based on user roles:

- **Admin**: Full access to all features
- **Project Manager**: Project management, user assignment, data entry
- **Site Engineer**: Data entry and editing
- **Approval Engineer**: Review and approval features
- **Lab Engineer**: Lab test features
- **Customer**: Read-only access

## Security Features

### 1. Password Security
- Passwords are hashed using BCrypt with salt rounds of 10
- Passwords are never stored in plain text
- Secure password validation

### 2. JWT Authentication
- JWT tokens for session management
- Token expiration (24 hours)
- Secure token validation

### 3. Role-Based Access Control
- Server-side role validation
- Client-side role-based UI rendering
- Project-level access control

### 4. Input Validation
- Zod schema validation
- SQL injection prevention
- XSS protection

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Ensure PostgreSQL is running
   - Check database credentials in environment variables
   - Verify database schema is up to date

2. **Authentication Issues**
   - Clear browser localStorage
   - Check JWT secret configuration
   - Verify user exists in database

3. **Permission Issues**
   - Check user role assignments
   - Verify project assignments
   - Ensure proper role hierarchy

### Development Mode

The application includes fallback authentication for development:

- If the backend is not available, the frontend will use mock users
- Mock users are only available in development mode
- Real authentication is used in production

## Production Deployment

### 1. Environment Variables

Set the following environment variables:

```bash
# Database
PGHOST=your-db-host
PGPORT=5432
PGDATABASE=your-db-name
PGUSER=your-db-user
PGPASSWORD=your-db-password

# JWT
JWT_SECRET=your-secure-jwt-secret

# AWS (if using AWS services)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### 2. Security Checklist

- [ ] Change default passwords
- [ ] Use strong JWT secret
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up proper database backups
- [ ] Monitor application logs
- [ ] Regular security updates

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review application logs
3. Verify database connectivity
4. Test with different user roles
5. Check browser console for errors

## Future Enhancements

- Multi-factor authentication
- Audit logging
- Advanced role permissions
- API rate limiting
- User activity monitoring
- Bulk user operations
- Role templates
- Project templates 