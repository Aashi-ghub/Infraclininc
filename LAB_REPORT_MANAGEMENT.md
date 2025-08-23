# Lab Report Management System

## Overview

The Lab Report Management System is a comprehensive workflow solution for managing laboratory test requests and reports in the Borelog & Geological Data Management System. It provides role-based access control and a complete workflow from test request creation to final approval.

## Features

### Role-Based Access Control

The system supports four main user roles:

1. **Project Manager**
   - Create lab test requests
   - View all requests and their status
   - Assign priority levels
   - Set due dates

2. **Lab Engineer**
   - View pending lab requests
   - Submit lab reports with test results
   - Upload PDF reports
   - Track version history of submitted reports

3. **Approval Engineer**
   - Review submitted lab reports
   - Approve or reject reports with comments
   - View approval history

4. **Customer**
   - View only approved lab reports
   - Download final reports
   - Read-only access to test results

### Core Functionality

#### Lab Test Requests
- **Request Creation**: Project managers can create requests specifying:
  - Borelog/Borehole selection
  - Sample ID
  - Test type (with categorized options)
  - Priority level (Low, Medium, High, Urgent)
  - Due date
  - Additional notes

- **Request Management**: 
  - Track request status (Pending, In Progress, Completed, Cancelled)
  - Filter and search requests
  - View request history

#### Lab Reports
- **Report Submission**: Lab engineers can submit reports including:
  - Test results (text/JSON format)
  - PDF file uploads
  - Version tracking
  - Status management

- **Report Review Process**:
  - Approval engineers can review submitted reports
  - Approve with optional comments
  - Reject with required comments
  - Version history tracking

#### Status Workflow
```
Pending → In Progress → Submitted → Under Review → Approved/Rejected
```

## Technical Implementation

### Frontend Components

#### Main Components
- `LabReportManagement` (`/pages/lab-reports/index.tsx`)
  - Main dashboard with role-based views
  - Tab-based role switching
  - Search and filter functionality

- `LabReportView` (`/components/LabReportView.tsx`)
  - Detailed report viewing modal
  - Approval/rejection actions
  - Version history display

- `LabRequestForm` (`/components/LabRequestForm.tsx`)
  - Form for creating new lab test requests
  - Borelog selection
  - Test type categorization

#### UI Features
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with Tailwind CSS and shadcn/ui components
- **Real-time Updates**: Status changes reflect immediately
- **File Upload**: PDF report upload functionality
- **Search & Filter**: Advanced filtering by status, type, and keywords

### Data Models

#### LabRequest Interface
```typescript
interface LabRequest {
  id: string;
  borelog_id: string;
  sample_id: string;
  requested_by: string;
  requested_date: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  test_type: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  due_date?: string;
  notes?: string;
  borelog: {
    borehole_number: string;
    project_name: string;
    chainage?: string;
  };
}
```

#### LabReport Interface
```typescript
interface LabReport {
  id: string;
  request_id: string;
  borelog_id: string;
  sample_id: string;
  test_type: string;
  results: string;
  file_url?: string;
  submitted_by: string;
  submitted_at: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  version: number;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_comments?: string;
  borelog: {
    borehole_number: string;
    project_name: string;
    chainage?: string;
  };
}
```

### API Endpoints

#### Lab Requests
- `GET /lab-requests` - Get all lab requests
- `GET /lab-requests/:id` - Get specific request
- `POST /lab-requests` - Create new request
- `PUT /lab-requests/:id` - Update request
- `DELETE /lab-requests/:id` - Delete request

#### Lab Reports
- `GET /lab-reports` - Get all lab reports
- `GET /lab-reports/:id` - Get specific report
- `POST /lab-reports` - Create new report
- `PUT /lab-reports/:id` - Update report
- `DELETE /lab-reports/:id` - Delete report
- `PUT /lab-reports/:id/review` - Review (approve/reject) report
- `GET /lab-reports/status/:status` - Get reports by status
- `GET /lab-reports/role/:role` - Get reports by user role

## Usage Guide

### For Project Managers

1. **Creating Lab Test Requests**
   - Navigate to Lab Reports page
   - Click "Create Request" button
   - Select borelog/borehole
   - Enter sample ID
   - Choose test type from categorized list
   - Set priority and due date
   - Add notes if needed
   - Submit request

2. **Monitoring Requests**
   - View all requests in the main table
   - Filter by status, priority, or search terms
   - Track request progress

### For Lab Engineers

1. **Viewing Pending Requests**
   - Switch to "Lab Engineer" role tab
   - View pending requests in the table
   - Click "Submit Report" for each request

2. **Submitting Reports**
   - Select test type
   - Enter detailed test results
   - Upload PDF report (optional)
   - Submit for review

3. **Tracking Submissions**
   - View submitted reports
   - Check approval status
   - Access version history

### For Approval Engineers

1. **Reviewing Reports**
   - Switch to "Approval Engineer" role tab
   - View submitted reports pending review
   - Click "View" to see full report details

2. **Approving/Rejecting**
   - Review test results and attached files
   - Approve with optional comments
   - Reject with required comments
   - Track decision history

### For Customers

1. **Viewing Approved Reports**
   - Switch to "Customer" role tab
   - View only approved reports
   - Download final reports
   - Access test results

## Test Types

The system includes a comprehensive list of test types organized by categories:

### Strength Tests
- Compressive Strength Test
- Tensile Strength Test
- Shear Strength Test
- California Bearing Ratio (CBR) Test

### Soil Tests
- Density Test
- Moisture Content Test
- Atterberg Limits Test
- Consolidation Test
- Proctor Compaction Test

### Hydraulic Tests
- Permeability Test

## Security & Access Control

- **Role-based Access**: Each role has specific permissions
- **Data Isolation**: Users only see data relevant to their role
- **Audit Trail**: All actions are logged with timestamps
- **File Security**: PDF uploads are validated and secured

## Future Enhancements

### Planned Features
1. **Email Notifications**: Automatic notifications for status changes
2. **Bulk Operations**: Batch processing for multiple requests
3. **Advanced Analytics**: Reporting and analytics dashboard
4. **Mobile App**: Native mobile application
5. **Integration**: API integration with external lab systems

### Technical Improvements
1. **Real-time Updates**: WebSocket integration for live updates
2. **Offline Support**: Progressive Web App capabilities
3. **Advanced Search**: Full-text search with filters
4. **Export Options**: PDF/Excel export functionality

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- React 18+
- TypeScript 5+
- Tailwind CSS
- shadcn/ui components

### Installation Steps
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Start development server: `npm run dev`

### Environment Variables
```env
VITE_API_BASE_URL=http://localhost:3000/dev
```

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow the established UI patterns
4. Add comprehensive tests
5. Update documentation

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.
