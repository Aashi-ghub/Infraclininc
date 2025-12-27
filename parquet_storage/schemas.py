"""
Parquet Schema Definitions

Defines PyArrow schemas for all database tables based on PostgreSQL schema analysis.
These schemas are used for validation before writing Parquet files.
"""

import pyarrow as pa
from typing import Dict, Optional


class SchemaRegistry:
    """Registry of Parquet schemas for all database tables."""
    
    _schemas: Dict[str, pa.Schema] = {}
    
    @classmethod
    def register(cls, table_name: str, schema: pa.Schema) -> None:
        """Register a schema for a table."""
        cls._schemas[table_name.lower()] = schema
    
    @classmethod
    def get(cls, table_name: str) -> Optional[pa.Schema]:
        """Get schema for a table."""
        return cls._schemas.get(table_name.lower())
    
    @classmethod
    def list_tables(cls) -> list:
        """List all registered table names."""
        return list(cls._schemas.keys())


# ============================================================================
# Core Tables (Users, Organizations)
# ============================================================================

SCHEMA_CUSTOMERS = pa.schema([
    pa.field("customer_id", pa.string(), nullable=False),
    pa.field("name", pa.string(), nullable=False),
    pa.field("date_created", pa.timestamp("ms"), nullable=True),
])

SCHEMA_ORGANISATIONS = pa.schema([
    pa.field("organisation_id", pa.string(), nullable=False),
    pa.field("customer_id", pa.string(), nullable=True),
    pa.field("name", pa.string(), nullable=False),
    pa.field("date_created", pa.timestamp("ms"), nullable=True),
])

