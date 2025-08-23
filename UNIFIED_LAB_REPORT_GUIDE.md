# Unified Lab Report System - Implementation Guide

## Overview

The Unified Lab Report System provides a comprehensive solution for lab engineers to create combined soil and rock test reports for borelogs. This system allows engineers to fill both types of tests in a single interface with tabbed navigation, ensuring all test data for a borelog is consolidated into one report.

## Key Features

### 1. Unified Interface
- **Single Form**: Combines both soil and rock test forms in one interface
- **Tabbed Navigation**: Easy switching between General Info, Soil Tests, and Rock Tests
- **Progress Tracking**: Visual indicators showing completion status of each test type
- **Combined Submission**: Submit both soil and rock data together

### 2. Excel Export with Multiple Sheets
- **Summary Sheet**: Overview of project information and test summary
- **Soil Tests Sheet**: All soil test data in organized format
- **Rock Tests Sheet**: All rock test data in organized format
- **Additional Rock Sheets**: Separate sheets for Caliper Method, Buoyancy Techniques, Point Load Test, and Brazilian Tensile Strength

### 3. Role-Based Access
- **Lab Engineers**: Can create, edit, and submit unified reports
- **Project Managers**: Can view and manage lab requests
- **Approval Engineers**: Can review and approve submitted reports
- **Customers**: Can view approved reports

## Implementation Details

### File Structure

```
frontend/src/
├── components/
│   ├── UnifiedLabReportForm.tsx     # Main unified form component
│   ├── SoilLabReportForm.tsx        # Existing soil test form
│   └── RockLabReportForm.tsx        # Existing rock test form
├── pages/lab-reports/
│   ├── index.tsx                    # Lab reports management page
│   └── unified.tsx                  # Unified report page
└── lib/
    └── labReportExporter.ts         # Excel export functionality
```

### Component Architecture

#### UnifiedLabReportForm.tsx
- **Props**: Accepts lab request, existing report, and callback functions
- **State Management**: Tracks completion status of both soil and rock tests
- **Form Integration**: Embeds existing soil and rock forms as tabs
- **Data Consolidation**: Combines data from both forms for submission

#### Key Functions:
```typescript
// Handle soil form submission
const handleSoilFormSubmit = (soilData: any) => {
  setFormData(prev => ({
    ...prev,
    soil_test_data: soilData.soil_test_data || [],
    soil_test_completed: true
  }));
};

// Handle rock form submission
const handleRockFormSubmit = (rockData: any) => {
  setFormData(prev => ({
    ...prev,
    rock_test_data: rockData.rock_test_data || [],
    rock_test_completed: true
  }));
};

// Submit combined report
const handleSubmit = async () => {
  const unifiedReportData: UnifiedLabReportData = {
    // ... combined data structure
  };
  onSubmit(unifiedReportData);
};
```

### Excel Export Functionality

#### labReportExporter.ts
The export function creates a comprehensive Excel workbook with multiple sheets:

1. **Summary Sheet**: Project information, personnel, and test summary
2. **Soil Tests Sheet**: Complete soil test data with all parameters
3. **Rock Tests Sheet**: Complete rock test data with all parameters
4. **Caliper Method Sheet**: Rock density measurements using caliper method
5. **Buoyancy Techniques Sheet**: Rock density measurements using buoyancy
6. **Point Load Test Sheet**: Point load index and UCS calculations
7. **Brazilian Tensile Strength Sheet**: Brazilian tensile strength data

