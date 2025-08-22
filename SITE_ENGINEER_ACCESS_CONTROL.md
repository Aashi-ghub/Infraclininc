# Site Engineer Access Control Implementation

## Overview

This document describes the implementation of role-based access control for Site Engineers, ensuring they can only access and modify borelogs and geological logs that are assigned to them.

## Key Features

### 1. Assignment-Based Access Control
- Site Engineers can see all projects in the system
- When selecting a specific project, they only see borelogs that are assigned to them within that project
- Access is controlled through the `borelog_assignments` table
- Project Managers and Admins can assign borelogs to Site Engineers

### 2. Backend Implementation

#### New Utility Functions (`backend/src/utils/projectAccess.ts`)
- `checkBorelogAssignment()`: Checks if a site engineer is assigned to a specific borelog
- `getAssignedBorelogsForSiteEngineer()`: Gets all assigned borelog IDs for a site engineer
- `getAssignedSubstructuresForSiteEngineer()`: Gets all assigned substructure IDs for a site engineer
- `getProjectsForSiteEngineer()`: Gets all projects with assignment counts for site engineers
- `getProjectDetailsForSiteEngineer()`: Gets detailed project information with borelog assignments for site engineers

#### Updated Handlers

**Project Handlers:**
- `projects.ts`: Updated to show all projects for site engineers with assignment counts
- `getBorelogFormData.ts`: Updated to show all projects, structures, and substructures for site engineers

**Geological Log Handlers:**
- `getGeologicalLogById.ts`: Added assignment checking for site engineers
- `listGeologicalLogs.ts`: Filters results to show only assigned logs for site engineers
- `createGeologicalLog.ts`: Prevents creation for non-assigned borelogs
- `updateGeologicalLog.ts`: Prevents updates for non-assigned borelogs
- `deleteGeologicalLog.ts`: Prevents deletion of non-assigned borelogs
- `getGeologicalLogsByProjectNameWithSubstructures.ts`: Filters by assignments

**Borelog Handlers:**
- `getBorelogsByProject.ts`: Updated to filter borelogs for site engineers based on assignments within the selected project
- `createBorelogDetails.ts`: Added assignment checking for site engineers
- `getBorelogDetailsByBorelogId.ts`: Added assignment checking for site engineers
- `getBorelogBySubstructureId.ts`: Already had project-based filtering

**Assignment Handlers:**
- `borelogAssignments.ts`: Added `getMyAssignments()` endpoint for site engineers to view their assignments

### 3. Frontend Implementation

#### Updated Components
- `projects/list.tsx`: Enhanced to show assignment counts for site engineers
  - Shows "(My Assignments)" in the title for site engineers
  - Displays assignment count badges for projects with assignments
  - Shows "No assignments in this project" for projects without assignments
  - Provides clear messaging when no assignments exist

#### User Experience
- Site Engineers can browse all projects in the system
- Assignment counts are clearly displayed for each project
- When viewing a specific project, only assigned borelogs are visible
- Clear messaging when no assignments exist
- Consistent access control across all endpoints

## Database Schema

### Borelog Assignments Table
```sql
CREATE TABLE borelog_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borelog_id UUID,
  structure_id UUID,
  substructure_id UUID,
  assigned_site_engineer UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  notes TEXT,
  expected_completion_date DATE,
  completed_at TIMESTAMPTZ,
  
  -- Ensure at least one of borelog_id, structure_id, or substructure_id is provided
  CONSTRAINT check_assignment_target CHECK (
    (borelog_id IS NOT NULL) OR 
    (structure_id IS NOT NULL) OR 
    (substructure_id IS NOT NULL)
  ),
  
  FOREIGN KEY (borelog_id) REFERENCES boreloge(borelog_id) ON DELETE CASCADE,
  FOREIGN KEY (structure_id) REFERENCES structure(structure_id) ON DELETE CASCADE,
  FOREIGN KEY (substructure_id) REFERENCES sub_structures(substructure_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_site_engineer) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE CASCADE
);
```

## API Endpoints

### Projects
- `GET /projects` - Lists all projects (with assignment counts for site engineers)

### Geological Logs
- `GET /geological-log` - Lists geological logs (filtered for site engineers)
- `GET /geological-log/{id}` - Gets specific geological log (assignment check)
- `POST /geological-log` - Creates geological log (assignment check)
- `PUT /geological-log/{id}` - Updates geological log (assignment check)
- `DELETE /geological-log/{id}` - Deletes geological log (assignment check)

### Borelogs
- `GET /borelogs/project/{project_id}` - Gets borelogs for a project (filtered for site engineers)
- `GET /borelog-details/{borelog_id}` - Gets borelog details (assignment check)
- `POST /borelog-details` - Creates borelog details (assignment check)

### Form Data
- `GET /borelog-form-data` - Gets form data (all projects, structures, substructures for site engineers)

### Assignments
- `GET /borelog-assignments/my` - Gets current user's assignments (site engineers only)

## Access Control Flow

### For Site Engineers:
1. **Project Browsing**: Can see all projects in the system with assignment counts
2. **Project Selection**: When selecting a project, system filters borelogs to show only assigned ones
3. **Authentication**: User must be authenticated with Site Engineer role
4. **Assignment Check**: System checks if user is assigned to the specific borelog/substructure
5. **Access Grant**: Only if assignment exists and is active
6. **Data Filtering**: Lists and queries return only assigned items within the selected project

### For Other Roles:
- **Admin**: Full access to all data
- **Project Manager**: Access to all data within assigned projects
- **Approval Engineer**: Access to all data within assigned projects
- **Lab Engineer**: Access to all data within assigned projects
- **Customer**: Read-only access to assigned projects

## Error Messages

### Access Denied (403)
- "Access denied: Borelog not assigned to you"
- "You can only access borelogs that are assigned to you"
- "You can only create/update/delete geological logs for borelogs that are assigned to you"

### No Assignments
- "No assigned borelogs found for this project"
- "You don't have any project assignments yet."
- "Contact your Project Manager to get assigned to borelogs."

## Security Considerations

1. **Assignment Validation**: All operations check for active assignments
2. **Role-Based Access**: Different access levels based on user role
3. **Project Isolation**: Users can only access data within their assigned projects
4. **Audit Trail**: All operations are logged with user information

## Testing

### Test Cases
1. Site Engineer can see all projects with assignment counts
2. Site Engineer with assignments can access assigned borelogs within a project
3. Site Engineer without assignments for a project sees empty result with appropriate message
4. Site Engineer cannot access non-assigned borelogs
5. Site Engineer cannot create/update/delete non-assigned borelogs
6. Other roles maintain their existing access levels
7. Assignment changes immediately affect access

### Manual Testing
1. Login as Site Engineer
2. Navigate to Projects page
3. Verify all projects are visible with assignment counts
4. Select a project with assignments
5. Verify only assigned borelogs are visible
6. Try to access non-assigned borelogs (should be denied)
7. Try to create/update borelogs for non-assigned projects (should be denied)

## Future Enhancements

1. **Assignment Notifications**: Email notifications when assignments are created/updated
2. **Assignment History**: Track assignment changes over time
3. **Bulk Operations**: Allow bulk assignment of multiple borelogs
4. **Assignment Expiry**: Automatic expiry of old assignments
5. **Assignment Templates**: Predefined assignment patterns for common scenarios
6. **Project Dashboard**: Enhanced project view with assignment summaries

## Migration Notes

This implementation is backward compatible and doesn't require database migrations for existing data. The access control is additive and doesn't affect existing functionality for other roles.
