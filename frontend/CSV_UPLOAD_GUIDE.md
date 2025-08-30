# File Upload Guide

## Borelog File Upload
You can create a complete borelog with multiple stratum layers by uploading a single CSV or Excel file. This feature is available in the "Manage Borelogs" page.

## Supported File Formats
- **CSV files** (.csv) - Comma-separated values
- **Excel files** (.xlsx, .xls) - Microsoft Excel spreadsheets

## How to Use

### 1. Access the Upload Feature
- Navigate to "Manage Borelogs" page
- Click the "Upload CSV" button in the header
- Or click "Upload CSV" when no borelogs are found

### 2. Prepare Your File
- Download the template by clicking "CSV Template" or "Excel Template"
- Fill in your data following the template format
- Save as a CSV, XLSX, or XLS file

### 3. Upload Process
- Select a project from the dropdown
- Drag and drop your file or click "browse" to select it
- Click "Upload File" to process the file

## File Structure

**Important**: One file creates **one complete borelog** with multiple stratum layers.

### File Structure
- **Row 1**: Header row with column names
- **Row 2**: Borelog header information (project details, borehole info, etc.)
- **Row 3+**: Stratum layer data (each row represents one soil/rock layer)

## Template Format

### Row 1: Header Row
Contains column names for both borelog header and stratum data.

### Row 2: Borelog Header Information
Contains the main borelog metadata matching the actual borelog data sheet:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| project_id | Yes | UUID of the project | "550e8400-e29b-41d4-a716-446655440000" |
| structure_id | Yes | UUID of the structure | "550e8400-e29b-41d4-a716-446655440001" |
| substructure_id | Yes | UUID of the substructure | "550e8400-e29b-41d4-a716-446655440002" |
| borehole_id | Yes | UUID of the borehole | "550e8400-e29b-41d4-a716-446655440003" |
| project_name | No | Project name | "Project Name" |
| job_code | Yes | Job code | "JOB001" |
| chainage_km | No | Chainage in kilometers | 10.5 |
| borehole_no | No | Borehole number | "BH-01" |
| msl | No | Mean Sea Level | 45.2 |
| method_of_boring | Yes | Boring method | "Rotary Drilling" |
| diameter_of_hole | Yes | Hole diameter | "150 mm" |
| section_name | Yes | Section name | "CNE-AGTL" |
| location | Yes | Location description | "BR-365 (STEEL GIDER)" |
| coordinate_e | No | Easting coordinate | "103.6789" |
| coordinate_l | No | Northing coordinate | "1.2345" |
| commencement_date | Yes | Start date (DD.MM.YY) | "18.01.24" |
| completion_date | Yes | End date (DD.MM.YY) | "19.01.24" |
| standing_water_level | No | Water level in meters | 0.70 |
| termination_depth | No | Termination depth in meters | 40.45 |
| permeability_tests_count | No | Number of permeability tests | 0 |
| spt_tests_count | No | Number of SPT tests | 22 |
| vs_tests_count | No | Number of VS tests | 0 |
| undisturbed_samples_count | No | Number of undisturbed samples | 5 |
| disturbed_samples_count | No | Number of disturbed samples | 23 |
| water_samples_count | No | Number of water samples | 1 |
| version_number | No | Version number (default: 1) | 1 |
| status | No | Status (draft/submitted/approved/rejected) | "draft" |
| edited_by | No | UUID of user who edited | "550e8400-e29b-41d4-a716-446655440004" |
| editor_name | No | Name of editor | "John Doe" |
| remarks | No | Additional remarks | "Initial borelog entry" |

