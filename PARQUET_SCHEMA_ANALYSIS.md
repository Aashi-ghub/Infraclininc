# PostgreSQL to Parquet Schema Analysis

## Executive Summary

This document provides a comprehensive analysis of all PostgreSQL entities, their access patterns, and proposed Parquet schema mappings for data archival/analytics purposes. **No frontend or API changes are required** - this is purely a backend data storage optimization.

---

## 1. Complete Entity Inventory

### Core User & Organization Tables (Read-Heavy, Low Update Frequency)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `customers` | `customer_id` (UUID) | Low (10s-100s) | Read-heavy, infrequent writes |
| `organisations` | `organisation_id` (UUID) | Low (10s-100s) | Read-heavy, infrequent writes |
| `users` | `user_id` (UUID) | Medium (100s-1000s) | Read-heavy, moderate writes |
| `contacts` | `contact_id` (UUID) | Medium (100s-1000s) | Read-heavy, moderate writes |

### Project & Structure Tables (Read-Heavy, Moderate Updates)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `projects` | `project_id` (UUID) | Low-Medium (10s-100s) | Read-heavy, moderate writes |
| `user_project_assignments` | `id` (UUID) | Medium (100s-1000s) | Read-heavy, frequent writes |
| `structure` | `structure_id` (UUID) | Medium (100s-1000s) | Read-heavy, moderate writes |
| `structure_areas` | `area_id` (UUID) | Medium (100s-1000s) | Read-heavy, moderate writes |
| `sub_structures` | `substructure_id` (UUID) | Medium (100s-1000s) | Read-heavy, moderate writes |

### Borehole & Borelog Tables (Write-Heavy, High Read Volume)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `borehole` | `borehole_id` (UUID) | Medium-High (1000s-10Ks) | Write-heavy, read-heavy |
| `boreloge` | `borelog_id` (UUID) | Medium-High (1000s-10Ks) | Write-heavy, read-heavy |
| `borelog_details` | `borelog_id` (UUID) | Medium-High (1000s-10Ks) | Write-heavy, read-heavy |
| `borelog_versions` | `(borelog_id, version_no)` | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `borelog_submissions` | `submission_id` (UUID) | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `borelog_assignments` | `assignment_id` (UUID) | Medium (100s-1000s) | Write-heavy, read-heavy |
| `borelog_images` | `image_id` (UUID) | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `borelog_review_comments` | `comment_id` (UUID) | Medium-High (1000s-10Ks) | **Append-only**, read-heavy |

### Geological Log Table (Legacy/Overlapping)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `geological_log` | `borelog_id` (UUID) | Medium-High (1000s-10Ks) | **Overlaps with borelog_details** - Read-heavy |

### Stratum Tables (Append-Only, High Volume)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `stratum_layers` | `id` (UUID) | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `stratum_sample_points` | `id` (UUID) | Very High (100Ks-1M+) | **Append-only**, read-heavy |

### Lab Report Tables (Write-Heavy, High Read Volume)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `lab_test_assignments` | `assignment_id` (UUID) | Medium (100s-1000s) | Write-heavy, read-heavy |
| `unified_lab_reports` | `report_id` (UUID) | Medium-High (1000s-10Ks) | Write-heavy, read-heavy |
| `lab_report_versions` | `(report_id, version_no)` | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `lab_report_comments` | `comment_id` (UUID) | Medium (100s-1000s) | **Append-only**, read-heavy |
| `soil_test_samples` | `sample_id` (UUID) | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `rock_test_samples` | `sample_id` (UUID) | High (10Ks-100Ks) | **Append-only**, read-heavy |
| `final_lab_reports` | `final_report_id` (UUID) | Medium (100s-1000s) | Write-heavy, read-heavy |

### Workflow & Approval Tables (Append-Only)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `pending_csv_uploads` | `upload_id` (UUID) | Medium (100s-1000s) | Write-heavy, read-heavy |

### Assignment Tables (Moderate Updates)

