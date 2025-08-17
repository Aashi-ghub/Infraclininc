# Borelog API System Guide

## Overview

This guide explains the new borelog system with version control, role-based access, and integration with your existing React frontend.

## Database Schema

### Key Tables

1. **`boreloge`** - Main borelog records
   - `borelog_id` (UUID, Primary Key)
   - `substructure_id` (UUID, Foreign Key)
   - `project_id` (UUID, Foreign Key)
   - `type` (ENUM: 'Geotechnical', 'Geological')
   - `created_by_user_id` (UUID, Foreign Key)
   - `created_at` (TIMESTAMP)

2. **`borelog_details`** - Versioned borelog data
   - `borelog_id` (UUID, Primary Key)
   - `version_no` (INTEGER) - **NEW: Version control**
   - All borelog fields (number, msl, boring_method, etc.)
   - `created_by_user_id` (UUID, Foreign Key)
   - `created_at` (TIMESTAMP)

3. **`projects`** - Project information
4. **`structure`** - Structure definitions
5. **`sub_structures`** - Substructure definitions

## API Endpoints

### 1. Create Borelog Details
```http
POST /borelog-details
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "substructure_id": "uuid",
  "project_id": "uuid",
  "type": "Geotechnical" | "Geological",
  "number": "BH-001",
  "msl": "100.5",
  "boring_method": "Rotary Drilling",
  "hole_diameter": 150,
  "commencement_date": "2024-01-15",
  "completion_date": "2024-01-20",
  "standing_water_level": 5.2,
  "termination_depth": 25.0,
  "coordinate": {
    "lat": 1.2345,
    "lng": 103.6789
  },
  "permeability_test_count": "3",
  "spt_vs_test_count": "5",
  "undisturbed_sample_count": "10",
  "disturbed_sample_count": "15",
  "water_sample_count": "2",
  "stratum_description": "Clay layer with sand lenses",
  "stratum_depth_from": 0.0,
  "stratum_depth_to": 5.0,
  "stratum_thickness_m": 5.0,
  "remarks": "Good quality samples obtained"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Borelog details created successfully",
  "data": {
    "borelog_id": "uuid",
    "version_no": 1,
    "details": {
      "borelog_id": "uuid",
      "version_no": 1
    }
  }
}
```

### 2. Get Borelog Details with Version History
```http
GET /borelog-details/{borelog_id}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Borelog details retrieved successfully",
  "data": {
    "borelog_id": "uuid",
    "borelog_type": "Geotechnical",
    "project": {
      "project_id": "uuid",
      "name": "Project Name",
      "location": "Project Location"
    },
    "structure": {
      "structure_type": "Tunnel",
      "description": "Main Tunnel",
      "substructure_type": "P1",
      "substructure_remark": "Portal 1"
    },
    "version_history": [
      {
        "version_no": 2,
        "created_at": "2024-01-20T10:30:00Z",
        "created_by": {
          "user_id": "uuid",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "details": {
          "number": "BH-001",
          "msl": "100.5",
          "boring_method": "Rotary Drilling",
          // ... all other fields
        }
      },
      {
        "version_no": 1,
        "created_at": "2024-01-15T14:20:00Z",
        "created_by": {
          "user_id": "uuid",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "details": {
          // ... version 1 data
        }
      }
    ],
    "latest_version": {
      // ... latest version data
    }
  }
}
```

### 3. Get All Borelogs for a Project
```http
GET /projects/{project_id}/borelogs
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Borelogs retrieved successfully",
  "data": {
    "project": {
      "project_id": "uuid",
      "name": "Project Name",
      "location": "Project Location"
    },
    "borelogs": [
      {
        "structure": {
          "structure_id": "uuid",
          "type": "Tunnel",
          "description": "Main Tunnel"
        },
        "substructure": {
          "substructure_id": "uuid",
          "type": "P1",
          "remark": "Portal 1"
        },
        "borelogs": [
          {
            "borelog_id": "uuid",
            "type": "Geotechnical",
            "version_no": 2,
            "created_at": "2024-01-20T10:30:00Z",
            "created_by": {
              "user_id": "uuid",
              "name": "John Doe",
              "email": "john@example.com"
            },
            "details": {
              // ... latest version details
            }
          }
        ]
      }
    ]
  }
}
```

### 4. Get Form Data (Projects, Structures, Substructures)
```http
GET /borelog-form-data
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Form data retrieved successfully",
  "data": {
    "projects": [
      {
        "project_id": "uuid",
        "name": "Project Name",
        "location": "Project Location",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "structures_by_project": {
      "project_uuid": [
        {
          "structure_id": "uuid",
          "type": "Tunnel",
          "description": "Main Tunnel",
          "created_at": "2024-01-01T00:00:00Z"
        }
      ]
    },
    "substructures_by_structure": {
      "structure_uuid": [
        {
          "substructure_id": "uuid",
          "type": "P1",
          "remark": "Portal 1",
          "project_id": "uuid",
          "created_at": "2024-01-01T00:00:00Z"
        }
      ]
    }
  }
}
```

## Role-Based Access Control

