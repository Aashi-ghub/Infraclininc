# Borelog Entry Form Implementation

## Overview

This document describes the implementation of the Borelog Entry Form that follows the Excel "Specimen Field Log" format with color-coded fields, auto-calculation, and version control.

## Features Implemented

### 1. Field Types by Color
- **🟡 Yellow cells** = Manual text/number/date input fields
- **🟠 Brown cells** = Auto-calculated fields (formula-based)
- **⚪ White cells** = Auto-filled fields (read-only, pre-populated)

### 2. Form Structure
- Groups fields as per Excel layout
- Supports addable sub-parts (insert new rows between existing ones)
- Each row has unique ID for version tracking
- Sections for project info, borehole details, observations, core details

### 3. UI Behavior
- Auto-calculate brown fields in real-time when relevant yellow inputs change
- Allow insertion of additional observations anywhere in the form
- Auto-save form state every 30 seconds in localStorage
- "Submit for Review" button creates new versioned records

### 4. Version Control
- Each submission includes:
  - `version_number` (incremented from previous)
  - `edited_by` (logged-in user ID)
  - `timestamp`
- Stored in `borelog_submissions` table

### 5. Role Restriction
- Only **Site Engineer** role can edit
- Other roles see read-only version
- Admin and Project Manager can also access

### 6. Data Binding
- Project dropdown fetches from backend
- Borehole ID selected from assigned boreholes
- White fields auto-filled from project & borehole metadata

### 7. Validation
- Mandatory fields validation
- Numeric field range validation
- Date field logical order validation

## File Structure

### Frontend Components
```
frontend/src/
├── components/
│   └── BorelogEntryForm.tsx          # Main form component
├── pages/
│   └── borelog/
│       └── entry.tsx                 # Entry page with data fetching
├── lib/
│   ├── types.ts                      # TypeScript interfaces
│   ├── api.ts                        # API functions
│   ├── zodSchemas.ts                 # Validation schemas
│   └── borelogCalculations.ts        # Calculation utilities
```

### Backend Handlers
```
backend/src/
├── handlers/
│   └── borelogSubmission.ts          # Submission handlers
├── sql                               # Database schema
└── serverless.ts                     # API endpoints
```

## Database Schema

### borelog_submissions Table
```sql
CREATE TABLE borelog_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  structure_id UUID NOT NULL,
  borehole_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  edited_by UUID NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  form_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (project_id) REFERENCES projects (project_id),
  FOREIGN KEY (structure_id) REFERENCES structure (structure_id),
  FOREIGN KEY (borehole_id) REFERENCES borehole (borehole_id),
  FOREIGN KEY (edited_by) REFERENCES users (user_id),
  
  UNIQUE (project_id, structure_id, borehole_id, version_number)
);
```

## API Endpoints

### POST /borelog/submit
- **Purpose**: Submit new borelog entry
- **Access**: Site Engineer, Admin, Project Manager
- **Body**: BorelogSubmission data
- **Response**: Submission confirmation with version number

### GET /borelog/submissions/{projectId}/{boreholeId}
- **Purpose**: Get all submissions for a borehole
- **Access**: Site Engineer, Admin, Project Manager, Approval Engineer
- **Response**: Array of submissions ordered by version

### GET /borelog/submission/{submissionId}
- **Purpose**: Get specific submission details
- **Access**: Site Engineer, Admin, Project Manager, Approval Engineer
- **Response**: Single submission with form data

## Field Definitions

### Project Information Section
```typescript
const projectInfo = [
  { id: 'project_name', name: 'Project Name', fieldType: 'auto-filled', isRequired: true },
  { id: 'job_code', name: 'Job Code', fieldType: 'manual', isRequired: true },
  { id: 'section_name', name: 'Section Name', fieldType: 'manual', isRequired: false },
  // ... more fields
];
```

### Test Counts Section
```typescript
const testCounts = [
  { 
    id: 'permeability_tests', 
    name: 'No. of Permeability test (PT)', 
    fieldType: 'calculated', 
    calculation: 'count(permeability_test_rows)' 
  },
  // ... more calculated fields
];
```