### Row 3+: Stratum Layer Data
Each subsequent row represents a soil or rock layer with detailed test data:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| stratum_description | Yes | Description of soil/rock stratum | "Grey colour silty clay with mixed grass roots & brownish colour patches observed" |
| stratum_depth_from | Yes | Depth from (m) | 0.00 |
| stratum_depth_to | Yes | Depth to (m) | 0.70 |
| stratum_thickness_m | No | Thickness (m) - auto-calculated | 0.70 |
| sample_event_type | No | Type of sample event | "D-1" |
| sample_event_depth_m | No | Sample event depth (m) | 0.35 |
| run_length_m | No | Run length (m) | 0.45 |
| spt_blows_1 | No | SPT blows for first 15cm | 3 |
| spt_blows_2 | No | SPT blows for second 15cm | 4 |
| spt_blows_3 | No | SPT blows for third 15cm | 5 |
| n_value_is_2131 | No | N-value (IS-2131) - sum of blows 2+3 | 9 |
| total_core_length_cm | No | Total core length (cm) | 35 |
| tcr_percent | No | TCR percentage | 78 |
| rqd_length_cm | No | RQD length (cm) |  |
| rqd_percent | No | RQD percentage |  |
| return_water_colour | No | Return water color | "BROWNISH" |
| water_loss | No | Water loss |  |
| borehole_diameter | No | Borehole diameter (mm) | 150 |
| remarks | No | Layer-specific remarks | "SAMPLE RECEIVED" |
| is_subdivision | No | Is subdivision (true/false/1/0) | false |
| parent_row_id | No | Parent stratum row index (0-based) |  |

## Important Notes

### One File = One Borelog
- Each CSV file creates exactly **one borelog**
- Multiple rows after the header represent different stratum layers within that borelog
- This allows you to create a complete borelog with all its soil/rock layers in one upload

### Required Fields
- All fields marked as "Yes" in the Required column must be filled
- Missing required fields will cause the upload to fail

### UUID Fields
- `project_id`, `structure_id`, `substructure_id`, `borehole_id` must be valid UUIDs
- These must reference existing records in the database
- Invalid UUIDs will cause foreign key constraint violations

### Date Format
- Use DD.MM.YY format for dates (as shown in the actual borelog sheet)
- Example: "18.01.24" for January 18, 2024

### Numeric Fields
- Numeric fields can be left empty for optional values
- If provided, they must be valid numbers
- Use decimal point (.) for decimal values

### Status Values
- Valid status values: "draft", "submitted", "approved", "rejected"
- Default is "draft" if not specified
- Case-insensitive

### SPT Test Data
- `spt_blows_1`, `spt_blows_2`, `spt_blows_3` represent blows for each 15cm interval
- `n_value_is_2131` is typically the sum of blows 2 + 3 (or total for 45cm)
- If N-value is not provided, it will be calculated automatically from the blows

### Sample Event Types
- **D**: Disturbed Sample
- **S/D**: Standard Penetration Test with disturbed sample collected
- **S**: Standard Penetration Test but sample not recovered
- **U**: Undisturbed Sample
- **U\***: UDS Could not been Collected (Slipped)
- **R/C**: Run with core sample collected
- **R**: Run but core sample not recovered

### Water Colors
- Common values: "BROWNISH", "GREYISH", "PARTIAL", "CLEAR"
- Can be left empty if not applicable

### Subdivisions
- Use `is_subdivision` to mark rows as subdivisions of other layers
- Set `parent_row_id` to the 0-based index of the parent stratum row
- Subdivisions inherit properties from their parent layers

### File Size
- Maximum file size: 10MB
- Supported formats: CSV, XLSX, XLS

## Upload Results

After uploading, you'll see:
- **Borelog Created**: Always 1 (one file = one borelog)
- **Stratum Layers**: Number of successfully created stratum layers
- **Total Stratum Rows**: Total number of stratum rows in your CSV
- **Failed Rows**: Number of stratum rows that failed to process

### Error Details
If there are errors, you'll see:
- Row number where the error occurred
- Specific error message for each failed row
- Detailed validation errors for stratum data

## Example CSV Content

