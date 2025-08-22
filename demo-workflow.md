# Complete Role-Based Workflow Demo Guide

## Overview
This demo showcases the complete role-based workflow for the borelog system, demonstrating different user permissions and views as requested.

## Prerequisites
1. Database migration has been run (`npm run migrate` in backend directory)
2. Backend server is running (`npm run dev` in backend directory)
3. Frontend server is running (`npm run dev` in frontend directory)
4. Test users are created with different roles

## Step 1: Create Test Users (Admin Role)

### Login as Admin
- Navigate to `/auth/login`
- Login with admin credentials
- Verify you can see all projects and users

### Create Test Users
1. **Navigate to User Management**
   - Click on "Users" in the navbar (Admin only)
   - Or navigate to `/users`

2. **Create Project Manager**
   - Click "Create User"
   - Name: "John ProjectManager"
   - Email: "pm@test.com"
   - Role: "Project Manager"
   - Password: "password123"

3. **Create Site Engineer**
   - Click "Create User"
   - Name: "Sarah SiteEngineer"
   - Email: "se@test.com"
   - Role: "Site Engineer"
   - Password: "password123"

4. **Create Approval Engineer**
   - Click "Create User"
   - Name: "Mike ApprovalEngineer"
   - Email: "ae@test.com"
   - Role: "Approval Engineer"
   - Password: "password123"

5. **Create Lab Engineer**
   - Click "Create User"
   - Name: "Lisa LabEngineer"
   - Email: "le@test.com"
   - Role: "Lab Engineer"
   - Password: "password123"

### Create Test Project
- Navigate to `/projects/create`
- Project Name: "Highway Bridge Project"
- Description: "Test project for workflow demo"
- Client: "Test Client"
- Location: "Test Location"

### Assign Users to Project
- Navigate to `/assignments/create` (or use the "Project Assignments" link in the Admin dropdown menu)
- Select "Highway Bridge Project"
- Choose Assignment Type: "AdminToManager"
- Assign Project Manager: "John ProjectManager"
- Choose Assignment Type: "ManagerToTeam" 
- Assign Site Engineer: "Sarah SiteEngineer"
- Assign Approval Engineer: "Mike ApprovalEngineer"

## Step 2: Project Manager Workflow

### Login as Project Manager
- Login with: pm@test.com / password123
- Verify you can see the assigned project

### Create Structures and Borelogs
1. **Create Structure**
   - Navigate to `/structures/create`
   - Structure Name: "Bridge Foundation"
   - Project: "Highway Bridge Project"

2. **Create Substructure**
   - Navigate to `/substructures/create`
   - Substructure Name: "Pier 1"
   - Structure: "Bridge Foundation"

3. **Create Borelog**
   - Navigate to `/borelog/create`
   - Project: "Highway Bridge Project"
   - Substructure: "Pier 1"
   - Borehole Number: "BH-001"
   - Type: "Geological"

### Use CSV Upload (Bulk Update)
1. **Prepare CSV File**
   Use the provided `sample-borelogs.csv` file which contains the correct format:
   ```
   project_name,client_name,design_consultant,job_code,project_location,chainage_km,area,borehole_location,borehole_number,msl,method_of_boring,diameter_of_hole,commencement_date,completion_date,standing_water_level,termination_depth,coordinate_lat,coordinate_lng,type_of_core_barrel,bearing_of_hole,collar_elevation,logged_by,checked_by
   "Highway Bridge Project","Test Client","Test Consultant","JOB001","Test Location",10.5,"Bridge Foundation","Pier 1 Location","BH-002","45.2m","Rotary Drilling",150,"2024-01-15","2024-01-16",12.5,30.5,40.7128,-74.0060,"Core Barrel Type A","N45E",45.2,"John Doe","Jane Smith"
   ```

2. **Upload CSV**
   - Navigate to `/borelog/manage`
   - Click "Upload CSV"
   - Select the prepared CSV file
   - Verify borelogs are created

## Step 3: Site Engineer Workflow

### Login as Site Engineer
- Login with: se@test.com / password123
- Verify you can only see assigned projects

### Add Borelog Details
1. **Navigate to Borelog**
   - Go to `/borelog/BH-001` (replace with actual borelog ID)
   - Verify you can edit the form

2. **Add Stratum Data**
   - Click "Add Stratum"
   - Fill in sample data:
     - Depth: 0-2m
     - Description: "Topsoil"
     - Color: "Brown"
     - Consistency: "Soft"
     - Sample ID: "SAMPLE-001"

3. **Add More Strata**
   - Add another stratum:
     - Depth: 2-5m
     - Description: "Clay"
     - Color: "Gray"
     - Consistency: "Stiff"
     - Sample ID: "SAMPLE-002"

### Submit for Review
1. **Save Draft**
   - Click "Save Draft" to save progress
   - Verify data is saved

2. **Submit for Review**
   - Click "Submit for Review"
   - Add comments: "Initial geological assessment completed"
   - Submit
   - Verify status changes to "submitted"

## Step 4: Approval Engineer Review

### Login as Approval Engineer
- Login with: ae@test.com / password123
- Navigate to `/workflow/dashboard`

### Review Pending Borelogs
1. **View Pending Reviews**
   - Verify you can see the submitted borelog
   - Click "Review" button