### Site Engineer
- ✅ Can create/update borelog details for **assigned projects only**
- ✅ Can view version history for assigned projects
- ❌ Cannot approve final versions

### Project Manager
- ✅ Can view all borelogs in their projects
- ✅ Can view version history
- ✅ Can approve final versions
- ✅ Can create borelog details

### Admin
- ✅ Full access to all projects and borelogs
- ✅ Can view all version history
- ✅ Can approve/reject versions
- ✅ Can create borelog details

## Frontend Integration

### Updated BorelogEntryForm Component

The existing `BorelogEntryForm` component has been updated to use the new API endpoints:

1. **Data Loading**: Uses `borelogApiV2.getFormData()` for dropdowns
2. **Form Submission**: Uses `borelogApiV2.createDetails()` for creating new versions
3. **Version History**: Uses `borelogApiV2.getDetailsByBorelogId()` for version tracking

### Key Changes Made

1. **Project/Structure/Substructure Selection**:
   - Projects are filtered by user role (Site Engineers see only assigned projects)
   - Structures are loaded per project
   - Substructures are loaded per structure
   - **NEW**: Added dedicated substructure dropdown in the form header
   - **NEW**: Substructure selection is now clearly separated from borehole selection

2. **Form Submission**:
   - Creates new borelog if it doesn't exist
   - Always creates a new version in `borelog_details`
   - Increments version number automatically
   - Includes `created_by_user_id` and timestamp
   - **NEW**: Termination depth is automatically calculated from stratum data

3. **Version Control**:
   - Each submission creates a new version
   - Previous versions are preserved
   - Version history is displayed with timestamps and user info

## Database Migration

Run the migration to add version control:

```sql
-- Run this migration first
\i backend/migrations/add_version_no_to_borelog_details.sql
```

This migration:
- Adds `version_no` column to `borelog_details`
- Sets default version numbers for existing records
- Creates indexes for performance
- Adds unique constraint to prevent duplicate versions

## Example Usage

### 1. Load Form Data
```javascript
import { borelogApiV2 } from '@/lib/api';

// Load all form data
const response = await borelogApiV2.getFormData();
const { projects, structures_by_project, substructures_by_structure } = response.data.data;

// Load filtered data
const projectData = await borelogApiV2.getFormData({ project_id: 'project-uuid' });
const structureData = await borelogApiV2.getFormData({ structure_id: 'structure-uuid' });
```

### 2. Create Borelog Details
```javascript
const borelogData = {
  substructure_id: 'substructure-uuid',
  project_id: 'project-uuid',
  type: 'Geotechnical',
  number: 'BH-001',
  msl: '100.5',
  boring_method: 'Rotary Drilling',
  hole_diameter: 150,
  commencement_date: '2024-01-15',
  completion_date: '2024-01-20',
  standing_water_level: 5.2,
  termination_depth: 25.0,
  remarks: 'Good quality samples obtained'
};

const response = await borelogApiV2.createDetails(borelogData);
console.log(`Created version ${response.data.data.version_no}`);
```

### 3. View Version History
```javascript
const response = await borelogApiV2.getDetailsByBorelogId('borelog-uuid');
const { version_history, latest_version } = response.data.data;

// Display version history
version_history.forEach(version => {
  console.log(`Version ${version.version_no}: ${version.created_at}`);
});
```

### 4. View Project Borelogs
```javascript
const response = await borelogApiV2.getByProject('project-uuid');
const { project, borelogs } = response.data.data;

// Display grouped borelogs
borelogs.forEach(group => {
  console.log(`Structure: ${group.structure.type}`);
  group.borelogs.forEach(borelog => {
    console.log(`  Borelog: ${borelog.details.number} (v${borelog.version_no})`);
  });
});
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

Common error scenarios:
- **401**: Unauthorized (invalid/missing token)
- **403**: Forbidden (insufficient permissions)
- **400**: Bad Request (validation errors)
- **404**: Not Found (resource doesn't exist)
- **500**: Internal Server Error

## Testing

### 1. Test API Endpoints
```bash
# Test form data loading
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/dev/borelog-form-data

# Test borelog creation
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"substructure_id":"uuid","project_id":"uuid","type":"Geotechnical"}' \
  http://localhost:3000/dev/borelog-details
```

### 2. Test Frontend Integration
1. Navigate to the borelog entry form
2. Select project → structure → substructure
3. Fill in borelog details
4. Submit form
5. Verify new version is created
6. Check version history

## Deployment

1. **Run Database Migration**:
   ```bash
   psql -d your_database -f backend/migrations/add_version_no_to_borelog_details.sql
   ```

2. **Deploy Backend**:
   ```bash
   cd backend
   serverless deploy
   ```

3. **Update Frontend**:
   - The existing `BorelogEntryForm` component is already updated
   - No additional frontend deployment needed

## Summary

The new borelog system provides:
- ✅ Version control with automatic version numbering
- ✅ Role-based access control
- ✅ Integration with existing UI components
- ✅ Preserved data integrity
- ✅ Comprehensive API documentation
- ✅ Backward compatibility with existing data

The system is now ready for production use with your existing React frontend!
