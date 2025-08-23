# Rock Lab Test Report - Exact Fields Specification

## Overview
Based on the "Laboratory Rock Tests Result Sheet" image, this document specifies the exact fields required for the rock lab test report UI form. The form should match the professional layout and data structure shown in the image.

## Form Structure

### 1. Header Section
**Company Information:**
- **Logo**: APC (top left corner)
- **Consultant**: HEC Pte. Ltd.
- **Lab**: BPC Civil & Geotech
- **Website**: www.bpclabs.com

**Document Information:**
- **Project Name**: Text input
- **Client**: Text input
- **Borehole No.**: Text input (e.g., "Rock_BH.4")
- **Date**: Date picker
- **Tested By**: Text input
- **Checked By**: Text input
- **Approved By**: Text input

### 2. Sample Summary Section (Left Side)
**Fields for each sample:**
- **Sample No.**: Text input
- **Depth (m)**: Number input (0.01 precision)
- **Rock Type**: Text input
- **Description**: Text input
- **Length (mm)**: Number input (0.01 precision)
- **Diameter (mm)**: Number input (0.01 precision)
- **Weight (g)**: Number input (0.01 precision)
- **Density (g/cm³)**: Number input (0.001 precision)
- **Moisture Content (%)**: Number input (0.01 precision)
- **Water Absorption (%)**: Number input (0.01 precision)
- **Porosity (%)**: Number input (0.01 precision)
- **Uniaxial Compressive Strength (MPa)**: Number input (0.1 precision)
- **Point Load Index (Is50) (MPa)**: Number input (0.01 precision)
- **Brazilian Tensile Strength (MPa)**: Number input (0.01 precision)

### 3. Detailed Test Data Tables (Right Side)

#### 3.1 Caliper Method Table
**Columns:**
- Sample No.
- Depth (m)
- Length (mm)
- Diameter (mm)
- Weight (g)
- Density (g/cm³)
- Moisture Content (%)
- Water Absorption (%)
- Porosity (%)

**Sample Data Pattern:**
- Depth increments: 0.50, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00, 4.50, 5.00 m
- Length: ~70.00 mm
- Diameter: ~38.00 mm
- Weight: ~179.71 g
- Density: ~2.70 g/cm³

#### 3.2 Buoyancy Techniques Table
**Columns:**
- Sample No.
- Depth (m)
- Weight in Air (g)
- Weight in Water (g)
- Weight Saturated (g)
- Density (g/cm³)
- Moisture Content (%)
- Water Absorption (%)
- Porosity (%)

**Sample Data Pattern:**
- Weight in Air: ~179.71 g
- Weight in Water: ~117.97 g
- Weight Saturated: ~181.24 g
- Density: ~2.70 g/cm³

#### 3.3 Water Displacement Table
**Columns:**
- Sample No.
- Depth (m)
- Volume of Water Displaced (cm³)
- Density (g/cm³)
- Moisture Content (%)
- Water Absorption (%)
- Porosity (%)

**Sample Data Pattern:**
- Volume Water Displaced: ~66.57 cm³
- Density: ~2.70 g/cm³

#### 3.4 Point Load Table
**Columns:**
- Sample No.
- Depth (m)
- Length (mm)
- Diameter (mm)
- Failure Load (kN)
- Point Load Index (Is50) (MPa)
- Test Count (Rock or Interval)
- Result

**Sample Data Pattern:**
- Length: ~112.31 mm
- Diameter: ~54.71 mm
- Failure Load: ~0.63 kN
- Point Load Index: ~2.00 MPa

#### 3.5 UCS (Uniaxial Compressive Strength) Table
**Columns:**
- Sample No.
- Depth (m)
- Length (mm)
- Diameter (mm)
- Failure Load (kN)
- Uniaxial Compressive Strength (MPa)
- Test Count (Rock or Interval)
- Result

**Sample Data Pattern:**
- Length: ~112.31 mm
- Diameter: ~54.71 mm
- Failure Load: ~250.00 kN
- UCS: ~100.00 MPa

#### 3.6 Brazilian Table
**Columns:**
- Sample No.
- Depth (m)
- Length (mm)
- Diameter (mm)
- Failure Load (kN)
- Brazilian Tensile Strength (MPa)
- Test Count (Rock or Interval)
- Result