| Table Name | Primary Key | Row Count Estimate | Access Pattern |
|------------|-------------|-------------------|----------------|
| `substructure_assignments` | `assignment_id` (UUID) | Medium (100s-1000s) | Write-heavy, read-heavy |

### Deprecated/Legacy Tables (May Be Removed)

| Table Name | Status | Notes |
|------------|-------|-------|
| `lab_assignments` | **Potentially Deprecated** | Replaced by `lab_test_assignments` |
| `lab_test_results` | **Potentially Deprecated** | Replaced by `unified_lab_reports` |

---

## 2. Access Pattern Classification

### Read-Heavy Tables (Frequent SELECTs, Infrequent UPDATEs)
- `customers`, `organisations`, `users`, `contacts`
- `projects`, `structure`, `structure_areas`, `sub_structures`
- `user_project_assignments`
- **Strategy**: Parquet files can be updated less frequently (daily/weekly snapshots)

### Write-Heavy Tables (Frequent INSERTs/UPDATEs)
- `borehole`, `boreloge`, `borelog_details`
- `unified_lab_reports`, `lab_test_assignments`
- `borelog_assignments`, `substructure_assignments`
- **Strategy**: Incremental Parquet updates (hourly/daily)

### Append-Only Tables (INSERT-only, Never UPDATE)
- `borelog_versions` ⭐ **Highest Priority**
- `lab_report_versions` ⭐ **Highest Priority**
- `stratum_layers`, `stratum_sample_points` ⭐ **Highest Priority**
- `borelog_submissions`, `borelog_images`
- `borelog_review_comments`, `lab_report_comments`
- `soil_test_samples`, `rock_test_samples`
- **Strategy**: Perfect for Parquet - append new partitions, never rewrite

---

## 3. Duplicate/Overlapping Tables

### ⚠️ Critical Overlaps

1. **`geological_log` vs `borelog_details` + `borelog_versions`**
   - **Issue**: `geological_log` appears to be a legacy flat table that overlaps with the newer normalized `borelog_details`/`borelog_versions` structure
   - **Recommendation**: 
     - If `geological_log` is still actively used, map it separately
     - If deprecated, exclude from Parquet export
     - **Action Required**: Verify current usage

2. **`lab_assignments` vs `lab_test_assignments`**
   - **Issue**: Two similar assignment tables exist
   - **Recommendation**: 
     - Check if `lab_assignments` is deprecated
     - If active, map both; if deprecated, exclude `lab_assignments`
     - **Action Required**: Verify which table is actively used

3. **`lab_test_results` vs `unified_lab_reports` + `soil_test_samples` + `rock_test_samples`**
   - **Issue**: `lab_test_results` may be deprecated in favor of normalized tables
   - **Recommendation**: 
     - Exclude `lab_test_results` if deprecated
     - **Action Required**: Verify migration status

---

## 4. Proposed Parquet Schema Mapping

### Folder Structure
```
s3://bucket-name/parquet-exports/
├── core/
│   ├── customers/
│   ├── organisations/
│   ├── users/
│   └── contacts/
├── projects/
│   ├── projects/
│   ├── user_project_assignments/
│   ├── structure/
│   ├── structure_areas/
│   └── sub_structures/
├── boreholes/
│   ├── borehole/
│   ├── boreloge/
│   ├── borelog_details/
│   ├── borelog_versions/          # Append-only ⭐
│   ├── borelog_submissions/       # Append-only ⭐
│   ├── borelog_assignments/
│   ├── borelog_images/            # Append-only ⭐
│   └── borelog_review_comments/   # Append-only ⭐
├── stratum/
│   ├── stratum_layers/            # Append-only ⭐
│   └── stratum_sample_points/     # Append-only ⭐
├── lab_reports/
│   ├── lab_test_assignments/
│   ├── unified_lab_reports/
│   ├── lab_report_versions/       # Append-only ⭐
│   ├── lab_report_comments/       # Append-only ⭐
│   ├── soil_test_samples/         # Append-only ⭐
│   ├── rock_test_samples/         # Append-only ⭐
│   └── final_lab_reports/
└── workflow/
    ├── pending_csv_uploads/
    └── substructure_assignments/
```