#### Export Function:
```typescript
export const exportUnifiedLabReportToExcel = (reportData: UnifiedLabReportData) => {
  const workbook = XLSX.utils.book_new();
  
  // Create Summary Sheet
  const summaryData = [
    ['LABORATORY TEST REPORT SUMMARY'],
    ['Project Name:', reportData.project_name],
    ['Borehole Number:', reportData.borehole_no],
    // ... more summary data
  ];
  
  // Create Soil Tests Sheet
  if (reportData.combined_data.soil.length > 0) {
    const soilData = [
      soilHeaders,
      ...reportData.combined_data.soil.map(soil => [
        soil.sample_no,
        soil.sample_depth,
        // ... all soil parameters
      ])
    ];
    const soilSheet = XLSX.utils.aoa_to_sheet(soilData);
    XLSX.utils.book_append_sheet(workbook, soilSheet, 'Soil Tests');
  }
  
  // Similar process for rock tests and additional sheets
  
  const filename = `LabReport_${reportData.borehole_no}_${reportData.date.toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
  return filename;
};
```

## User Workflow

### 1. Accessing the Unified Form
- Navigate to `/lab-reports` (Lab Reports Management)
- Click "Fill Sample Report" button for any pending request
- This opens the unified form at `/lab-reports/unified/{requestId}`

### 2. Filling the Form
1. **General Info Tab**: Review project information (auto-filled)
2. **Soil Tests Tab**: Fill soil test data using existing soil form
3. **Rock Tests Tab**: Fill rock test data using existing rock form
4. **Progress Tracking**: Monitor completion status of both test types

### 3. Saving and Submitting
- **Save Draft**: Save progress without submitting
- **Export to Excel**: Generate Excel report with all data
- **Submit Combined Report**: Submit both soil and rock data together

### 4. Excel Report Structure
The exported Excel file contains:
- **Summary Sheet**: Overview and project details
- **Soil Tests Sheet**: Complete soil test data
- **Rock Tests Sheet**: Complete rock test data
- **Additional Rock Sheets**: Specialized rock test data

## Integration Points

### 1. Existing Forms
The unified form reuses existing soil and rock test forms:
- **SoilLabReportForm.tsx**: Embedded in Soil Tests tab
- **RockLabReportForm.tsx**: Embedded in Rock Tests tab
- **Data Flow**: Data from embedded forms flows to unified form state

### 2. Navigation Integration
- **Lab Reports Index**: Updated to include unified form option
- **Quick Access**: Added "Create Unified Report" button
- **Request Actions**: "Fill Sample Report" now opens unified form

### 3. Routing
```typescript
// Added route in App.tsx
<Route path="/lab-reports/unified/:requestId?" element={
  <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
    <UnifiedLabReportPage />
  </ProtectedRoute>
} />
```

## Data Structure

### UnifiedLabReportData Interface
```typescript
interface UnifiedLabReportData {
  lab_report_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  test_types: string[];  // ['Soil', 'Rock']
  combined_data: {
    soil: any[];         // Soil test data array
    rock: any[];         // Rock test data array
  };
}
```

### Form State Management
```typescript
interface UnifiedFormData {
  // General Info
  lab_report_id?: string;
  lab_request_id: string;
  project_name: string;
  borehole_no: string;
  // ... other general fields
  
  // Test Completion Tracking
  soil_test_data: any[];
  soil_test_completed: boolean;
  rock_test_data: any[];
  rock_test_completed: boolean;
}
```

## Benefits

### 1. User Experience
- **Single Interface**: No need to switch between separate forms
- **Progress Tracking**: Clear indication of completion status
- **Data Consistency**: Ensures all tests for a borelog are in one report

### 2. Data Management
- **Consolidated Reports**: Single report contains all test data
- **Excel Export**: Comprehensive Excel file with multiple sheets
- **Data Integrity**: Prevents missing or incomplete test data

### 3. Workflow Efficiency
- **Streamlined Process**: Lab engineers can complete all tests in one session
- **Reduced Errors**: Less chance of submitting incomplete reports
- **Better Organization**: All related test data is grouped together

## Future Enhancements

### 1. PDF Export
- Generate professional PDF reports
- Include charts and graphs
- Add digital signatures

### 2. Advanced Validation
- Cross-reference soil and rock data
- Validate test parameters against standards
- Flag potential data inconsistencies

### 3. Integration with Backend
- Save unified reports to database
- API endpoints for unified report management
- Real-time collaboration features

### 4. Reporting Dashboard
- Analytics on test completion rates
- Quality metrics and trends
- Automated report generation

## Usage Instructions

### For Lab Engineers:
1. Navigate to Lab Reports Management
2. Click "Fill Sample Report" for a pending request
3. Complete both soil and rock tests in the unified form
4. Export to Excel for review
5. Submit the combined report

### For Project Managers:
1. Create lab test requests
2. Monitor completion status
3. Review submitted reports
4. Download Excel reports for analysis

### For Approval Engineers:
1. Review submitted unified reports
2. Approve or reject with comments
3. Access Excel exports for detailed analysis

This unified system provides a comprehensive solution for managing laboratory test reports, ensuring data completeness and improving workflow efficiency for all stakeholders involved in the borelog testing process.
