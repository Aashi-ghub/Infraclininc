import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { validate as validateUUID } from 'uuid';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError) {
      return authError;
    }

    // Get user info from token
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const payload = validateToken(authHeader!);
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

    // Check project access for Site Engineers
    if (payload.role === 'Site Engineer') {
      const projectAccessQuery = `
        SELECT 1 FROM user_project_assignments 
        WHERE project_id = $1 AND $2 = ANY(assignee)
      `;
      const projectAccess = await db.query(projectAccessQuery, [projectId, payload.userId]);
      
      if (projectAccess.length === 0) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: User not assigned to this project',
          error: 'Insufficient permissions'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Get all borelogs with their latest details for the project
    const query = `
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
        u.email as created_by_email
      FROM boreloge b
      JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
      JOIN structure s ON ss.structure_id = s.structure_id
      JOIN projects p ON b.project_id = p.project_id
      JOIN latest_versions lv ON b.borelog_id = lv.borelog_id
      JOIN borelog_details bd ON b.borelog_id = bd.borelog_id AND bd.version_no = lv.latest_version_no
      LEFT JOIN users u ON COALESCE(bd.created_by_user_id, b.created_by_user_id) = u.user_id
      WHERE b.project_id = $1
      ORDER BY s.type, ss.type, b.created_at DESC
    `;

    const borelogs = await db.query(query, [projectId]);

    // Group borelogs by structure and substructure
    const groupedBorelogs = borelogs.reduce((acc, borelog) => {
      const structureKey = `${borelog.structure_id}-${borelog.substructure_id}`;
      
      if (!acc[structureKey]) {
        acc[structureKey] = {
          structure: {
            structure_id: borelog.structure_id,
            type: borelog.structure_type,
            description: borelog.structure_description
          },
          substructure: {
            substructure_id: borelog.substructure_id,
            type: borelog.substructure_type,
            remark: borelog.substructure_remark
          },
          borelogs: []
        };
      }

      acc[structureKey].borelogs.push({
        borelog_id: borelog.borelog_id,
        type: borelog.borelog_type,
        version_no: borelog.version_no,
        created_at: borelog.borelog_created_at,
        created_by: {
          user_id: borelog.borelog_created_by,
          name: borelog.created_by_name,
          email: borelog.created_by_email
        },
        details: {
          number: borelog.number,
          msl: borelog.msl,
          boring_method: borelog.boring_method,
          hole_diameter: borelog.hole_diameter,
          commencement_date: borelog.commencement_date,
          completion_date: borelog.completion_date,
          standing_water_level: borelog.standing_water_level,
          termination_depth: borelog.termination_depth,
          coordinate: borelog.coordinate,
          permeability_test_count: borelog.permeability_test_count,
          spt_vs_test_count: borelog.spt_vs_test_count,
          undisturbed_sample_count: borelog.undisturbed_sample_count,
          disturbed_sample_count: borelog.disturbed_sample_count,
          water_sample_count: borelog.water_sample_count,
          stratum_description: borelog.stratum_description,
          stratum_depth_from: borelog.stratum_depth_from,
          stratum_depth_to: borelog.stratum_depth_to,
          stratum_thickness_m: borelog.stratum_thickness_m,
          sample_event_type: borelog.sample_event_type,
          sample_event_depth_m: borelog.sample_event_depth_m,
          run_length_m: borelog.run_length_m,
          spt_blows_per_15cm: borelog.spt_blows_per_15cm,
          n_value_is_2131: borelog.n_value_is_2131,
          total_core_length_cm: borelog.total_core_length_cm,
          tcr_percent: borelog.tcr_percent,
          rqd_length_cm: borelog.rqd_length_cm,
          rqd_percent: borelog.rqd_percent,
          return_water_colour: borelog.return_water_colour,
          water_loss: borelog.water_loss,
          borehole_diameter: borelog.borehole_diameter,
          remarks: borelog.remarks,
          images: borelog.images,
          details_created_at: borelog.details_created_at
        }
      });

      return acc;
    }, {} as Record<string, any>);

    const response = createResponse(200, {
      success: true,
      message: 'Borelogs retrieved successfully',
      data: {
        project: {
          project_id: projectId,
          name: borelogs[0]?.project_name || '',
          location: borelogs[0]?.project_location || ''
        },
        borelogs: Object.values(groupedBorelogs)
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelogs:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelogs'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 