SCHEMA_USERS = pa.schema([
    pa.field("user_id", pa.string(), nullable=False),
    pa.field("organisation_id", pa.string(), nullable=True),
    pa.field("customer_id", pa.string(), nullable=True),
    pa.field("name", pa.string(), nullable=True),
    pa.field("role", pa.string(), nullable=False),
    pa.field("email", pa.string(), nullable=True),
    pa.field("date_created", pa.timestamp("ms"), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_CONTACTS = pa.schema([
    pa.field("contact_id", pa.string(), nullable=False),
    pa.field("organisation_id", pa.string(), nullable=False),
    pa.field("name", pa.string(), nullable=True),
    pa.field("role", pa.string(), nullable=False),
    pa.field("date_created", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

# ============================================================================
# Project & Structure Tables
# ============================================================================

SCHEMA_PROJECTS = pa.schema([
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("name", pa.string(), nullable=False),
    pa.field("location", pa.string(), nullable=True),
    pa.field("created_by", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_USER_PROJECT_ASSIGNMENTS = pa.schema([
    pa.field("id", pa.string(), nullable=False),
    pa.field("assignment_type", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("assigner", pa.list_(pa.string()), nullable=False),  # UUID array
    pa.field("assignee", pa.list_(pa.string()), nullable=False),  # UUID array
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_STRUCTURE = pa.schema([
    pa.field("structure_id", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("type", pa.string(), nullable=False),
    pa.field("description", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_STRUCTURE_AREAS = pa.schema([
    pa.field("area_id", pa.string(), nullable=False),
    pa.field("structure_id", pa.string(), nullable=False),
    pa.field("component", pa.string(), nullable=False),
    pa.field("shortcode", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_SUB_STRUCTURES = pa.schema([
    pa.field("substructure_id", pa.string(), nullable=False),
    pa.field("structure_id", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("type", pa.string(), nullable=False),
    pa.field("remark", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

# ============================================================================
# Borehole & Borelog Tables
# ============================================================================

SCHEMA_BOREHOLE = pa.schema([
    pa.field("borehole_id", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("structure_id", pa.string(), nullable=True),
    pa.field("substructure_id", pa.string(), nullable=True),
    pa.field("tunnel_no", pa.string(), nullable=True),
    pa.field("location", pa.string(), nullable=True),
    pa.field("chainage", pa.string(), nullable=True),
    pa.field("borehole_number", pa.string(), nullable=True),
    pa.field("msl", pa.string(), nullable=True),
    pa.field("coordinate_latitude", pa.float64(), nullable=True),  # From GEOGRAPHY(POINT)
    pa.field("coordinate_longitude", pa.float64(), nullable=True),
    pa.field("boring_method", pa.string(), nullable=True),
    pa.field("hole_diameter", pa.float64(), nullable=True),
    pa.field("description", pa.string(), nullable=True),
    pa.field("coordinates", pa.string(), nullable=True),  # JSONB as string
    pa.field("status", pa.string(), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_BORELOGE = pa.schema([
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("substructure_id", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("type", pa.string(), nullable=False),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_BORELOG_DETAILS = pa.schema([
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("number", pa.string(), nullable=True),
    pa.field("msl", pa.string(), nullable=True),
    pa.field("boring_method", pa.string(), nullable=True),
    pa.field("hole_diameter", pa.float64(), nullable=True),
    pa.field("commencement_date", pa.timestamp("ms"), nullable=True),
    pa.field("completion_date", pa.timestamp("ms"), nullable=True),
    pa.field("standing_water_level", pa.float64(), nullable=True),
    pa.field("termination_depth", pa.float64(), nullable=True),
    pa.field("coordinate_latitude", pa.float64(), nullable=True),
    pa.field("coordinate_longitude", pa.float64(), nullable=True),
    pa.field("permeability_test_count", pa.string(), nullable=True),
    pa.field("spt_vs_test_count", pa.string(), nullable=True),
    pa.field("undisturbed_sample_count", pa.string(), nullable=True),
    pa.field("disturbed_sample_count", pa.string(), nullable=True),
    pa.field("water_sample_count", pa.string(), nullable=True),
    pa.field("stratum_description", pa.string(), nullable=True),
    pa.field("stratum_depth_from", pa.float64(), nullable=True),
    pa.field("stratum_depth_to", pa.float64(), nullable=True),
    pa.field("stratum_thickness_m", pa.float64(), nullable=True),
    pa.field("sample_event_type", pa.string(), nullable=True),
    pa.field("sample_event_depth_m", pa.float64(), nullable=True),
    pa.field("run_length_m", pa.float64(), nullable=True),
    pa.field("spt_blows_per_15cm", pa.float64(), nullable=True),
    pa.field("n_value_is_2131", pa.string(), nullable=True),
    pa.field("total_core_length_cm", pa.float64(), nullable=True),
    pa.field("tcr_percent", pa.float64(), nullable=True),
    pa.field("rqd_length_cm", pa.float64(), nullable=True),
    pa.field("rqd_percent", pa.float64(), nullable=True),
    pa.field("return_water_colour", pa.string(), nullable=True),
    pa.field("water_loss", pa.string(), nullable=True),
    pa.field("borehole_diameter", pa.float64(), nullable=True),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("location", pa.string(), nullable=True),
    pa.field("chainage_km", pa.float64(), nullable=True),
    pa.field("job_code", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
])

SCHEMA_BORELOG_VERSIONS = pa.schema([
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("version_no", pa.int32(), nullable=False),
    pa.field("number", pa.string(), nullable=True),
    pa.field("msl", pa.string(), nullable=True),
    pa.field("boring_method", pa.string(), nullable=True),
    pa.field("hole_diameter", pa.float64(), nullable=True),
    pa.field("commencement_date", pa.timestamp("ms"), nullable=True),
    pa.field("completion_date", pa.timestamp("ms"), nullable=True),
    pa.field("standing_water_level", pa.float64(), nullable=True),
    pa.field("termination_depth", pa.float64(), nullable=True),
    pa.field("coordinate_latitude", pa.float64(), nullable=True),
    pa.field("coordinate_longitude", pa.float64(), nullable=True),
    pa.field("permeability_test_count", pa.string(), nullable=True),
    pa.field("spt_vs_test_count", pa.string(), nullable=True),
    pa.field("undisturbed_sample_count", pa.string(), nullable=True),
    pa.field("disturbed_sample_count", pa.string(), nullable=True),
    pa.field("water_sample_count", pa.string(), nullable=True),
    pa.field("stratum_description", pa.string(), nullable=True),
    pa.field("stratum_depth_from", pa.float64(), nullable=True),
    pa.field("stratum_depth_to", pa.float64(), nullable=True),
    pa.field("stratum_thickness_m", pa.float64(), nullable=True),
    pa.field("sample_event_type", pa.string(), nullable=True),
    pa.field("sample_event_depth_m", pa.float64(), nullable=True),
    pa.field("run_length_m", pa.float64(), nullable=True),
    pa.field("spt_blows_per_15cm", pa.float64(), nullable=True),
    pa.field("n_value_is_2131", pa.string(), nullable=True),
    pa.field("total_core_length_cm", pa.float64(), nullable=True),
    pa.field("tcr_percent", pa.float64(), nullable=True),
    pa.field("rqd_length_cm", pa.float64(), nullable=True),
    pa.field("rqd_percent", pa.float64(), nullable=True),
    pa.field("return_water_colour", pa.string(), nullable=True),
    pa.field("water_loss", pa.string(), nullable=True),
    pa.field("borehole_diameter", pa.float64(), nullable=True),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("status", pa.string(), nullable=False),
    pa.field("approved_by", pa.string(), nullable=True),
    pa.field("approved_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=False),
])

SCHEMA_BORELOG_SUBMISSIONS = pa.schema([
    pa.field("submission_id", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("structure_id", pa.string(), nullable=False),
    pa.field("borehole_id", pa.string(), nullable=False),
    pa.field("version_number", pa.int32(), nullable=False),
    pa.field("edited_by", pa.string(), nullable=False),
    pa.field("timestamp", pa.timestamp("ms"), nullable=True),
    pa.field("form_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("status", pa.string(), nullable=False),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
])

SCHEMA_BORELOG_ASSIGNMENTS = pa.schema([
    pa.field("assignment_id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=True),
    pa.field("structure_id", pa.string(), nullable=True),
    pa.field("substructure_id", pa.string(), nullable=True),
    pa.field("assigned_site_engineer", pa.string(), nullable=False),
    pa.field("assigned_by", pa.string(), nullable=False),
    pa.field("assigned_at", pa.timestamp("ms"), nullable=True),
    pa.field("status", pa.string(), nullable=False),
    pa.field("notes", pa.string(), nullable=True),
    pa.field("expected_completion_date", pa.timestamp("ms"), nullable=True),
    pa.field("completed_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_BORELOG_IMAGES = pa.schema([
    pa.field("image_id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("image_url", pa.string(), nullable=False),
    pa.field("uploaded_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_BORELOG_REVIEW_COMMENTS = pa.schema([
    pa.field("comment_id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("version_no", pa.int32(), nullable=False),
    pa.field("comment_type", pa.string(), nullable=False),
    pa.field("comment_text", pa.string(), nullable=False),
    pa.field("commented_by", pa.string(), nullable=False),
    pa.field("commented_at", pa.timestamp("ms"), nullable=True),
    pa.field("resolved", pa.bool_(), nullable=True),
    pa.field("resolved_at", pa.timestamp("ms"), nullable=True),
    pa.field("resolved_by", pa.string(), nullable=True),
])

# ============================================================================
# Stratum Tables (Append-Only, High Volume)
# ============================================================================

SCHEMA_STRATUM_LAYERS = pa.schema([
    pa.field("id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("version_no", pa.int32(), nullable=False),
    pa.field("layer_order", pa.int32(), nullable=False),
    pa.field("description", pa.string(), nullable=True),
    pa.field("depth_from_m", pa.float64(), nullable=True),
    pa.field("depth_to_m", pa.float64(), nullable=True),
    pa.field("thickness_m", pa.float64(), nullable=True),
    pa.field("return_water_colour", pa.string(), nullable=True),
    pa.field("water_loss", pa.string(), nullable=True),
    pa.field("borehole_diameter", pa.float64(), nullable=True),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
])

SCHEMA_STRATUM_SAMPLE_POINTS = pa.schema([
    pa.field("id", pa.string(), nullable=False),
    pa.field("stratum_layer_id", pa.string(), nullable=False),
    pa.field("sample_order", pa.int32(), nullable=False),
    pa.field("sample_type", pa.string(), nullable=True),
    pa.field("depth_mode", pa.string(), nullable=True),
    pa.field("depth_single_m", pa.float64(), nullable=True),
    pa.field("depth_from_m", pa.float64(), nullable=True),
    pa.field("depth_to_m", pa.float64(), nullable=True),
    pa.field("run_length_m", pa.float64(), nullable=True),
    pa.field("spt_15cm_1", pa.int32(), nullable=True),
    pa.field("spt_15cm_2", pa.int32(), nullable=True),
    pa.field("spt_15cm_3", pa.int32(), nullable=True),
    pa.field("n_value", pa.int32(), nullable=True),
    pa.field("total_core_length_cm", pa.float64(), nullable=True),
    pa.field("tcr_percent", pa.float64(), nullable=True),
    pa.field("rqd_length_cm", pa.float64(), nullable=True),
    pa.field("rqd_percent", pa.float64(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
])

# ============================================================================
# Lab Report Tables
# ============================================================================

SCHEMA_LAB_TEST_ASSIGNMENTS = pa.schema([
    pa.field("assignment_id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("version_no", pa.int32(), nullable=False),
    pa.field("sample_ids", pa.list_(pa.string()), nullable=False),  # TEXT[] array
    pa.field("assigned_by", pa.string(), nullable=False),
    pa.field("assigned_to", pa.string(), nullable=False),
    pa.field("assigned_at", pa.timestamp("ms"), nullable=True),
    pa.field("due_date", pa.timestamp("ms"), nullable=True),
    pa.field("priority", pa.string(), nullable=True),
    pa.field("notes", pa.string(), nullable=True),
])

SCHEMA_UNIFIED_LAB_REPORTS = pa.schema([
    pa.field("report_id", pa.string(), nullable=False),
    pa.field("assignment_id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("sample_id", pa.string(), nullable=False),
    pa.field("project_name", pa.string(), nullable=False),
    pa.field("borehole_no", pa.string(), nullable=False),
    pa.field("client", pa.string(), nullable=True),
    pa.field("test_date", pa.timestamp("ms"), nullable=False),
    pa.field("tested_by", pa.string(), nullable=False),
    pa.field("checked_by", pa.string(), nullable=False),
    pa.field("approved_by", pa.string(), nullable=False),
    pa.field("test_types", pa.string(), nullable=False),  # JSONB as string
    pa.field("soil_test_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("rock_test_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("status", pa.string(), nullable=False),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("submitted_at", pa.timestamp("ms"), nullable=True),
    pa.field("approved_at", pa.timestamp("ms"), nullable=True),
    pa.field("rejected_at", pa.timestamp("ms"), nullable=True),
    pa.field("rejection_reason", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=False),
    pa.field("updated_at", pa.timestamp("ms"), nullable=False),
    pa.field("created_by_user_id", pa.string(), nullable=True),
])

SCHEMA_LAB_REPORT_VERSIONS = pa.schema([
    pa.field("version_id", pa.string(), nullable=False),
    pa.field("report_id", pa.string(), nullable=False),
    pa.field("version_no", pa.int32(), nullable=False),
    pa.field("assignment_id", pa.string(), nullable=True),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("sample_id", pa.string(), nullable=False),
    pa.field("project_name", pa.string(), nullable=False),
    pa.field("borehole_no", pa.string(), nullable=False),
    pa.field("client", pa.string(), nullable=True),
    pa.field("test_date", pa.timestamp("ms"), nullable=False),
    pa.field("tested_by", pa.string(), nullable=False),
    pa.field("checked_by", pa.string(), nullable=False),
    pa.field("approved_by", pa.string(), nullable=False),
    pa.field("test_types", pa.string(), nullable=False),  # JSONB as string
    pa.field("soil_test_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("rock_test_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("status", pa.string(), nullable=False),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("submitted_at", pa.timestamp("ms"), nullable=True),
    pa.field("approved_at", pa.timestamp("ms"), nullable=True),
    pa.field("rejected_at", pa.timestamp("ms"), nullable=True),
    pa.field("returned_at", pa.timestamp("ms"), nullable=True),
    pa.field("rejection_reason", pa.string(), nullable=True),
    pa.field("review_comments", pa.string(), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=False),
    pa.field("created_at", pa.timestamp("ms"), nullable=False),
])

SCHEMA_LAB_REPORT_COMMENTS = pa.schema([
    pa.field("comment_id", pa.string(), nullable=False),
    pa.field("report_id", pa.string(), nullable=False),
    pa.field("version_no", pa.int32(), nullable=False),
    pa.field("comment_type", pa.string(), nullable=False),
    pa.field("comment_text", pa.string(), nullable=False),
    pa.field("commented_by_user_id", pa.string(), nullable=False),
    pa.field("commented_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_SOIL_TEST_SAMPLES = pa.schema([
    pa.field("sample_id", pa.string(), nullable=False),
    pa.field("report_id", pa.string(), nullable=False),
    pa.field("layer_no", pa.int32(), nullable=True),
    pa.field("sample_no", pa.string(), nullable=True),
    pa.field("depth_from", pa.float64(), nullable=True),
    pa.field("depth_to", pa.float64(), nullable=True),
    pa.field("natural_moisture_content", pa.float64(), nullable=True),
    pa.field("bulk_density", pa.float64(), nullable=True),
    pa.field("dry_density", pa.float64(), nullable=True),
    pa.field("specific_gravity", pa.float64(), nullable=True),
    pa.field("void_ratio", pa.float64(), nullable=True),
    pa.field("porosity", pa.float64(), nullable=True),
    pa.field("degree_of_saturation", pa.float64(), nullable=True),
    pa.field("liquid_limit", pa.float64(), nullable=True),
    pa.field("plastic_limit", pa.float64(), nullable=True),
    pa.field("plasticity_index", pa.float64(), nullable=True),
    pa.field("shrinkage_limit", pa.float64(), nullable=True),
    pa.field("gravel_percentage", pa.float64(), nullable=True),
    pa.field("sand_percentage", pa.float64(), nullable=True),
    pa.field("silt_percentage", pa.float64(), nullable=True),
    pa.field("clay_percentage", pa.float64(), nullable=True),
    pa.field("cohesion", pa.float64(), nullable=True),
    pa.field("angle_of_internal_friction", pa.float64(), nullable=True),
    pa.field("unconfined_compressive_strength", pa.float64(), nullable=True),
    pa.field("compression_index", pa.float64(), nullable=True),
    pa.field("recompression_index", pa.float64(), nullable=True),
    pa.field("preconsolidation_pressure", pa.float64(), nullable=True),
    pa.field("permeability_coefficient", pa.float64(), nullable=True),
    pa.field("cbr_value", pa.float64(), nullable=True),
    pa.field("soil_classification", pa.string(), nullable=True),
    pa.field("soil_description", pa.string(), nullable=True),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_ROCK_TEST_SAMPLES = pa.schema([
    pa.field("sample_id", pa.string(), nullable=False),
    pa.field("report_id", pa.string(), nullable=False),
    pa.field("layer_no", pa.int32(), nullable=True),
    pa.field("sample_no", pa.string(), nullable=True),
    pa.field("depth_from", pa.float64(), nullable=True),
    pa.field("depth_to", pa.float64(), nullable=True),
    pa.field("natural_moisture_content", pa.float64(), nullable=True),
    pa.field("bulk_density", pa.float64(), nullable=True),
    pa.field("dry_density", pa.float64(), nullable=True),
    pa.field("specific_gravity", pa.float64(), nullable=True),
    pa.field("porosity", pa.float64(), nullable=True),
    pa.field("water_absorption", pa.float64(), nullable=True),
    pa.field("unconfined_compressive_strength", pa.float64(), nullable=True),
    pa.field("point_load_strength_index", pa.float64(), nullable=True),
    pa.field("tensile_strength", pa.float64(), nullable=True),
    pa.field("shear_strength", pa.float64(), nullable=True),
    pa.field("youngs_modulus", pa.float64(), nullable=True),
    pa.field("poissons_ratio", pa.float64(), nullable=True),
    pa.field("slake_durability_index", pa.float64(), nullable=True),
    pa.field("soundness_loss", pa.float64(), nullable=True),
    pa.field("los_angeles_abrasion_value", pa.float64(), nullable=True),
    pa.field("rock_classification", pa.string(), nullable=True),
    pa.field("rock_description", pa.string(), nullable=True),
    pa.field("rock_quality_designation", pa.float64(), nullable=True),
    pa.field("remarks", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_by_user_id", pa.string(), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

SCHEMA_FINAL_LAB_REPORTS = pa.schema([
    pa.field("final_report_id", pa.string(), nullable=False),
    pa.field("original_report_id", pa.string(), nullable=False),
    pa.field("assignment_id", pa.string(), nullable=True),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("sample_id", pa.string(), nullable=False),
    pa.field("project_name", pa.string(), nullable=False),
    pa.field("borehole_no", pa.string(), nullable=False),
    pa.field("client", pa.string(), nullable=True),
    pa.field("test_date", pa.timestamp("ms"), nullable=False),
    pa.field("tested_by", pa.string(), nullable=False),
    pa.field("checked_by", pa.string(), nullable=False),
    pa.field("approved_by", pa.string(), nullable=False),
    pa.field("test_types", pa.string(), nullable=False),  # JSONB as string
    pa.field("soil_test_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("rock_test_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("final_version_no", pa.int32(), nullable=False),
    pa.field("approval_date", pa.timestamp("ms"), nullable=False),
    pa.field("approved_by_user_id", pa.string(), nullable=False),
    pa.field("customer_notes", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
])

# ============================================================================
# Workflow Tables
# ============================================================================

SCHEMA_PENDING_CSV_UPLOADS = pa.schema([
    pa.field("upload_id", pa.string(), nullable=False),
    pa.field("project_id", pa.string(), nullable=False),
    pa.field("structure_id", pa.string(), nullable=False),
    pa.field("substructure_id", pa.string(), nullable=False),
    pa.field("uploaded_by", pa.string(), nullable=False),
    pa.field("uploaded_at", pa.timestamp("ms"), nullable=True),
    pa.field("file_name", pa.string(), nullable=True),
    pa.field("file_type", pa.string(), nullable=True),
    pa.field("total_records", pa.int32(), nullable=False),
    pa.field("borelog_header_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("stratum_rows_data", pa.string(), nullable=False),  # JSONB as string
    pa.field("status", pa.string(), nullable=False),
    pa.field("submitted_for_approval_at", pa.timestamp("ms"), nullable=True),
    pa.field("approved_by", pa.string(), nullable=True),
    pa.field("approved_at", pa.timestamp("ms"), nullable=True),
    pa.field("rejected_by", pa.string(), nullable=True),
    pa.field("rejected_at", pa.timestamp("ms"), nullable=True),
    pa.field("returned_by", pa.string(), nullable=True),
    pa.field("returned_at", pa.timestamp("ms"), nullable=True),
    pa.field("approval_comments", pa.string(), nullable=True),
    pa.field("rejection_reason", pa.string(), nullable=True),
    pa.field("revision_notes", pa.string(), nullable=True),
    pa.field("processed_at", pa.timestamp("ms"), nullable=True),
    pa.field("created_borelog_id", pa.string(), nullable=True),
    pa.field("error_message", pa.string(), nullable=True),
])

SCHEMA_SUBSTRUCTURE_ASSIGNMENTS = pa.schema([
    pa.field("assignment_id", pa.string(), nullable=False),
    pa.field("borelog_id", pa.string(), nullable=False),
    pa.field("substructure_id", pa.string(), nullable=False),
    pa.field("created_at", pa.timestamp("ms"), nullable=True),
    pa.field("updated_at", pa.timestamp("ms"), nullable=True),
])

# ============================================================================
# Register all schemas
# ============================================================================

def register_all_schemas():
    """Register all schemas in the registry."""
    schemas = {
        "customers": SCHEMA_CUSTOMERS,
        "organisations": SCHEMA_ORGANISATIONS,
        "users": SCHEMA_USERS,
        "contacts": SCHEMA_CONTACTS,
        "projects": SCHEMA_PROJECTS,
        "user_project_assignments": SCHEMA_USER_PROJECT_ASSIGNMENTS,
        "structure": SCHEMA_STRUCTURE,
        "structure_areas": SCHEMA_STRUCTURE_AREAS,
        "sub_structures": SCHEMA_SUB_STRUCTURES,
        "borehole": SCHEMA_BOREHOLE,
        "boreloge": SCHEMA_BORELOGE,
        "borelog_details": SCHEMA_BORELOG_DETAILS,
        "borelog_versions": SCHEMA_BORELOG_VERSIONS,
        "borelog_submissions": SCHEMA_BORELOG_SUBMISSIONS,
        "borelog_assignments": SCHEMA_BORELOG_ASSIGNMENTS,
        "borelog_images": SCHEMA_BORELOG_IMAGES,
        "borelog_review_comments": SCHEMA_BORELOG_REVIEW_COMMENTS,
        "stratum_layers": SCHEMA_STRATUM_LAYERS,
        "stratum_sample_points": SCHEMA_STRATUM_SAMPLE_POINTS,
        "lab_test_assignments": SCHEMA_LAB_TEST_ASSIGNMENTS,
        "unified_lab_reports": SCHEMA_UNIFIED_LAB_REPORTS,
        "lab_report_versions": SCHEMA_LAB_REPORT_VERSIONS,
        "lab_report_comments": SCHEMA_LAB_REPORT_COMMENTS,
        "soil_test_samples": SCHEMA_SOIL_TEST_SAMPLES,
        "rock_test_samples": SCHEMA_ROCK_TEST_SAMPLES,
        "final_lab_reports": SCHEMA_FINAL_LAB_REPORTS,
        "pending_csv_uploads": SCHEMA_PENDING_CSV_UPLOADS,
        "substructure_assignments": SCHEMA_SUBSTRUCTURE_ASSIGNMENTS,
    }
    
    for table_name, schema in schemas.items():
        SchemaRegistry.register(table_name, schema)


# Initialize schemas on import
register_all_schemas()


def get_schema(table_name: str) -> Optional[pa.Schema]:
    """
    Get schema for a table by name.
    
    Args:
        table_name: Name of the table
        
    Returns:
        PyArrow schema or None if not found
    """
    return SchemaRegistry.get(table_name)












