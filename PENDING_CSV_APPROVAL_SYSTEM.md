# Pending CSV Approval System

## Overview

The pending CSV approval system ensures that bulk CSV borelog uploads are not directly created in the main database tables until they are approved by authorized personnel (Approval Engineer, Admin, or Project Manager). This provides a safety mechanism and quality control for bulk data imports.

## System Architecture

### 1. Database Changes

#### New Table: `pending_csv_uploads`

```sql
CREATE TABLE pending_csv_uploads (
  upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  structure_id UUID NOT NULL,
  substructure_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- CSV metadata
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('csv', 'excel')),
  total_records INTEGER NOT NULL,
  
  -- Parsed data (stored as JSONB for flexibility)
  borelog_header_data JSONB NOT NULL,
  stratum_rows_data JSONB NOT NULL,
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned_for_revision')),
  submitted_for_approval_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  returned_by UUID,
  returned_at TIMESTAMPTZ,
  
  -- Comments and feedback
  approval_comments TEXT,
  rejection_reason TEXT,
  revision_notes TEXT,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  created_borelog_id UUID,
  error_message TEXT,
  
  -- Foreign key constraints
  FOREIGN KEY (project_id) REFERENCES projects (project_id) ON DELETE CASCADE,
  FOREIGN KEY (structure_id) REFERENCES structure (structure_id) ON DELETE CASCADE,
  FOREIGN KEY (substructure_id) REFERENCES sub_structures (substructure_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users (user_id) ON DELETE SET NULL,
  FOREIGN KEY (rejected_by) REFERENCES users (user_id) ON DELETE SET NULL,
  FOREIGN KEY (returned_by) REFERENCES users (user_id) ON DELETE SET NULL,
  FOREIGN KEY (created_borelog_id) REFERENCES boreloge (borelog_id) ON DELETE SET NULL
);
```

### 2. Modified Handlers

#### `uploadBorelogCSV.ts`
- **Before**: Directly created borelogs in main tables
- **After**: Stores CSV data in `pending_csv_uploads` table with status 'pending'
- **Response**: Returns `upload_id` and status 'pending' instead of created borelog

#### `uploadBoreholeCsv.ts`
- **Before**: Directly created borelogs in main tables
- **After**: Stores CSV data in `pending_csv_uploads` table with status 'pending'
- **Response**: Returns `upload_id` and status 'pending' instead of created borelog

### 3. New Handlers

#### `approvePendingCSVUpload.ts`
- **Purpose**: Approve, reject, or return CSV uploads for revision
- **Access**: Approval Engineer, Admin, Project Manager
- **Actions**:
  - `approve`: Creates actual borelog from pending data
  - `reject`: Marks upload as rejected with reason
  - `return_for_revision`: Returns upload for revision with notes

#### `listPendingCSVUploads.ts`
- **Purpose**: List all pending CSV uploads with filtering and pagination
- **Access**: Approval Engineer, Admin, Project Manager
- **Features**: Filter by project, status, pagination support

#### `getPendingCSVUpload.ts`
- **Purpose**: Get detailed information about a specific pending CSV upload
- **Access**: Approval Engineer, Admin, Project Manager
- **Data**: Full CSV data, approval history, user information

## Workflow

### 1. CSV Upload Process
```
User uploads CSV → Data validation → Store in pending_csv_uploads → Return upload_id
```

### 2. Approval Process
```
Approver reviews pending upload → Makes decision (approve/reject/return) → 
If approved: Creates actual borelog → Updates pending upload status
```

### 3. Status Flow
```
pending → approved (creates borelog)
      → rejected (with reason)
      → returned_for_revision (with notes)
```

## API Endpoints

### 1. Upload CSV (Modified)
```http
POST /upload-borelog-csv
POST /upload-borehole-csv

Response:
{
  "success": true,
  "message": "CSV upload stored successfully and pending approval...",
  "data": {
    "upload_id": "uuid",
    "status": "pending",
    "next_steps": "Upload is pending approval by an Approval Engineer, Admin, or Project Manager"
  }
}
```

