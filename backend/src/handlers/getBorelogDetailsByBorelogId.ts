import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { validate as validateUUID } from 'uuid';
import { checkBorelogAssignment } from '../utils/projectAccess';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer'])(event);
    if (authError !== null) {
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

    const borelogId = event.pathParameters?.borelog_id;
    if (!borelogId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing borelog_id parameter',
        error: 'borelog_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(borelogId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid borelog_id format',
        error: 'borelog_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // For Site Engineers, check if they are assigned to this borelog
    if (payload.role === 'Site Engineer') {
      const isAssigned = await checkBorelogAssignment(payload.userId, borelogId);
      
      if (!isAssigned) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: Borelog not assigned to you',
          error: 'You can only access borelog details for borelogs that are assigned to you'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Get borelog details with version history
    const query = `
      SELECT 
        bd.*,
        b.substructure_id,
        b.project_id,
        b.type as borelog_type,
        b.created_at as borelog_created_at,
        ss.type as substructure_type,
        ss.remark as substructure_remark,
        s.type as structure_type,
        s.description as structure_description,
        p.name as project_name,
        p.location as project_location,
        u.name as created_by_name,
        u.email as created_by_email
      FROM borelog_details bd
      JOIN boreloge b ON bd.borelog_id = b.borelog_id
      JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
      JOIN structure s ON ss.structure_id = s.structure_id
      JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN users u ON bd.created_by_user_id = u.user_id
      WHERE bd.borelog_id = $1
      ORDER BY bd.version_no DESC
    `;

    const borelogDetails = await db.query(query, [borelogId]);

    if (borelogDetails.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'No borelog details found for the specified borelog_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Group by version for better organization
    const versionHistory = borelogDetails.map(detail => ({
      version_no: detail.version_no,
      created_at: detail.created_at,
      created_by: {
        user_id: detail.created_by_user_id,
        name: detail.created_by_name,
        email: detail.created_by_email
      },
      details: {
        number: detail.number,
        msl: detail.msl,
        boring_method: detail.boring_method,
        hole_diameter: detail.hole_diameter,
        commencement_date: detail.commencement_date,
        completion_date: detail.completion_date,
        standing_water_level: detail.standing_water_level,
        termination_depth: detail.termination_depth,
        coordinate: detail.coordinate,
        permeability_test_count: detail.permeability_test_count,
        spt_vs_test_count: detail.spt_vs_test_count,
        undisturbed_sample_count: detail.undisturbed_sample_count,
        disturbed_sample_count: detail.disturbed_sample_count,
        water_sample_count: detail.water_sample_count,
        stratum_description: detail.stratum_description,
        stratum_depth_from: detail.stratum_depth_from,
        stratum_depth_to: detail.stratum_depth_to,
        stratum_thickness_m: detail.stratum_thickness_m,
        sample_event_type: detail.sample_event_type,
        sample_event_depth_m: detail.sample_event_depth_m,
        run_length_m: detail.run_length_m,
        spt_blows_per_15cm: detail.spt_blows_per_15cm,
        n_value_is_2131: detail.n_value_is_2131,
        total_core_length_cm: detail.total_core_length_cm,
        tcr_percent: detail.tcr_percent,
        rqd_length_cm: detail.rqd_length_cm,
        rqd_percent: detail.rqd_percent,
        return_water_colour: detail.return_water_colour,
        water_loss: detail.water_loss,
        borehole_diameter: detail.borehole_diameter,
        remarks: detail.remarks,
        images: detail.images,
        substructure_id: detail.substructure_id,
        project_id: detail.project_id
      }
    }));

    const response = createResponse(200, {
      success: true,
      message: 'Borelog details retrieved successfully',
      data: {
        borelog_id: borelogId,
        borelog_type: borelogDetails[0].borelog_type,
        project: {
          project_id: borelogDetails[0].project_id,
          name: borelogDetails[0].project_name,
          location: borelogDetails[0].project_location
        },
        structure: {
          structure_type: borelogDetails[0].structure_type,
          description: borelogDetails[0].structure_description,
          substructure_id: borelogDetails[0].substructure_id,
          substructure_type: borelogDetails[0].substructure_type,
          substructure_remark: borelogDetails[0].substructure_remark
        },
        version_history: versionHistory,
        latest_version: versionHistory[0] // First item is the latest due to DESC ordering
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelog details:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog details'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
}; 