```csv
project_id,structure_id,substructure_id,borehole_id,project_name,job_code,chainage_km,borehole_no,msl,method_of_boring,diameter_of_hole,section_name,location,coordinate_e,coordinate_l,commencement_date,completion_date,standing_water_level,termination_depth,permeability_tests_count,spt_tests_count,vs_tests_count,undisturbed_samples_count,disturbed_samples_count,water_samples_count,version_number,status,edited_by,editor_name,remarks
"550e8400-e29b-41d4-a716-446655440000","550e8400-e29b-41d4-a716-446655440001","550e8400-e29b-41d4-a716-446655440002","550e8400-e29b-41d4-a716-446655440003","Project Name","JOB001",10.5,"BH-01",45.2,"Rotary Drilling","150 mm","CNE-AGTL","BR-365 (STEEL GIDER)","103.6789","1.2345","18.01.24","19.01.24",0.70,40.45,0,22,0,5,23,1,1,"draft","550e8400-e29b-41d4-a716-446655440004","John Doe","Initial borelog entry"
stratum_description,stratum_depth_from,stratum_depth_to,stratum_thickness_m,sample_event_type,sample_event_depth_m,run_length_m,spt_blows_1,spt_blows_2,spt_blows_3,n_value_is_2131,total_core_length_cm,tcr_percent,rqd_length_cm,rqd_percent,return_water_colour,water_loss,borehole_diameter,remarks,is_subdivision,parent_row_id
"Grey colour silty clay with mixed grass roots & brownish colour patches observed",0.00,0.70,0.70,"D-1",0.35,0.45,3,4,5,9,,,,"BROWNISH",,,"SAMPLE RECEIVED",false,
"Dark grey colour, fine grained, clayey silty sand",0.70,1.20,0.50,"S/D-1",0.95,0.45,8,30,41,71,,,,"GREYISH",,,"SAMPLE RECEIVED",false,
"Soft, dark grey colour, clayey silt with traces of very fine sand & mica",1.20,7.00,5.80,"S/D-2",4.10,0.45,38,37,39,76,,,,"GREYISH",,,"SAMPLE RECEIVED",false,
"Medium stiff to stiff, deep grey colour silty clay/clayey silt",7.00,14.50,7.50,"U-1",10.75,0.45,43,54,64,118,,,,"PARTIAL",,,"SAMPLE RECEIVED",false,
"Dense, blackish grey colour, fine grained silty sand with little % of clay mixed occasionally clayey silt layer observed",14.50,24.00,9.50,"S/D-3",19.25,0.45,55,49,52,101,,,,"PARTIAL",,,"SAMPLE RECEIVED",false,
"Hard deep grey colour, silt with little % of clay binder, occasionally dark grey colour fine grained silty sand layer observed",24.00,40.45,16.45,"R/C-1",32.23,0.45,56,61,64,120,35,78,,"PARTIAL",,150,"SAMPLE RECEIVED",false,
```

## Troubleshooting

### Common Errors

1. **Foreign Key Constraint Violation**
   - Ensure all UUID fields reference existing records
   - Check that project_id, structure_id, substructure_id, and borehole_id are valid

2. **Invalid Date Format**
   - Use DD.MM.YY format (e.g., "18.01.24")
   - Ensure dates are valid calendar dates

3. **Missing Required Fields**
   - Fill in all required fields marked with "Yes"
   - Check for extra spaces or empty cells

4. **Invalid Numeric Values**
   - Ensure numeric fields contain valid numbers
   - Use decimal point (.) not comma (,) for decimals

5. **Stratum Row Errors**
   - Check that stratum rows have required fields
   - Ensure depth values are logical (from < to)
   - Verify subdivision references are valid

6. **SPT Test Data Issues**
   - Ensure SPT blows are valid numbers
   - Check that N-value calculation is correct
   - Verify sample event types are valid

7. **Excel File Issues**
   - Ensure the first worksheet contains your data
   - Check that headers are in the first row
   - Verify date formats are consistent (DD.MM.YY)
   - Make sure no merged cells are used in the data area
   - Ensure all data is in the same worksheet

### Getting Help

If you encounter issues:
1. Check the error messages in the upload results
2. Verify your CSV format matches the template
3. Ensure all UUIDs reference existing records
4. Contact your system administrator for assistance