### 2. List Pending Uploads
```http
GET /pending-csv-uploads?project_id={id}&status={status}&limit={limit}&offset={offset}

Response:
{
  "success": true,
  "data": {
    "uploads": [...],
    "pagination": {
      "total": 100,
      "limit": 50,
      "offset": 0,
      "has_more": true
    }
  }
}
```

### 3. Get Pending Upload Details
```http
GET /pending-csv-uploads/{upload_id}

Response:
{
  "success": true,
  "data": {
    "upload_id": "uuid",
    "borelog_header": {...},
    "stratum_rows": [...],
    "status": "pending",
    "uploaded_by_name": "John Doe",
    ...
  }
}
```

### 4. Approve/Reject/Return Upload
```http
POST /pending-csv-uploads/{upload_id}/approve

Body:
{
  "action": "approve|reject|return_for_revision",
  "comments": "Optional approval comments",
  "revision_notes": "Required if action is return_for_revision"
}

Response (approve):
{
  "success": true,
  "message": "CSV upload approved and borelog created successfully",
  "data": {
    "upload_id": "uuid",
    "borelog_id": "uuid",
    "status": "approved",
    "stratum_layers_created": 15
  }
}
```

## User Roles and Permissions

### 1. Site Engineers
- **Can**: Upload CSV files
- **Cannot**: Approve, reject, or view pending uploads
- **Result**: CSV uploads go to pending status

### 2. Approval Engineers
- **Can**: View, approve, reject, return CSV uploads
- **Cannot**: Upload CSV files
- **Primary Role**: Quality control and approval

### 3. Project Managers
- **Can**: Upload CSV files, view, approve, reject, return CSV uploads
- **Role**: Both uploader and approver

### 4. Admins
- **Can**: All operations
- **Role**: Full system access

## Benefits

### 1. Quality Control
- Prevents invalid data from entering production database
- Allows review of bulk imports before commitment
- Provides feedback mechanism for data quality issues

### 2. Audit Trail
- Complete history of CSV uploads
- Tracks who uploaded, who approved/rejected, when, and why
- Links pending uploads to final borelogs

### 3. Data Safety
- No accidental creation of borelogs from invalid CSV data
- Ability to reject problematic uploads
- Return uploads for correction and resubmission

### 4. Workflow Management
- Clear separation of upload and approval responsibilities
- Structured approval process with comments and feedback
- Status tracking throughout the approval lifecycle

## Migration

### 1. Database Migration
Run the migration file:
```bash
# Apply the new table
psql -d your_database -f backend/migrations/create_pending_csv_uploads_table.sql
```

### 2. Handler Updates
The existing CSV upload handlers have been modified to use the new system. No additional configuration is required.

### 3. Frontend Updates
Frontend applications should be updated to:
- Handle the new response format (upload_id instead of borelog_id)
- Show pending status and next steps
- Provide interfaces for approvers to review and act on pending uploads

## Error Handling

### 1. Validation Errors
- CSV parsing errors are caught and logged
- Invalid data doesn't prevent upload storage
- Errors are stored in the pending upload for review

### 2. Approval Errors
- Database transaction rollback on approval failure
- Error messages stored in pending upload
- Upload remains in pending status for retry

### 3. Data Integrity
- Foreign key constraints ensure data consistency
- Rollback mechanisms prevent partial data creation
- Audit trail maintained even on failures

## Monitoring and Maintenance

### 1. Performance
- Indexes on frequently queried fields
- Pagination for large upload lists
- Efficient JSONB storage for CSV data

### 2. Cleanup
- Consider archiving old approved/rejected uploads
- Monitor table size and performance
- Regular cleanup of temporary data

### 3. Reporting
- Track approval times and rates
- Monitor rejection reasons for process improvement
- Identify common data quality issues

## Future Enhancements

### 1. Automated Validation
- Rule-based validation before approval
- Integration with external validation services
- Machine learning for data quality assessment

### 2. Workflow Automation
- Automatic routing to appropriate approvers
- Escalation for overdue approvals
- Integration with notification systems

### 3. Advanced Features
- Bulk approval operations
- Template-based CSV validation
- Integration with external approval systems