**Sample Data Pattern:**
- Length: ~112.31 mm
- Diameter: ~54.71 mm
- Failure Load: ~25.00 kN
- Brazilian Tensile Strength: ~2.00 MPa

## Key Features Required

### 1. Data Entry Features
- **Add/Remove Rows**: Ability to add new sample rows and remove existing ones
- **Bulk Operations**: Copy/paste functionality for multiple rows
- **Auto-calculation**: Automatic calculation of derived values
- **Data Validation**: Range checking and format validation
- **Default Values**: Pre-filled with typical values for efficiency

### 2. Visual Indicators
- **Red Text**: Highlight calculated/final result values in red
- **Color Coding**: Different background colors for different test methods
- **Status Indicators**: Pass/Fail/Pending status for each test
- **Watermark**: "Page 1" watermark overlay (optional)

### 3. Data Management
- **Save Draft**: Save work in progress
- **Export Options**: PDF, Excel export functionality
- **Version Control**: Track changes and revisions
- **Audit Trail**: Record who made changes and when

### 4. User Interface
- **Tabbed Layout**: Organize different test methods in tabs
- **Responsive Design**: Work on desktop and mobile devices
- **Print-friendly**: Optimized layout for printing
- **Search/Filter**: Find specific samples or data ranges

## Technical Implementation

### Data Structure
```typescript
interface RockTestSample {
  sample_no: string;
  depth_m: number;
  rock_type: string;
  description: string;
  
  // Caliper Method
  length_mm: number;
  diameter_mm: number;
  weight_g: number;
  density_g_cm3: number;
  moisture_content_percent: number;
  water_absorption_percent: number;
  porosity_percent: number;
  
  // Buoyancy Techniques
  weight_in_air_g: number;
  weight_in_water_g: number;
  weight_saturated_g: number;
  
  // Water Displacement
  volume_water_displaced_cm3: number;
  
  // Strength Tests
  failure_load_kn: number;
  point_load_index_mpa: number;
  uniaxial_compressive_strength_mpa: number;
  brazilian_tensile_strength_mpa: number;
  test_count: number;
  result: 'Pass' | 'Fail' | 'Pending';
}

interface RockLabReport {
  // Header Information
  project_name: string;
  client: string;
  borehole_no: string;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  
  // Test Data
  samples: RockTestSample[];
  
  // Report Status
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  reviewed_by?: string;
  review_comments?: string;
  approval_date?: Date;
}
```

### Form Validation Rules
- **Required Fields**: Sample No., Depth, Rock Type
- **Numeric Ranges**: 
  - Depth: 0-1000 m
  - Length: 0-500 mm
  - Diameter: 0-200 mm
  - Weight: 0-10000 g
  - Density: 0-10 g/cm³
  - All percentages: 0-100%
- **Precision Requirements**: As specified in field descriptions above

### Auto-calculation Formulas
- **Density (Caliper)**: Weight / (π × (Diameter/2)² × Length)
- **Density (Buoyancy)**: Weight in Air / (Weight in Air - Weight in Water)
- **Water Absorption**: ((Weight Saturated - Weight in Air) / Weight in Air) × 100
- **Porosity**: (1 - (Density / Specific Gravity)) × 100
- **Point Load Index**: (Failure Load × 1000) / (Length × Diameter)
- **UCS**: (Failure Load × 1000) / (π × (Diameter/2)²)
- **Brazilian Tensile Strength**: (2 × Failure Load × 1000) / (π × Diameter × Length)

## Implementation Notes

### 1. UI Components
- Use table components for data entry
- Implement inline editing for efficiency
- Add tooltips for field descriptions
- Include help text for complex calculations

### 2. Data Persistence
- Store as JSON in database
- Support CSV import/export
- Enable backup and restore functionality
- Implement data versioning

### 3. Performance Considerations
- Lazy load large datasets
- Implement virtual scrolling for many samples
- Cache calculated values
- Optimize for mobile devices

### 4. Accessibility
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Responsive design for all screen sizes

## Sample Data for Testing
The form should be pre-populated with sample data matching the image:
- 10 sample rows (0.50m to 5.00m depth)
- Realistic rock test values
- Proper formatting and precision
- Red highlighting for calculated results

This specification ensures the rock lab test report form matches the professional standards and data structure shown in the reference image.

