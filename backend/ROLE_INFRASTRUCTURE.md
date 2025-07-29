# Role Infrastructure Documentation

## Overview

This document describes the role-based access control (RBAC) infrastructure implemented in the backendbore system. The system enforces project-based access control where users can only access projects they are assigned to, with different permissions based on their roles.

## User Roles

### 1. Admin
- **Permissions**: Full system access
- **Can**: Create projects, assign users, view all projects, manage structures
- **Cannot**: Limited by project assignments (can see all projects)

### 2. Project Manager
- **Permissions**: Project-level management
- **Can**: Create structures and substructures, enter borelog metadata, upload CSV files
- **Cannot**: Create projects, assign users to projects

### 3. Site Engineer
- **Permissions**: Field work and data entry
- **Can**: View/edit borelog details after submission, enter field data
- **Cannot**: Create projects, approve borelogs

### 4. Approval Engineer (Reviewer)
- **Permissions**: Quality assurance and approval
- **Can**: View submitted logs, approve/reject borelogs
- **Cannot**: Edit borelog details, create projects

### 5. Lab Engineer
- **Permissions**: Laboratory testing
- **Can**: View assigned projects, enter lab test results
- **Cannot**: Edit borelog details, approve borelogs

### 6. Customer
- **Permissions**: Read-only access
- **Can**: View assigned projects and borelogs
- **Cannot**: Edit any data, create projects

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  organisation_id UUID,
  customer_id UUID,
  name TEXT,
  role user_role_enum NOT NULL,
  email TEXT,
  date_created TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (organisation_id) REFERENCES organisations (organisation_id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE SET NULL
);
```

### User Project Assignments
```sql
CREATE TABLE user_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_type assignment_type_enum NOT NULL,
  project_id UUID NOT NULL,
  assigner UUID[] NOT NULL,
  assignee UUID[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE
);
```

## API Endpoints with Role Enforcement

### Project Management

#### Create Project (Admin Only)
- **Endpoint**: `POST /projects`
- **Required Role**: Admin
- **Description**: Creates a new project

#### List Projects (Role-based Filtering)
- **Endpoint**: `GET /projects`
- **Required Role**: Any authenticated user
- **Description**: Returns projects based on user role and assignments
  - Admin: All projects
  - Others: Only assigned projects

#### Get Project Details
- **Endpoint**: `GET /projects/{project_id}`
- **Required Role**: Any authenticated user with project access

### Structure Management

#### Create Structure (Admin, Project Manager)
- **Endpoint**: `POST /structures`
- **Required Role**: Admin, Project Manager
- **Description**: Creates a new structure within a project

#### List Structures
- **Endpoint**: `GET /structures?project_id={project_id}`
- **Required Role**: Any authenticated user with project access

#### Create Substructure (Admin, Project Manager)
- **Endpoint**: `POST /substructures`
- **Required Role**: Admin, Project Manager
- **Description**: Creates a new substructure within a structure

#### List Substructures
- **Endpoint**: `GET /substructures?project_id={project_id}&structure_id={structure_id}`
- **Required Role**: Any authenticated user with project access

### User Assignment (Admin Only)

#### Assign Users to Project
- **Endpoint**: `POST /assignments`
- **Required Role**: Admin
- **Description**: Assigns users to projects with specific roles

### Geological Logs

#### Create Geological Log (Admin, Project Manager, Site Engineer)
- **Endpoint**: `POST /geological-log`
- **Required Role**: Admin, Project Manager, Site Engineer
- **Description**: Creates a new geological log entry

#### Update Geological Log (Project-based Access)
- **Endpoint**: `PUT /geological-log/{borelog_id}`
- **Required Role**: Admin, Project Manager, Site Engineer
- **Project Access**: Must be assigned to the project

## Implementation Details

### Authentication Middleware

The system uses JWT tokens for authentication. Each request must include an Authorization header:

```
Authorization: Bearer <jwt-token>
```

### Role Checking

Role checking is implemented in `src/utils/validateInput.ts`:

```typescript
export const checkRole = (requiredRoles: UserRole[]) => {
  return (event: any) => {
    // Extract and validate JWT token
    // Check if user role is in required roles
    // Return error response or null to proceed
  };
};
```

### Project Access Control

Project-based access control is implemented in `src/utils/projectAccess.ts`:

```typescript
export const checkProjectAccess = (options: ProjectAccessOptions = {}) => {
  return async (event: APIGatewayProxyEvent) => {
    // Extract project ID from request
    // Validate user has access to project
    // Check specific permissions (edit, approve)
    // Return error response or null to proceed
  };
};
```

## Usage Examples

### Creating a Project (Admin)

```bash
curl -X POST https://api.example.com/projects \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Melbourne Metro Tunnel",
    "location": "Melbourne, VIC"
  }'
