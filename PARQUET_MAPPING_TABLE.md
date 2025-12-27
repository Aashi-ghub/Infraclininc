# Parquet Mapping Table - Quick Reference

## DB Table → Parquet File → Folder Path

| DB Table | Parquet File | Folder Path | Access Pattern | Priority |
|----------|-------------|-------------|----------------|----------|
| `customers` | `customers.parquet` | `core/customers/` | Read-heavy | Low |
| `organisations` | `organisations.parquet` | `core/organisations/` | Read-heavy | Low |
| `users` | `users.parquet` | `core/users/` | Read-heavy | Low |
| `contacts` | `contacts.parquet` | `core/contacts/` | Read-heavy | Low |
| `projects` | `projects.parquet` | `projects/projects/` | Read-heavy | Low |
| `user_project_assignments` | `user_project_assignments.parquet` | `projects/user_project_assignments/` | Read-heavy | Medium |
| `structure` | `structure.parquet` | `projects/structure/` | Read-heavy | Medium |
| `structure_areas` | `structure_areas.parquet` | `projects/structure_areas/` | Read-heavy | Medium |
| `sub_structures` | `sub_structures.parquet` | `projects/sub_structures/` | Read-heavy | Medium |
| `borehole` | `borehole.parquet` | `boreholes/borehole/` | Write-heavy | High |
| `boreloge` | `boreloge.parquet` | `boreholes/boreloge/` | Write-heavy | High |
| `borelog_details` | `borelog_details.parquet` | `boreholes/borelog_details/` | Write-heavy | High |
| `borelog_versions` | `borelog_versions.parquet` | `boreholes/borelog_versions/` | **Append-only** ⭐ | **Critical** |
| `borelog_submissions` | `borelog_submissions.parquet` | `boreholes/borelog_submissions/` | **Append-only** ⭐ | **Critical** |
| `borelog_assignments` | `borelog_assignments.parquet` | `boreholes/borelog_assignments/` | Write-heavy | Medium |
| `borelog_images` | `borelog_images.parquet` | `boreholes/borelog_images/` | **Append-only** ⭐ | High |
| `borelog_review_comments` | `borelog_review_comments.parquet` | `boreholes/borelog_review_comments/` | **Append-only** ⭐ | High |
| `geological_log` | `geological_log.parquet` | `boreholes/geological_log/` | Read-heavy | ⚠️ Verify usage |
| `stratum_layers` | `stratum_layers.parquet` | `stratum/stratum_layers/` | **Append-only** ⭐ | **Critical** |
| `stratum_sample_points` | `stratum_sample_points.parquet` | `stratum/stratum_sample_points/` | **Append-only** ⭐ | **Critical** |
| `lab_test_assignments` | `lab_test_assignments.parquet` | `lab_reports/lab_test_assignments/` | Write-heavy | High |
| `unified_lab_reports` | `unified_lab_reports.parquet` | `lab_reports/unified_lab_reports/` | Write-heavy | High |
| `lab_report_versions` | `lab_report_versions.parquet` | `lab_reports/lab_report_versions/` | **Append-only** ⭐ | **Critical** |
| `lab_report_comments` | `lab_report_comments.parquet` | `lab_reports/lab_report_comments/` | **Append-only** ⭐ | High |
| `soil_test_samples` | `soil_test_samples.parquet` | `lab_reports/soil_test_samples/` | **Append-only** ⭐ | **Critical** |
| `rock_test_samples` | `rock_test_samples.parquet` | `lab_reports/rock_test_samples/` | **Append-only** ⭐ | **Critical** |
| `final_lab_reports` | `final_lab_reports.parquet` | `lab_reports/final_lab_reports/` | Write-heavy | Medium |
| `pending_csv_uploads` | `pending_csv_uploads.parquet` | `workflow/pending_csv_uploads/` | Write-heavy | Medium |
| `substructure_assignments` | `substructure_assignments.parquet` | `workflow/substructure_assignments/` | Write-heavy | Medium |

## Legend
- ⭐ **Append-only**: Perfect for Parquet, never updated, only inserts
- ⚠️ **Verify usage**: May be deprecated or overlapping with other tables
- **Critical**: High priority for implementation
- **High**: Important for analytics
- **Medium**: Moderate priority
- **Low**: Small tables, less critical

## Access Pattern Summary
- **Read-heavy**: Frequent SELECTs, infrequent UPDATEs (4 tables)
- **Write-heavy**: Frequent INSERTs/UPDATEs (12 tables)
- **Append-only**: INSERT-only, never UPDATE (11 tables) ⭐ **Best candidates for Parquet**

## Duplicate/Overlapping Tables (Action Required)
1. `geological_log` - Overlaps with `borelog_details` + `borelog_versions` → **Verify if still used**
2. `lab_assignments` - May be deprecated, replaced by `lab_test_assignments` → **Verify status**
3. `lab_test_results` - May be deprecated, replaced by `unified_lab_reports` → **Verify status**

## Frontend/API Impact
✅ **NO CHANGES REQUIRED** - Parquet export is backend-only analytics solution. PostgreSQL remains source of truth.












