# Soil and Rock Lab Test Report - Exact Fields Specification

## Overview
This document specifies the exact fields required for both soil and rock lab test report UI forms based on the "Laboratory Soil Tests Result Summary Sheet" and "Laboratory Rock Tests Result Sheet" images. The forms should match the professional layout and data structure shown in the images.

## Soil Lab Test Report Fields

### 1. Header Section
**Company Information:**
- **Logo**: BPC Consultant INDIA Pvt. Ltd.
- **Website**: www.bpcipl.com

**Document Information:**
- **Project Name**: Text input (long text area for full project description)
- **Client Name**: Text input
- **LOA Number**: Text input (e.g., "IMPHAL-ENGINEERING / DYCE-C-JRBM-3-4-GT-24-25 / 01148680124062 Dated:- 22.02.2025")
- **Job Code**: Text input (e.g., "P0269")
- **Coordinates E**: Number input (e.g., 529303.065)
- **Coordinates N**: Number input (e.g., 2469991.452)
- **Section Name**: Text input (e.g., "KGP - TATA")
- **Location**: Text input (e.g., "NEW MNBR")
- **Chainage (km)**: Number input (e.g., 2325)
- **Borehole No.**: Text input (e.g., "BH-1")
- **Standing Water Level**: Number input in meters BGL (e.g., 1.20)

**Report Details:**
- **Date**: Date picker
- **Tested By**: Text input
- **Checked By**: Text input
- **Approved By**: Text input

### 2. Soil Test Data Table
**Main Table Columns:**
- **Sample No.**: Text input (e.g., "D-1", "S/D-1", "U-1")
- **Sample Depth (m)**: Number input with 0.01 precision
- **Observed N Value IS - 2131**: Number input (SPT values)
- **Corrected N" Value IS - 2131**: Number input (corrected SPT values)
- **Type of Soil Sample**: Dropdown (D=Disturbed, U=Undisturbed, S=SPT)
- **Hatching Pattern**: Dropdown (Solid, Dashed, Dotted, Cross-hatched)
- **Soil Classification**: Text input (e.g., "CI (12.25)")

### 3. Moisture Content Section
**Multiple moisture content fields for different specimen types:**
- **@ Disturbed / Undisturbed Sample**: Number input (%)
- **@ UCS Specimen**: Number input (%)
- **@ Triaxial Specimen**: Number input (%)
- **@ Direct Shear Specimen**: Number input (%)
- **@ Consolidation Specimen**: Number input (%)

### 4. Natural Density Section
**BS - 1377 Part - 2:**
- **Bulk Density (γb)**: Number input (gm/cc)
- **Dry Density (γd)**: Number input (gm/cc)

### 5. Specific Gravity Section
**IS - 2720 Part - 3 (Sec-1/2):**
- **Sp. Gravity (G)**: Number input

### 6. Grain Size Analysis Section
**IS - 2720 Part - 4 (Sieving Method):**
- **Gravel (G)**: Number input (%)
- **Sand (S)**: Number input (%)
- **Silt (M)**: Number input (%)
- **Clay (C)**: Number input (%)

### 7. Atterberg Limits Section
**IS - 2720 Part - 5 / 6:**
- **Liquid Limit (WL)**: Number input (%)
- **Plastic Limit (Wp)**: Number input (%)
- **Plasticity Index (Ip)**: Number input (%)
- **Shrinkage Limit (Ws / Wsu)**: Number input (%)

### 8. Permeability Section
**IS - 2720 Part - 17:**
- **Permeability (Kr)**: Number input (cm/sec)

### 9. Swelling Section
**IS - 2720 Part - 40:**
- **Free Swell Index**: Number input (%)
**IS - 2720 Part - 41:**
- **Swelling Pressure**: Number input (kg/cm²)

### 10. Shear Strength Parameters Section
**IS - 2720 Part - 10 / 11 / 13:**
- **Type of Test**: Dropdown (TR-UU, TR-CU, TR-CD, DS-UU, DS-CU, DS-CD)
- **Cohesion (C) / Cohesion Intercept (C)**: Number input (kg/cm²)
- **Angle of Shear Plane / Angle of Shearing Resistance (Φ)**: Number input (degrees)
- **Unconfined Compressive Strength (qu) UCS**: Number input (kg/cm²)

