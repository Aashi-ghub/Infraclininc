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

    const substructureId = event.pathParameters?.substructure_id;
    if (!substructureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing substructure_id parameter',
        error: 'substructure_id is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!validateUUID(substructureId)) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid substructure_id format',
        error: 'substructure_id must be a valid UUID'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get borelog by substructure_id with latest details (combine final and staging)
    const query = `
      WITH combined AS (
        SELECT borelog_id, version_no, created_at FROM borelog_details
        UNION ALL
        SELECT borelog_id, version_no, created_at FROM borelog_versions
      ), latest_versions AS (
        SELECT borelog_id, MAX(version_no) AS latest_version_no
        FROM combined
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
        -- Borehole data
        bh.tunnel_no,
        bh.location as borehole_location,
        bh.chainage,
        bh.borehole_number,
        bh.msl as borehole_msl,
        ST_AsGeoJSON(bh.coordinate) as borehole_coordinate,
        bh.boring_method as borehole_boring_method,
        bh.hole_diameter as borehole_hole_diameter,
        bh.description as borehole_description,
        bh.coordinates as borehole_coordinates_json,
        -- Borelog details data (prefer final, fallback to staging)
        COALESCE(bd.version_no, bv.version_no) AS version_no,
        COALESCE(bd.number, bv.number) AS number,
        COALESCE(bd.msl, bv.msl) AS msl,
        COALESCE(bd.boring_method, bv.boring_method) AS boring_method,
        COALESCE(bd.hole_diameter, bv.hole_diameter) AS hole_diameter,
        COALESCE(bd.commencement_date, bv.commencement_date) AS commencement_date,
        COALESCE(bd.completion_date, bv.completion_date) AS completion_date,
        COALESCE(bd.standing_water_level, bv.standing_water_level) AS standing_water_level,
        COALESCE(bd.termination_depth, bv.termination_depth) AS termination_depth,
        COALESCE(ST_AsGeoJSON(bd.coordinate), ST_AsGeoJSON(bv.coordinate)) AS coordinate,
        COALESCE(bd.permeability_test_count, bv.permeability_test_count) AS permeability_test_count,
        COALESCE(bd.spt_vs_test_count, bv.spt_vs_test_count) AS spt_vs_test_count,
        COALESCE(bd.undisturbed_sample_count, bv.undisturbed_sample_count) AS undisturbed_sample_count,
        COALESCE(bd.disturbed_sample_count, bv.disturbed_sample_count) AS disturbed_sample_count,
        COALESCE(bd.water_sample_count, bv.water_sample_count) AS water_sample_count,
        COALESCE(bd.stratum_description, bv.stratum_description) AS stratum_description,
        COALESCE(bd.stratum_depth_from, bv.stratum_depth_from) AS stratum_depth_from,
        COALESCE(bd.stratum_depth_to, bv.stratum_depth_to) AS stratum_depth_to,
        COALESCE(bd.stratum_thickness_m, bv.stratum_thickness_m) AS stratum_thickness_m,
        COALESCE(bd.sample_event_type, bv.sample_event_type) AS sample_event_type,
        COALESCE(bd.sample_event_depth_m, bv.sample_event_depth_m) AS sample_event_depth_m,
        COALESCE(bd.run_length_m, bv.run_length_m) AS run_length_m,
        COALESCE(bd.spt_blows_per_15cm, bv.spt_blows_per_15cm) AS spt_blows_per_15cm,
        COALESCE(bd.n_value_is_2131, bv.n_value_is_2131) AS n_value_is_2131,
        COALESCE(bd.total_core_length_cm, bv.total_core_length_cm) AS total_core_length_cm,
        COALESCE(bd.tcr_percent, bv.tcr_percent) AS tcr_percent,
        COALESCE(bd.rqd_length_cm, bv.rqd_length_cm) AS rqd_length_cm,
        COALESCE(bd.rqd_percent, bv.rqd_percent) AS rqd_percent,
        COALESCE(bd.return_water_colour, bv.return_water_colour) AS return_water_colour,
        COALESCE(bd.water_loss, bv.water_loss) AS water_loss,
        COALESCE(bd.borehole_diameter, bv.borehole_diameter) AS borehole_diameter,
        COALESCE(bd.remarks, bv.remarks) AS remarks,
        COALESCE(bd.images, NULL) AS images,
        COALESCE(bd.created_at, bv.created_at) as details_created_at,
        COALESCE(bd.created_by_user_id, bv.created_by_user_id, b.created_by_user_id) as details_created_by,
        u.name as created_by_name,
        u.email as created_by_email
      FROM boreloge b
      JOIN sub_structures ss ON b.substructure_id = ss.substructure_id
      JOIN structure s ON ss.structure_id = s.structure_id
      JOIN projects p ON b.project_id = p.project_id
      LEFT JOIN borehole bh ON bh.substructure_id = b.substructure_id
      LEFT JOIN latest_versions lv ON b.borelog_id = lv.borelog_id
      LEFT JOIN borelog_details bd ON b.borelog_id = bd.borelog_id AND bd.version_no = lv.latest_version_no
      LEFT JOIN borelog_versions bv ON b.borelog_id = bv.borelog_id AND bv.version_no = lv.latest_version_no
      LEFT JOIN users u ON COALESCE(bd.created_by_user_id, bv.created_by_user_id, b.created_by_user_id) = u.user_id
      WHERE b.substructure_id = $1
    `;

    const borelog = await db.query(query, [substructureId]);

    if (borelog.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'No borelog found for the specified substructure_id'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Check project access for Site Engineers
    if (payload.role === 'Site Engineer') {
      const projectId = borelog[0].project_id;
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

    // Get version history for this borelog (merge final and staging)
    const versionHistoryQuery = `
      SELECT 
        v.version_no,
        v.created_at,
        v.created_by_user_id,
        u.name as created_by_name,
        u.email as created_by_email,
        v.number,
        v.msl,
        v.boring_method,
        v.hole_diameter,
        v.commencement_date,
        v.completion_date,
        v.standing_water_level,
        v.termination_depth,
        ST_AsGeoJSON(v.coordinate) AS coordinate,
        v.permeability_test_count,
        v.spt_vs_test_count,
        v.undisturbed_sample_count,
        v.disturbed_sample_count,
        v.water_sample_count,
        v.job_code,
        v.location,
        v.chainage_km,
        v.stratum_description,
        v.stratum_depth_from,
        v.stratum_depth_to,
        v.stratum_thickness_m,
        v.sample_event_type,
        v.sample_event_depth_m,
        v.run_length_m,
        v.spt_blows_per_15cm,
        v.n_value_is_2131,
        v.total_core_length_cm,
        v.tcr_percent,
        v.rqd_length_cm,
        v.rqd_percent,
        v.return_water_colour,
        v.water_loss,
        v.borehole_diameter,
        v.remarks,
        v.images
      FROM (
        SELECT 
          borelog_id, version_no, created_at, created_by_user_id,
          number, msl, boring_method, hole_diameter, commencement_date, completion_date,
          standing_water_level, termination_depth, coordinate,
          permeability_test_count, spt_vs_test_count, undisturbed_sample_count, disturbed_sample_count, water_sample_count,
          job_code, location, chainage_km,
          stratum_description, stratum_depth_from, stratum_depth_to, stratum_thickness_m,
          sample_event_type, sample_event_depth_m, run_length_m, spt_blows_per_15cm, n_value_is_2131,
          total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent, return_water_colour, water_loss,
          borehole_diameter, remarks, images
        FROM borelog_details WHERE borelog_id = $1
        UNION ALL
        SELECT 
          borelog_id, version_no, created_at, created_by_user_id,
          number, msl, boring_method, hole_diameter, commencement_date, completion_date,
          standing_water_level, termination_depth, coordinate,
          permeability_test_count, spt_vs_test_count, undisturbed_sample_count, disturbed_sample_count, water_sample_count,
          job_code, location, chainage_km,
          stratum_description, stratum_depth_from, stratum_depth_to, stratum_thickness_m,
          sample_event_type, sample_event_depth_m, run_length_m, spt_blows_per_15cm, n_value_is_2131,
          total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent, return_water_colour, water_loss,
          borehole_diameter, remarks, NULL as images
        FROM borelog_versions WHERE borelog_id = $1
      ) v
      LEFT JOIN users u ON v.created_by_user_id = u.user_id
      ORDER BY v.version_no DESC
    `;

    const versionHistory = await db.query(versionHistoryQuery, [borelog[0].borelog_id]);

    // Format the response
    const formattedVersionHistory = versionHistory.map(version => ({
      version_no: version.version_no,
      created_at: version.created_at,
      created_by: {
        user_id: version.created_by_user_id,
        name: version.created_by_name,
        email: version.created_by_email
      },
      details: {
        number: version.number,
        msl: version.msl,
        boring_method: version.boring_method,
        hole_diameter: version.hole_diameter,
        commencement_date: version.commencement_date,
        completion_date: version.completion_date,
        standing_water_level: version.standing_water_level,
        termination_depth: version.termination_depth,
        coordinate: version.coordinate,
        permeability_test_count: version.permeability_test_count,
        spt_vs_test_count: version.spt_vs_test_count,
        undisturbed_sample_count: version.undisturbed_sample_count,
        disturbed_sample_count: version.disturbed_sample_count,
        water_sample_count: version.water_sample_count,
        job_code: version.job_code,
        location: version.location,
        chainage_km: version.chainage_km,
        stratum_description: version.stratum_description,
        stratum_depth_from: version.stratum_depth_from,
        stratum_depth_to: version.stratum_depth_to,
        stratum_thickness_m: version.stratum_thickness_m,
        sample_event_type: version.sample_event_type,
        sample_event_depth_m: version.sample_event_depth_m,
        run_length_m: version.run_length_m,
        spt_blows_per_15cm: version.spt_blows_per_15cm,
        n_value_is_2131: version.n_value_is_2131,
        total_core_length_cm: version.total_core_length_cm,
        tcr_percent: version.tcr_percent,
        rqd_length_cm: version.rqd_length_cm,
        rqd_percent: version.rqd_percent,
        return_water_colour: version.return_water_colour,
        water_loss: version.water_loss,
        borehole_diameter: version.borehole_diameter,
        remarks: version.remarks,
        images: version.images
      }
    }));

    const response = createResponse(200, {
      success: true,
      message: 'Borelog retrieved successfully',
      data: {
        borelog_id: borelog[0].borelog_id,
        borelog_type: borelog[0].borelog_type,
        project: {
          project_id: borelog[0].project_id,
          name: borelog[0].project_name,
          location: borelog[0].project_location
        },
        structure: {
          structure_type: borelog[0].structure_type,
          description: borelog[0].structure_description,
          substructure_type: borelog[0].substructure_type,
          substructure_remark: borelog[0].substructure_remark,
          // Borehole data
          tunnel_no: borelog[0].tunnel_no,
          location: borelog[0].borehole_location,
          chainage: borelog[0].chainage,
          borehole_number: borelog[0].borehole_number,
          borehole_msl: borelog[0].borehole_msl,
          borehole_coordinate: borelog[0].borehole_coordinate,
          borehole_boring_method: borelog[0].borehole_boring_method,
          borehole_hole_diameter: borelog[0].borehole_hole_diameter,
          borehole_description: borelog[0].borehole_description,
          borehole_coordinates_json: borelog[0].borehole_coordinates_json
        },
        version_history: formattedVersionHistory,
        latest_version: formattedVersionHistory[0] // First item is the latest due to DESC ordering
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;
  } catch (error) {
    logger.error('Error retrieving borelog by substructure_id:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to retrieve borelog'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};