### Complete Mapping Table

| DB Table | Parquet File Name | Folder Path | Partition Strategy | Update Frequency |
|----------|-------------------|-------------|-------------------|------------------|
| `customers` | `customers.parquet` | `core/customers/` | None (small table) | Daily snapshot |
| `organisations` | `organisations.parquet` | `core/organisations/` | None (small table) | Daily snapshot |
| `users` | `users.parquet` | `core/users/` | None (small table) | Daily snapshot |
| `contacts` | `contacts.parquet` | `core/contacts/` | None (small table) | Daily snapshot |
| `projects` | `projects.parquet` | `projects/projects/` | None (small table) | Daily snapshot |
| `user_project_assignments` | `user_project_assignments.parquet` | `projects/user_project_assignments/` | By `project_id` | Daily incremental |
| `structure` | `structure.parquet` | `projects/structure/` | By `project_id` | Daily incremental |
| `structure_areas` | `structure_areas.parquet` | `projects/structure_areas/` | By `structure_id` | Daily incremental |
| `sub_structures` | `sub_structures.parquet` | `projects/sub_structures/` | By `project_id` | Daily incremental |
| `borehole` | `borehole.parquet` | `boreholes/borehole/` | By `project_id` | Daily incremental |
| `boreloge` | `boreloge.parquet` | `boreholes/boreloge/` | By `project_id` | Daily incremental |
| `borelog_details` | `borelog_details.parquet` | `boreholes/borelog_details/` | By `borelog_id` | Daily incremental |
| `borelog_versions` | `borelog_versions.parquet` | `boreholes/borelog_versions/` | By `project_id/year/month` | **Hourly append** ⭐ |
| `borelog_submissions` | `borelog_submissions.parquet` | `boreholes/borelog_submissions/` | By `project_id/year/month` | **Hourly append** ⭐ |
| `borelog_assignments` | `borelog_assignments.parquet` | `boreholes/borelog_assignments/` | By `project_id` | Daily incremental |
| `borelog_images` | `borelog_images.parquet` | `boreholes/borelog_images/` | By `borelog_id/year/month` | **Hourly append** ⭐ |
| `borelog_review_comments` | `borelog_review_comments.parquet` | `boreholes/borelog_review_comments/` | By `borelog_id/year/month` | **Hourly append** ⭐ |
| `geological_log` | `geological_log.parquet` | `boreholes/geological_log/` | By `project_id` | Daily snapshot (if active) |
| `stratum_layers` | `stratum_layers.parquet` | `stratum/stratum_layers/` | By `borelog_id/year/month` | **Hourly append** ⭐ |
| `stratum_sample_points` | `stratum_sample_points.parquet` | `stratum/stratum_sample_points/` | By `borelog_id/year/month` | **Hourly append** ⭐ |
| `lab_test_assignments` | `lab_test_assignments.parquet` | `lab_reports/lab_test_assignments/` | By `borelog_id` | Daily incremental |
| `unified_lab_reports` | `unified_lab_reports.parquet` | `lab_reports/unified_lab_reports/` | By `borelog_id` | Daily incremental |
| `lab_report_versions` | `lab_report_versions.parquet` | `lab_reports/lab_report_versions/` | By `report_id/year/month` | **Hourly append** ⭐ |
| `lab_report_comments` | `lab_report_comments.parquet` | `lab_reports/lab_report_comments/` | By `report_id/year/month` | **Hourly append** ⭐ |
| `soil_test_samples` | `soil_test_samples.parquet` | `lab_reports/soil_test_samples/` | By `report_id/year/month` | **Hourly append** ⭐ |
| `rock_test_samples` | `rock_test_samples.parquet` | `lab_reports/rock_test_samples/` | By `report_id/year/month` | **Hourly append** ⭐ |
| `final_lab_reports` | `final_lab_reports.parquet` | `lab_reports/final_lab_reports/` | By `borelog_id` | Daily incremental |
| `pending_csv_uploads` | `pending_csv_uploads.parquet` | `workflow/pending_csv_uploads/` | By `project_id` | Daily incremental |
| `substructure_assignments` | `substructure_assignments.parquet` | `workflow/substructure_assignments/` | By `borelog_id` | Daily incremental |

