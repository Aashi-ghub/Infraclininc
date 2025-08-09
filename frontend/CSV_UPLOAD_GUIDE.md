# CSV Upload Guide for Geological Logs

## Overview
You can create multiple geological logs (borelogs) at once by uploading a CSV file. This feature is available in the "Manage Geological Logs" page.

## How to Use

### 1. Access the Upload Feature
- Navigate to "Manage Geological Logs" page
- Click the "Upload CSV" button in the header
- Or click "Upload CSV" when no geological logs are found

### 2. Prepare Your CSV File
- Download the template by clicking "Download Template"
- Fill in your data following the template format
- Save as a CSV file

### 3. Upload Process
- Select a project from the dropdown
- Drag and drop your CSV file or click "browse" to select it
- Click "Upload CSV" to process the file

## CSV Template Format

Your CSV file should have the following columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| project_name | Yes | Name of the project | "Project A" |
| client_name | Yes | Name of the client | "Client A" |
| design_consultant | Yes | Design consultant name | "Consultant A" |
| job_code | Yes | Job code | "JOB001" |
| project_location | Yes | Project location | "Location A" |
| chainage_km | No | Chainage in kilometers | 10.5 |
| area | Yes | Area description | "Area A" |
| borehole_location | Yes | Borehole location | "Borehole Location A" |
| borehole_number | Yes | Borehole number | "BH001" |
| msl | No | Mean Sea Level | "45.2m" |
| method_of_boring | Yes | Boring method | "Rotary Drilling" |
| diameter_of_hole | Yes | Hole diameter in mm | 150 |
| commencement_date | Yes | Start date (YYYY-MM-DD) | "2024-01-15" |
| completion_date | Yes | End date (YYYY-MM-DD) | "2024-01-16" |
| standing_water_level | No | Water level in meters | 12.5 |
| termination_depth | Yes | Termination depth in meters | 30.5 |
| coordinate_lat | No | Latitude coordinate | 1.2345 |
| coordinate_lng | No | Longitude coordinate | 103.6789 |
| type_of_core_barrel | No | Core barrel type | "Core Barrel Type A" |
| bearing_of_hole | No | Hole bearing | "N45E" |
| collar_elevation | No | Collar elevation | 45.2 |
| logged_by | Yes | Person who logged the data | "John Doe" |
| checked_by | Yes | Person who checked the data | "Jane Smith" |
| substructure_id | No | UUID of the substructure to assign | "550e8400-e29b-41d4-a716-446655440000" |

## Important Notes

### Required Fields
- All fields marked as "Yes" in the Required column must be filled
- Missing required fields will cause the row to fail

### Date Format
- Use YYYY-MM-DD format for dates
- Example: "2024-01-15"

### Coordinates
- Latitude and longitude should be in decimal degrees
- If you provide coordinates, both latitude and longitude are required
- Coordinates are optional

### Substructure Assignment
- The substructure_id field is optional
- If provided, it must be a valid UUID of an existing substructure
- Invalid substructure IDs will be logged as errors but won't prevent the borelog creation

### File Size
- Maximum file size: 10MB
- Supported format: CSV only

## Upload Results

After uploading, you'll see:
- **Created**: Number of successfully created geological logs
- **Errors**: Number of rows that failed to process
- **Total Rows**: Total number of rows in your CSV file

### Error Details
If there are errors, you'll see:
- Row number where the error occurred
- Borehole number (if available)
- Specific error message

## Example CSV Content

```csv
project_name,client_name,design_consultant,job_code,project_location,chainage_km,area,borehole_location,borehole_number,msl,method_of_boring,diameter_of_hole,commencement_date,completion_date,standing_water_level,termination_depth,coordinate_lat,coordinate_lng,type_of_core_barrel,bearing_of_hole,collar_elevation,logged_by,checked_by,substructure_id
"Project A","Client A","Consultant A","JOB001","Location A",10.5,"Area A","Borehole Location A","BH001","45.2m","Rotary Drilling",150,"2024-01-15","2024-01-16",12.5,30.5,1.2345,103.6789,"Core Barrel Type A","N45E",45.2,"John Doe","Jane Smith","550e8400-e29b-41d4-a716-446655440000"
"Project A","Client A","Consultant A","JOB001","Location A",10.6,"Area A","Borehole Location B","BH002","45.3m","Rotary Drilling",150,"2024-01-17","2024-01-18",12.8,32.0,1.2346,103.6790,"Core Barrel Type A","N45E",45.3,"John Doe","Jane Smith","550e8400-e29b-41d4-a716-446655440001"
```

## Troubleshooting

### Common Issues
1. **Missing required fields**: Ensure all required fields are filled
2. **Invalid date format**: Use YYYY-MM-DD format
3. **File too large**: Reduce file size or split into smaller files
4. **Invalid coordinates**: Ensure coordinates are in decimal degrees format
5. **Invalid substructure ID**: Verify the substructure exists and the ID is correct

### Getting Help
If you encounter issues:
1. Check the error details in the upload results
2. Verify your CSV format matches the template
3. Ensure all required fields are filled
4. Check that dates are in the correct format
5. Verify substructure IDs if using them