### 11. Consolidation Test Section
**IS - 2720 Part - 15:**
- **Initial Void Ratio (eo)**: Number input
- **Compression Index (Cc)**: Number input
- **Pre-consolidation Pressure (Pc)**: Number input (kg/cm²)

### 12. Test Summary Section
**Summary table showing count of tests performed:**
- **NMC (%)**: Number input
- **Dry Density**: Number input
- **Liquid Limit**: Number input
- **Plastic Limit**: Number input
- **Shrinkage limit**: Number input
- **Sp. Gravity**: Number input
- **Sieve analysis**: Number input
- **Hydrometer test**: Number input
- **Direct Shear Test**: Number input
- **Natural Density**: Number input
- **Consolidation Test**: Number input
- **UCS**: Number input
- **Triaxial Test**: Number input

## Rock Lab Test Report Fields

### 1. Header Section
**Company Information:**
- **Logo**: APC
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

### 2. Sample Summary Section
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

### 3. Detailed Test Data Tables

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

#### 3.2 Buoyancy Techniques Table
**Columns:**
- Sample No.
- Depth (m)
- Weight in Air (g)
- Weight in Water (g)
- Weight Saturated (g)
- Volume Water Displaced (cm³)
- Density (g/cm³)
- Moisture Content (%)
- Water Absorption (%)
- Porosity (%)

#### 3.3 Point Load Test Table
**Columns:**
- Sample No.
- Depth (m)
- Failure Load (kN)
- Point Load Index (Is50) (MPa)
- Uniaxial Compressive Strength (MPa)

#### 3.4 Brazilian Tensile Strength Table
**Columns:**
- Sample No.
- Depth (m)
- Brazilian Tensile Strength (MPa)

## Form Implementation Requirements

### UI Components Needed
1. **Tabbed Interface**: Separate tabs for Header Info, Test Data, Summary, Review, and Preview
2. **Dynamic Tables**: Expandable/collapsible tables for test data
3. **Form Validation**: Required field validation and data type checking
4. **Auto-calculation**: Automatic calculation of derived values (e.g., plasticity index = liquid limit - plastic limit)
5. **File Upload**: Support for attaching raw data files and final reports
6. **Print/Export**: PDF export functionality matching the original report format

### Data Types and Validation
- **Numbers**: Proper decimal precision for different measurements
- **Percentages**: Validation for 0-100% range
- **Coordinates**: Validation for valid coordinate ranges
- **Dates**: Date picker with proper formatting
- **Dropdowns**: Predefined options for test types and standards

### Standards Compliance
- **IS Standards**: Indian Standards for soil testing
- **BS Standards**: British Standards for density testing
- **ASTM Standards**: American Society for Testing and Materials standards
- **Custom Methods**: Support for laboratory-specific test methods

### Sample Data Patterns
**Soil Test Depth Increments:**
- Typical: 0.50, 1.50, 3.00, 4.50, 6.00, 7.50, 9.00, 10.50 m
- Configurable depth intervals

**Rock Test Depth Increments:**
- Typical: 0.50, 1.00, 1.50, 2.00, 2.50, 3.00, 3.50, 4.00, 4.50, 5.00 m
- Configurable depth intervals

### Footnotes and Legend
**Common Abbreviations:**
- **TR**: Triaxial Shear Test
- **DS**: Direct Shear Test
- **UCS**: Unconfined Compression Strength
- **Np**: Non Plastic
- **#**: Remoulded Specimen
- **D**: Disturbed Sample
- **U**: Undisturbed Sample
- **S**: SPT Sample
- **CU**: Consolidated Undrained
- **CD**: Consolidated Drained
- **UU**: Unconsolidated Undrained
- **BGL**: Below Ground Level
- **AGL**: Above Ground Level

## Implementation Notes

### Form State Management
- Use React state management for form data
- Implement auto-save functionality for draft reports
- Support for loading existing reports for editing

### Role-Based Access
- **Lab Engineer**: Full form access, can save drafts
- **Approval Engineer**: Review section access
- **Read-only Mode**: For approved reports

### Data Export
- PDF generation matching original report format
- Excel export for data analysis
- JSON export for data integration

### Validation Rules
- Required fields validation
- Numeric range validation
- Cross-field validation (e.g., plasticity index calculation)
- Standard compliance validation

This specification ensures that the lab test report forms accurately capture all the data fields present in the original soil and rock test reports while providing a modern, user-friendly interface for data entry and management.