---

## 5. Parquet Schema Definitions

### Schema Design Principles
1. **Preserve PostgreSQL types**: UUID → STRING, TIMESTAMP → TIMESTAMP_MILLIS, JSONB → STRING (JSON)
2. **Geography types**: `GEOGRAPHY(POINT)` → Two columns: `latitude` (DOUBLE), `longitude` (DOUBLE)
3. **Arrays**: PostgreSQL arrays → Parquet LIST<STRING> or LIST<INTEGER>
4. **Enums**: Convert to STRING
5. **Nullable fields**: Marked as optional in Parquet schema

### Example Parquet Schemas

#### `borelog_versions` (Append-Only, High Priority)
```parquet
message borelog_versions {
  required binary borelog_id (UTF8);
  required int32 version_no;
  optional binary number (UTF8);
  optional binary msl (UTF8);
  optional binary boring_method (UTF8);
  optional double hole_diameter;
  optional int64 commencement_date (TIMESTAMP_MILLIS);
  optional int64 completion_date (TIMESTAMP_MILLIS);
  optional double standing_water_level;
  optional double termination_depth;
  optional double coordinate_latitude;
  optional double coordinate_longitude;
  optional binary permeability_test_count (UTF8);
  optional binary spt_vs_test_count (UTF8);
  optional binary undisturbed_sample_count (UTF8);
  optional binary disturbed_sample_count (UTF8);
  optional binary water_sample_count (UTF8);
  optional binary stratum_description (UTF8);
  optional double stratum_depth_from;
  optional double stratum_depth_to;
  optional double stratum_thickness_m;
  optional binary sample_event_type (UTF8);
  optional double sample_event_depth_m;
  optional double run_length_m;
  optional double spt_blows_per_15cm;
  optional binary n_value_is_2131 (UTF8);
  optional double total_core_length_cm;
  optional double tcr_percent;
  optional double rqd_length_cm;
  optional double rqd_percent;
  optional binary return_water_colour (UTF8);
  optional binary water_loss (UTF8);
  optional double borehole_diameter;
  optional binary remarks (UTF8);
  optional binary created_by_user_id (UTF8);
  required binary status (UTF8);
  optional binary approved_by (UTF8);
  optional int64 approved_at (TIMESTAMP_MILLIS);
  required int64 created_at (TIMESTAMP_MILLIS);
}
```

#### `stratum_sample_points` (Append-Only, Very High Volume)
```parquet
message stratum_sample_points {
  required binary id (UTF8);
  required binary stratum_layer_id (UTF8);
  required int32 sample_order;
  optional binary sample_type (UTF8);
  optional binary depth_mode (UTF8);
  optional double depth_single_m;
  optional double depth_from_m;
  optional double depth_to_m;
  optional double run_length_m;
  optional int32 spt_15cm_1;
  optional int32 spt_15cm_2;
  optional int32 spt_15cm_3;
  optional int32 n_value;
  optional double total_core_length_cm;
  optional double tcr_percent;
  optional double rqd_length_cm;
  optional double rqd_percent;
  optional binary created_by_user_id (UTF8);
  required int64 created_at (TIMESTAMP_MILLIS);
}
```

#### `unified_lab_reports` (Write-Heavy)
```parquet
message unified_lab_reports {
  required binary report_id (UTF8);
  required binary assignment_id (UTF8);
  required binary borelog_id (UTF8);
  required binary sample_id (UTF8);
  required binary project_name (UTF8);
  required binary borehole_no (UTF8);
  optional binary client (UTF8);
  required int64 test_date (TIMESTAMP_MILLIS);
  required binary tested_by (UTF8);
  required binary checked_by (UTF8);
  required binary approved_by (UTF8);
  required binary test_types (UTF8); // JSON string
  required binary soil_test_data (UTF8); // JSON string
  required binary rock_test_data (UTF8); // JSON string
  required binary status (UTF8);
  optional binary remarks (UTF8);
  optional int64 submitted_at (TIMESTAMP_MILLIS);
  optional int64 approved_at (TIMESTAMP_MILLIS);
  optional int64 rejected_at (TIMESTAMP_MILLIS);
  optional binary rejection_reason (UTF8);
  required int64 created_at (TIMESTAMP_MILLIS);
  required int64 updated_at (TIMESTAMP_MILLIS);
}
```