```

### Assigning Users to Project (Admin)

```bash
curl -X POST https://api.example.com/assignments \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655441001",
    "assignment_type": "AdminToManager",
    "assigner": ["550e8400-e29b-41d4-a716-446655440001"],
    "assignee": ["550e8400-e29b-41d4-a716-446655440002"]
  }'
```

### Creating a Structure (Project Manager)

```bash
curl -X POST https://api.example.com/structures \
  -H "Authorization: Bearer <pm-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655441001",
    "type": "Tunnel",
    "description": "Main tunnel section"
  }'
```

## Database Seeding

To seed the database with sample users and projects:

```bash
npm run seed:users
```

This will create:
- 6 sample users with different roles
- 1 sample project
- Sample user assignments

## Security Considerations

1. **JWT Token Security**: Tokens are signed with a secret key and have expiration times
2. **Role-based Access**: All endpoints check user roles before processing requests
3. **Project Isolation**: Users can only access projects they are assigned to
4. **Input Validation**: All inputs are validated using Zod schemas
5. **SQL Injection Prevention**: All database queries use parameterized statements

## Error Responses

### Authentication Errors
```json
{
  "success": false,
  "message": "Unauthorized: No token provided",
  "error": "Authentication required"
}
```

### Authorization Errors
```json
{
  "success": false,
  "message": "Forbidden: Insufficient permissions",
  "error": "You do not have the required role for this operation"
}
```

### Project Access Errors
```json
{
  "success": false,
  "message": "Forbidden: No access to this project",
  "error": "You are not assigned to this project"
}
```

## Testing

To test the role infrastructure:

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Seed the database**:
   ```bash
   npm run seed:users
   ```

3. **Test different user roles**:
   - Use different mock users from the auth system
   - Verify that users can only access their assigned projects
   - Test role-based permissions for different operations

## Deployment

When deploying to AWS:

1. **Environment Variables**: Ensure `JWT_SECRET` is set in AWS Lambda environment
2. **Database**: Ensure RDS connection is properly configured
3. **IAM Roles**: Verify Lambda execution role has necessary permissions
4. **CORS**: Configure CORS settings for frontend integration

## Frontend Integration

The frontend should:

1. **Store JWT token** in secure storage (localStorage/sessionStorage)
2. **Include token** in all API requests
3. **Handle authentication errors** by redirecting to login
4. **Show/hide UI elements** based on user role
5. **Validate permissions** before making API calls

## Troubleshooting

### Common Issues

1. **"Unauthorized: Invalid token"**
   - Check if JWT token is valid and not expired
   - Verify JWT_SECRET is correctly set

2. **"Forbidden: No access to this project"**
   - Verify user is assigned to the project
   - Check user_project_assignments table

3. **"Forbidden: Insufficient permissions"**
   - Verify user has the required role
   - Check role enum values match expected roles

### Debugging

Enable debug logging by setting log level in the logger configuration:

```typescript
logger.level = 'debug';
```

This will provide detailed information about authentication and authorization decisions. 