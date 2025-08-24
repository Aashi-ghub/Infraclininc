import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { validate as validateUUID } from 'uuid';
import { getAssignedBorelogsForSiteEngineer } from '../utils/projectAccess';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = await validateToken(authHeader!);
    if (!payload) {
      const response = createResponse(401, {
        success: false,
        message: 'Unauthorized: Invalid token',
        error: 'Invalid token'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const projectId = event.pathParameters?.project_id;
    if (!projectId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing project_id parameter',
        error: 'project_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(projectId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid project_id format',
        error: 'project_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // For Site Engineers, get their assigned borelog IDs for this project
    let assignedBorelogIds: string[] = [];
    if (payload.role === 'Site Engineer') {
      const allAssignedBorelogIds = await getAssignedBorelogsForSiteEngineer(payload.userId);
      
      if (allAssignedBorelogIds.length > 0) {
        // Get borelog IDs that belong to this specific project
        const projectBorelogQuery = `
          SELECT borelog_id FROM boreloge 
          WHERE project_id = $1 AND borelog_id = ANY($2)
        `;
        const projectBorelogs = await db.query(projectBorelogQuery, [projectId, allAssignedBorelogIds]);
        assignedBorelogIds = projectBorelogs.map((row: any) => row.borelog_id);
      }
    }

    // Build the query based on user role
    let query: string;
    let queryParams: any[];

    if (payload.role === 'Site Engineer' && assignedBorelogIds.length > 0) {
      // Site Engineer with assignments - only show assigned borelogs for this project
      query = `
        WITH latest_versions AS (
          SELECT 
            borelog_id,
            MAX(version_no) as latest_version_no
          FROM borelog_details
          GROUP BY borelog_id
        )
        SELECT 
          b.borelog_id,
          b.substructure_id,
          b.project_id,
          b.type as borelog_type,
          b.created_at as borelog_created_at,
          b.created_by_user_id as borelog_created_by,
          ss.type as substructure_type,
          ss.remark as substructure_remark,
          s.structure_id,
          s.type as structure_type,
          s.description as structure_description,
          p.name as project_name,
          p.location as project_location,
          bd.version_no,
          bd.number,
          bd.msl,
          bd.boring_method,
          bd.hole_diameter,
          bd.commencement_date,
          bd.completion_date,
          bd.standing_water_level,
          bd.termination_depth,
          bd.coordinate,
          bd.permeability_test_count,
          bd.spt_vs_test_count,
          bd.undisturbed_sample_count,
          bd.disturbed_sample_count,
          bd.water_sample_count,
          bd.stratum_description,
          bd.stratum_depth_from,
          bd.stratum_depth_to,
          bd.stratum_thickness_m,
          bd.sample_event_type,
          bd.sample_event_depth_m,
          bd.run_length_m,
          bd.spt_blows_per_15cm,
          bd.n_value_is_2131,
          bd.total_core_length_cm,
          bd.tcr_percent,
          bd.rqd_length_cm,
          bd.rqd_percent,
          bd.return_water_colour,
          bd.water_loss,
          bd.borehole_diameter,
          bd.remarks,
          bd.images,
          bd.created_at as details_created_at,
          COALESCE(bd.created_by_user_id, b.created_by_user_id) as details_created_by,
          u.name as created_by_name,
          u.email as created_by_email,
          ba.assignment_id,
          ba.assigned_site_engineer,
          ba.status as assignment_status,
          assigned_user.name as assigned_site_engineer_name,
          assigned_user.email as assigned_site_engineer_email
        FROM boreloge b
        JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
        JOIN structure s ON ss.structure_id = s.structure_id
        JOIN projects p ON b.project_id = p.project_id
        JOIN latest_versions lv ON b.borelog_id = lv.borelog_id
        JOIN borelog_details bd ON b.borelog_id = bd.borelog_id AND bd.version_no = lv.latest_version_no
        LEFT JOIN users u ON COALESCE(bd.created_by_user_id, b.created_by_user_id) = u.user_id
        LEFT JOIN borelog_assignments ba ON b.borelog_id = ba.borelog_id AND ba.status = 'active'
        LEFT JOIN users assigned_user ON ba.assigned_site_engineer = assigned_user.user_id
        WHERE b.project_id = $1 AND b.borelog_id = ANY($2)
        ORDER BY s.type, ss.type, b.created_at DESC
      `;
      queryParams = [projectId, assignedBorelogIds];
    } else if (payload.role === 'Site Engineer' && assignedBorelogIds.length === 0) {
      // Site Engineer with no assignments for this project - return empty result
      const response = createResponse(200, {
        success: true,
        message: 'No assigned borelogs found for this project',
        data: []
      });
      logResponse(response, Date.now() - startTime);
      return response;
    } else {
      // Other roles - show all borelogs for the project
      query = `
        WITH latest_versions AS (
          SELECT 
            borelog_id,
            MAX(version_no) as latest_version_no
          FROM borelog_details
          GROUP BY borelog_id
        )
        SELECT 
          b.borelog_id,
          b.substructure_id,
          b.project_id,
          b.type as borelog_type,
          b.created_at as borelog_created_at,
          b.created_by_user_id as borelog_created_by,
          ss.type as substructure_type,
          ss.remark as substructure_remark,
          s.structure_id,
          s.type as structure_type,
          s.description as structure_description,
          p.name as project_name,
          p.location as project_location,
          bd.version_no,
          bd.number,
          bd.msl,
          bd.boring_method,
          bd.hole_diameter,
          bd.commencement_date,
          bd.completion_date,
          bd.standing_water_level,
          bd.termination_depth,
          bd.coordinate,
          bd.permeability_test_count,
          bd.spt_vs_test_count,
          bd.undisturbed_sample_count,
          bd.disturbed_sample_count,
          bd.water_sample_count,
          bd.stratum_description,
          bd.stratum_depth_from,
          bd.stratum_depth_to,
          bd.stratum_thickness_m,
          bd.sample_event_type,
          bd.sample_event_depth_m,
          bd.run_length_m,
          bd.spt_blows_per_15cm,
          bd.n_value_is_2131,
          bd.total_core_length_cm,
          bd.tcr_percent,
          bd.rqd_length_cm,
          bd.rqd_percent,
          bd.return_water_colour,
          bd.water_loss,
          bd.borehole_diameter,
          bd.remarks,
          bd.images,
          bd.created_at as details_created_at,
          COALESCE(bd.created_by_user_id, b.created_by_user_id) as details_created_by,
          u.name as created_by_name,
          u.email as created_by_email,
          ba.assignment_id,
          ba.assigned_site_engineer,
          ba.status as assignment_status,
          assigned_user.name as assigned_site_engineer_name,
          assigned_user.email as assigned_site_engineer_email
        FROM boreloge b
        JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
        JOIN structure s ON ss.structure_id = s.structure_id
        JOIN projects p ON b.project_id = p.project_id
        JOIN latest_versions lv ON b.borelog_id = lv.borelog_id
        JOIN borelog_details bd ON b.borelog_id = bd.borelog_id AND bd.version_no = lv.latest_version_no
        LEFT JOIN users u ON COALESCE(bd.created_by_user_id, b.created_by_user_id) = u.user_id
        LEFT JOIN borelog_assignments ba ON b.borelog_id = ba.borelog_id AND ba.status = 'active'
        LEFT JOIN users assigned_user ON ba.assigned_site_engineer = assigned_user.user_id
        WHERE b.project_id = $1
        ORDER BY s.type, ss.type, b.created_at DESC
      `;
      queryParams = [projectId];
    }

    const borelogs = await db.query(query, queryParams);

    const response = createResponse(200, {
      success: true,
      message: 'Borelogs retrieved successfully',
      data: {
        borelogs: borelogs
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelogs by project:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelogs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 