#### `users` (Read-Heavy, Small Table)
```parquet
message users {
  required binary user_id (UTF8);
  optional binary organisation_id (UTF8);
  optional binary customer_id (UTF8);
  optional binary name (UTF8);
  required binary role (UTF8);
  optional binary email (UTF8);
  optional int64 date_created (TIMESTAMP_MILLIS);
  optional int64 created_at (TIMESTAMP_MILLIS);
  optional int64 updated_at (TIMESTAMP_MILLIS);
}
```

---

## 6. Implementation Notes

### Partitioning Strategy
- **Append-only tables**: Partition by `year/month` for efficient time-based queries
- **Project-based tables**: Partition by `project_id` for efficient project filtering
- **Small tables**: No partitioning needed

### Update Frequency
- **Append-only tables**: Hourly incremental appends (new data only)
- **Write-heavy tables**: Daily incremental updates (changed + new rows)
- **Read-heavy tables**: Daily full snapshots (small tables, simple to rebuild)

### Data Retention
- **Append-only tables**: Keep all historical data (never delete)
- **Other tables**: Consider retention policies (e.g., keep last 2 years in Parquet)

---

## 7. Frontend/API Impact Assessment

### ✅ **CONFIRMED: NO FRONTEND OR API CHANGES REQUIRED**

This Parquet export is a **backend-only data archival/analytics solution**. The existing PostgreSQL database remains the **source of truth** for all API operations. Parquet files are:
- **Read-only** from the application perspective
- Used for analytics, reporting, and data warehousing
- Not accessed by frontend or API endpoints
- Can be generated asynchronously without affecting application performance

### Current Architecture (Unchanged)
```
Frontend → API → PostgreSQL (Source of Truth)
                      ↓
                  Parquet Export (Analytics Only)
```

---

## 8. Recommendations

### High Priority (Append-Only Tables)
1. **`borelog_versions`** - Critical for audit trail
2. **`lab_report_versions`** - Critical for audit trail
3. **`stratum_layers`** + **`stratum_sample_points`** - High volume, perfect for Parquet
4. **`borelog_submissions`** - Workflow tracking
5. **`soil_test_samples`** + **`rock_test_samples`** - High volume lab data

### Medium Priority (Write-Heavy Tables)
1. **`borelog_details`** - Core borelog data
2. **`unified_lab_reports`** - Core lab reports
3. **`borehole`**, **`boreloge`** - Core entities

### Low Priority (Read-Heavy, Small Tables)
1. **`users`**, **`projects`**, **`structure`** - Small tables, less critical for analytics

### Action Items
1. ✅ **Verify** if `geological_log` is still actively used
2. ✅ **Verify** if `lab_assignments` is deprecated
3. ✅ **Verify** if `lab_test_results` is deprecated
4. ✅ **Confirm** Parquet export frequency requirements with stakeholders
5. ✅ **Set up** incremental export jobs for append-only tables
6. ✅ **Set up** snapshot jobs for small read-heavy tables

---

## 9. Summary Statistics

| Category | Table Count | Total Estimated Rows |
|----------|-------------|---------------------|
| Core (Users/Orgs) | 4 | ~1K-10K |
| Projects/Structures | 5 | ~1K-10K |
| Boreholes/Borelogs | 9 | ~100K-1M |
| Stratum Data | 2 | ~1M-10M |
| Lab Reports | 7 | ~100K-1M |
| Workflow | 2 | ~1K-10K |
| **TOTAL** | **29** | **~2M-12M rows** |

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Status**: Ready for Implementation Review