### Stratum Description Section
```typescript
const stratumDescription = [
  { id: 'stratum_desc', name: 'Description of Soil Stratum & Rock Methodology', fieldType: 'manual', isRequired: true },
  { id: 'depth_from', name: 'Depth of Stratum (m)', fieldType: 'manual', isRequired: true },
  { id: 'depth_to', name: 'To', fieldType: 'manual', isRequired: true },
  { 
    id: 'thickness', 
    name: 'Thickness of Stratum (m)', 
    fieldType: 'calculated', 
    calculation: 'depth_to - depth_from', 
    dependencies: ['depth_from', 'depth_to'] 
  },
  // ... more fields
];
```

## Calculation Engine

The form includes a calculation engine that handles:

### Arithmetic Operations
- Addition: `field1 + field2`
- Subtraction: `field1 - field2`
- Multiplication: `field1 * field2`
- Division: `field1 / field2`

### Count Operations
- Row counting: `count(permeability_test_rows)`
- Sample counting: `count(undisturbed_sample_rows)`

### Complex Formulas
- Percentage calculations: `(total_core_length / run_length) * 100`
- N-value calculations: `spt_blows_1 + spt_blows_2 + spt_blows_3`

## Usage Instructions

### For Site Engineers
1. Navigate to `/borelog/entry`
2. Select project, structure, and borehole
3. Fill in yellow (manual) fields
4. Brown fields auto-calculate
5. White fields auto-populate
6. Add new rows as needed
7. Save draft or submit for review

### For Other Roles
1. Navigate to `/borelog/entry`
2. View form in read-only mode
3. Cannot edit fields or submit

## Auto-save Feature

- Form state saved to localStorage every 30 seconds
- Prevents data loss during editing
- Automatically loads saved state on page refresh
- Cleared after successful submission

## Validation Rules

### Required Fields
- Project Name
- Job Code
- Borehole Number
- Method of Boring
- Diameter of Hole
- Commencement Date
- Completion Date
- Termination Depth

### Numeric Validation
- Depth values must be positive
- Diameter must be > 0
- Dates must be logical (start ≤ end)

### Pattern Validation
- Email addresses
- Phone numbers
- Coordinate formats

## Security Features

### Role-Based Access Control
- Server-side role validation
- Client-side UI rendering based on role
- Project-level access control

### Input Validation
- Zod schema validation
- SQL injection prevention
- XSS protection

### Version Control
- Immutable submissions
- Audit trail with user and timestamp
- No overwriting of previous versions

## Error Handling

### Frontend
- Form validation errors
- API error responses
- Network connectivity issues
- Auto-save failures

### Backend
- Database constraint violations
- Invalid version numbers
- Unauthorized access attempts
- Malformed JSON data

## Performance Considerations

### Frontend
- Debounced auto-save
- Lazy loading of large datasets
- Efficient re-rendering with React hooks
- Local state management

### Backend
- Database indexes on frequently queried fields
- Connection pooling
- Query optimization
- Response caching where appropriate

## Future Enhancements

1. **Offline Support**: Service worker for offline editing
2. **Bulk Operations**: Import/export multiple borelogs
3. **Advanced Calculations**: More complex geological formulas
4. **Image Integration**: Attach photos to specific fields
5. **Collaborative Editing**: Real-time multi-user editing
6. **Audit Trail**: Detailed change history
7. **PDF Export**: Generate formatted reports
8. **Mobile Optimization**: Touch-friendly interface

## Testing

### Unit Tests
- Field calculation logic
- Validation rules
- API response handling

### Integration Tests
- End-to-end form submission
- Role-based access control
- Version control workflow

### Manual Testing
- Cross-browser compatibility
- Mobile responsiveness
- Performance under load

## Deployment

### Frontend
```bash
cd frontend
npm run build
# Deploy to hosting service
```

### Backend
```bash
cd backend
npm run deploy
# Deploy to AWS Lambda
```

### Database
```bash
# Run SQL migrations
psql -d your_database -f backend/sql
```

## Troubleshooting

### Common Issues
1. **Auto-save not working**: Check localStorage permissions
2. **Calculations not updating**: Verify field dependencies
3. **Permission errors**: Check user role assignments
4. **Version conflicts**: Ensure version numbers are sequential

### Debug Mode
Enable debug logging in development:
```typescript
// In borelogCalculations.ts
const DEBUG = process.env.NODE_ENV === 'development';
```

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.