2. **Review Options**
   - **Approve**: Add comments "Good work, approved"
   - **Reject**: Add comments "Incomplete data, please revise"
   - **Return for Revision**: Add comments "Please add more details about soil composition"

3. **Test Different Actions**
   - Try "Return for Revision" first
   - Verify status changes to "returned_for_revision"

## Step 5: Site Engineer Revision

### Login as Site Engineer
- Login with: se@test.com / password123
- Navigate to `/workflow/dashboard`

### View Returned Borelog
1. **Check Status**
   - Verify borelog shows "returned_for_revision"
   - View review comments

2. **Make Revisions**
   - Edit the borelog
   - Add more detailed soil descriptions
   - Add additional sample points

3. **Resubmit**
   - Submit for review again
   - Add comments: "Revisions completed as requested"

## Step 6: Final Approval

### Login as Approval Engineer
- Login with: ae@test.com / password123
- Review the revised borelog
- **Approve** with comments: "Excellent work, approved for lab testing"

## Step 7: Project Manager Lab Assignment

### Login as Project Manager
- Login with: pm@test.com / password123
- Navigate to the approved borelog

### Assign Lab Tests
1. **Access Lab Assignment**
   - Verify "Assign Lab Tests" button is available
   - Click to open assignment dialog

2. **Configure Lab Tests**
   - Select Lab Engineer: "Lisa LabEngineer"
   - Priority: "High"
   - Expected Completion: "2024-02-15"
   - Sample IDs: ["SAMPLE-001", "SAMPLE-002"]
   - Test Types: ["Compression Test", "Shear Test"]

3. **Submit Assignment**
   - Add remarks: "Critical samples for foundation design"
   - Assign tests
   - Verify assignment is created

## Step 8: Lab Engineer Workflow

### Login as Lab Engineer
- Login with: le@test.com / password123
- Navigate to `/workflow/dashboard`

### View Lab Assignments
1. **Check Assignments**
   - Verify you can see assigned lab tests
   - Check priority and completion dates

2. **Update Progress**
   - Click "Update Progress" for each assignment
   - Change status to "in_progress"
   - Add progress notes

3. **Submit Results**
   - Complete tests
   - Submit test results with detailed data
   - Change status to "completed"

## Step 9: Final Review and Approval

### Login as Project Manager
- Login with: pm@test.com / password123
- Navigate to `/workflow/dashboard`

### Review Lab Results
1. **Check Statistics**
   - View workflow statistics
   - Verify counts are accurate

2. **Review Lab Results**
   - Access completed lab tests
   - Review test data and results
   - Approve final results

## Step 10: Admin Overview

### Login as Admin
- Login with admin credentials
- Navigate to `/workflow/dashboard`

### Verify Complete Workflow
1. **Check All Views**
   - Pending Reviews (should be empty or minimal)
   - Lab Assignments (should show completed)
   - Workflow Statistics (should show full counts)
   - Submitted Borelogs (should show complete history)

2. **Verify Permissions**
   - Confirm each role can only see appropriate data
   - Test access restrictions
   - Verify project-based filtering works

## Testing Scenarios

### Scenario 1: Rejection Flow
1. Site Engineer submits borelog
2. Approval Engineer rejects with comments
3. Site Engineer views rejection and makes corrections
4. Site Engineer resubmits
5. Approval Engineer approves

### Scenario 2: Multiple Lab Tests
1. Project Manager assigns multiple test types
2. Lab Engineer processes tests sequentially
3. Verify each test can be updated independently

### Scenario 3: CSV Bulk Operations
1. Project Manager uploads CSV with multiple borelogs
2. Verify all borelogs are created correctly
3. Test bulk status updates

### Scenario 4: Permission Testing
1. Try accessing projects you're not assigned to
2. Verify proper error messages
3. Test role-based button visibility

## Expected Outcomes

### For Each Role:
- **Admin**: Full access to all data and functions
- **Project Manager**: Can manage projects, assign lab tests, view statistics
- **Site Engineer**: Can create/edit borelogs, submit for review, view own submissions
- **Approval Engineer**: Can review and approve/reject/return borelogs
- **Lab Engineer**: Can view and update lab test assignments

### Workflow States:
- Draft → Submitted → Approved/Rejected/Returned → Lab Assigned → Lab Completed → Final Review

### Data Integrity:
- All actions are logged with timestamps
- Version history is maintained
- Comments are preserved throughout the workflow
- Project-based access control is enforced

## Troubleshooting

### Common Issues:
1. **Migration Errors**: Ensure database migration has been run
2. **Permission Errors**: Check user role assignments
3. **API Errors**: Verify backend server is running
4. **UI Issues**: Check browser console for errors

### Debug Steps:
1. Check browser network tab for API calls
2. Verify database tables exist and have correct structure
3. Test API endpoints directly with tools like Postman
4. Check server logs for backend errors

## Success Criteria

The demo is successful when:
✅ All roles can perform their designated functions
✅ Workflow states transition correctly
✅ Data is properly filtered by project access
✅ Lab test assignments work end-to-end
✅ CSV upload functionality works
✅ All UI components display correctly
✅ Error handling works appropriately
✅ Audit trail is maintained throughout

This completes the full role-based workflow demonstration as requested.
