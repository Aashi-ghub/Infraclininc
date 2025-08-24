import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import * as db from '../db';
import { validate as validateUUID } from 'uuid';
import { z } from 'zod';
import { convertScalarToRelational } from '../utils/stratumConverter';
import { saveStratumData } from '../utils/stratumSaver';

// Schema for creating new borelog versions
const CreateBorelogVersionSchema = z.object({
  borelog_id: z.string().uuid('Invalid borelog ID'),
  substructure_id: z.string().uuid('Invalid substructure ID'),
  project_id: z.string().uuid('Invalid project ID'),
  type: z.enum(['Geotechnical', 'Geological']),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  version_no: z.number().optional(),
  number: z.string().optional(),
  msl: z.string().optional(),
  boring_method: z.string().optional(),
  hole_diameter: z.number().nullable().optional(),
  commencement_date: z.string().optional(),
  completion_date: z.string().optional(),
  standing_water_level: z.number().optional(),
  termination_depth: z.number().optional(),
  coordinate: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()])
  }).optional(),
  // Newly added optional fields for extended metadata
  job_code: z.string().optional(),
  location: z.string().optional(),
  chainage_km: z.union([z.string(), z.number()]).optional(),
  permeability_test_count: z.string().optional(),
  spt_vs_test_count: z.string().optional(),
  undisturbed_sample_count: z.string().optional(),
  disturbed_sample_count: z.string().optional(),
  water_sample_count: z.string().optional(),
  stratum_description: z.string().optional(),
  stratum_depth_from: z.number().optional(),
  stratum_depth_to: z.number().optional(),
  stratum_thickness_m: z.number().optional(),
  sample_event_type: z.string().optional(),
  sample_event_depth_m: z.number().optional(),
  run_length_m: z.number().optional(),
  spt_blows_per_15cm: z.number().optional(),
  n_value_is_2131: z.string().optional(),
  total_core_length_cm: z.number().optional(),
  tcr_percent: z.number().optional(),
  rqd_length_cm: z.number().optional(),
  rqd_percent: z.number().optional(),
  return_water_colour: z.string().optional(),
  water_loss: z.string().optional(),
  borehole_diameter: z.number().optional(),
  stratum_data: z.string().optional(),
  remarks: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Check if user has appropriate role
    const authError = await checkRole(['Admin', 'Project Manager', 'Site Engineer'])(event);
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

    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Request body is missing',
        error: 'Missing request body'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const data = JSON.parse(event.body);
    const validationResult = CreateBorelogVersionSchema.safeParse(data);

    if (!validationResult.success) {
      const response = createResponse(400, {
        success: false,
        message: 'Validation failed',
        error: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const borelogData = validationResult.data;

    // Check if user has access to the project or borelog assignment
    if (payload.role === 'Site Engineer') {
      // For Site Engineers, check if they are assigned to this borelog
      const assignmentQuery = `
        SELECT 1 FROM borelog_assignments 
        WHERE assigned_site_engineer = $1 
        AND status = 'active'
        AND (
          borelog_id = $2 OR substructure_id = (
            SELECT substructure_id FROM boreloge WHERE borelog_id = $2
          )
        )
      `;
      const assignmentCheck = await db.query(assignmentQuery, [payload.userId, borelogData.borelog_id]);
      
      if (assignmentCheck.length === 0) {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: Borelog not assigned to you',
          error: 'You can only edit borelogs that are assigned to you'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    } else {
      // For other roles, check project-level access
      const projectAccessQuery = `
        SELECT 1 FROM user_project_assignments 
        WHERE project_id = $1 AND $2 = ANY(assignee)
      `;
      const projectAccess = await db.query(projectAccessQuery, [borelogData.project_id, payload.userId]);
      
      if (projectAccess.length === 0 && payload.role !== 'Admin') {
        const response = createResponse(403, {
          success: false,
          message: 'Access denied: User not assigned to this project',
          error: 'Insufficient permissions'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Check if the borelog exists
    const borelogCheckQuery = `
      SELECT borelog_id FROM boreloge WHERE borelog_id = $1
    `;
    const borelogCheck = await db.query(borelogCheckQuery, [borelogData.borelog_id]);
    
    if (borelogCheck.length === 0) {
      const response = createResponse(404, {
        success: false,
        message: 'Borelog not found',
        error: 'The specified borelog does not exist'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Get the next version number from staging table (borelog_versions) falling back to details
    const versionQuery = `
      WITH v1 AS (
        SELECT COALESCE(MAX(version_no), 0) AS v FROM borelog_versions WHERE borelog_id = $1
      ), v2 AS (
        SELECT COALESCE(MAX(version_no), 0) AS v FROM borelog_details WHERE borelog_id = $1
      )
      SELECT GREATEST((SELECT v FROM v1), (SELECT v FROM v2)) + 1 AS next_version;
    `;
    const versionResult = await db.query(versionQuery, [borelogData.borelog_id]);
    const nextVersion = borelogData.version_no || versionResult[0].next_version;

    // Parse stratum data from JSON if provided
    let stratumDescription = borelogData.stratum_description;
    let stratumDepthFrom = borelogData.stratum_depth_from;
    let stratumDepthTo = borelogData.stratum_depth_to;
    let stratumThicknessM = borelogData.stratum_thickness_m;
    let sampleEventType = borelogData.sample_event_type;
    let sampleEventDepthM = borelogData.sample_event_depth_m;
    let runLengthM = borelogData.run_length_m;
    let sptBlowsPer15cm = borelogData.spt_blows_per_15cm;
    let nValueIs2131 = borelogData.n_value_is_2131;
    let totalCoreLengthCm = borelogData.total_core_length_cm;
    let tcrPercent = borelogData.tcr_percent;
    let rqdLengthCm = borelogData.rqd_length_cm;
    let rqdPercent = borelogData.rqd_percent;
    let returnWaterColour = borelogData.return_water_colour;
    let waterLoss = borelogData.water_loss;
    let boreholeDiameter = borelogData.borehole_diameter;

    // If stratum_data JSON is provided, parse it and extract values from the first stratum
    if (borelogData.stratum_data) {
      try {
        const stratumData = JSON.parse(borelogData.stratum_data);
        if (Array.isArray(stratumData) && stratumData.length > 0) {
          const firstStratum = stratumData[0];
          
          // Map JSON fields to individual columns
          stratumDescription = firstStratum.description || stratumDescription;
          stratumDepthFrom = firstStratum.depth_from || stratumDepthFrom;
          stratumDepthTo = firstStratum.depth_to || stratumDepthTo;
          stratumThicknessM = firstStratum.thickness || stratumThicknessM;
          sampleEventType = firstStratum.sample_type || sampleEventType;
          sampleEventDepthM = firstStratum.sample_depth ? parseFloat(firstStratum.sample_depth) : sampleEventDepthM;
          runLengthM = firstStratum.run_length || runLengthM;
          sptBlowsPer15cm = firstStratum.spt_15cm_1 || sptBlowsPer15cm; // Use first SPT value
          nValueIs2131 = firstStratum.n_value ? firstStratum.n_value.toString() : nValueIs2131;
          totalCoreLengthCm = firstStratum.total_core_length || totalCoreLengthCm;
          tcrPercent = firstStratum.tcr_percent || tcrPercent;
          rqdLengthCm = firstStratum.rqd_length || rqdLengthCm;
          rqdPercent = firstStratum.rqd_percent || rqdPercent;
          returnWaterColour = firstStratum.return_water_color || returnWaterColour;
          waterLoss = firstStratum.water_loss || waterLoss;
          boreholeDiameter = firstStratum.borehole_diameter ? parseFloat(firstStratum.borehole_diameter) : boreholeDiameter;
        }
      } catch (error) {
        logger.warn('Failed to parse stratum_data JSON:', error);
      }
    }

    // Insert new version into staging table (borelog_versions) with provided status or default to 'submitted'
    const insertQuery = `
      INSERT INTO borelog_versions (
        borelog_id,
        version_no,
        number,
        msl,
        boring_method,
        hole_diameter,
        commencement_date,
        completion_date,
        standing_water_level,
        termination_depth,
        coordinate,
        permeability_test_count,
        spt_vs_test_count,
        undisturbed_sample_count,
        disturbed_sample_count,
        water_sample_count,
        stratum_description,
        stratum_depth_from,
        stratum_depth_to,
        stratum_thickness_m,
        sample_event_type,
        sample_event_depth_m,
        run_length_m,
        spt_blows_per_15cm,
        n_value_is_2131,
        total_core_length_cm,
        tcr_percent,
        rqd_length_cm,
        rqd_percent,
        return_water_colour,
        water_loss,
        borehole_diameter,
        job_code,
        location,
        chainage_km,
        remarks,
        created_by_user_id,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38
      ) RETURNING *;
    `;

    const insertValues = [
      borelogData.borelog_id,
      nextVersion,
      borelogData.number,
      borelogData.msl,
      borelogData.boring_method,
      borelogData.hole_diameter,
      borelogData.commencement_date,
      borelogData.completion_date,
      borelogData.standing_water_level,
      borelogData.termination_depth,
      borelogData.coordinate ? `POINT(${borelogData.coordinate.coordinates[0]} ${borelogData.coordinate.coordinates[1]})` : null,
      borelogData.permeability_test_count,
      borelogData.spt_vs_test_count,
      borelogData.undisturbed_sample_count,
      borelogData.disturbed_sample_count,
      borelogData.water_sample_count,
      stratumDescription,
      stratumDepthFrom,
      stratumDepthTo,
      stratumThicknessM,
      sampleEventType,
      sampleEventDepthM,
      runLengthM,
      sptBlowsPer15cm,
      nValueIs2131,
      totalCoreLengthCm,
      tcrPercent,
      rqdLengthCm,
      rqdPercent,
      returnWaterColour,
      waterLoss,
      boreholeDiameter,
      borelogData.job_code,
      borelogData.location,
      borelogData.chainage_km,
      borelogData.remarks,
      payload.userId,
      borelogData.status || 'submitted'
    ];

    const result = await db.query(insertQuery, insertValues);
    const newVersion = result[0];

    // Convert scalar stratum data to relational format and save it
    const scalarData = {
      stratum_description: stratumDescription,
      stratum_depth_from: stratumDepthFrom,
      stratum_depth_to: stratumDepthTo,
      stratum_thickness_m: stratumThicknessM,
      sample_event_type: sampleEventType,
      sample_event_depth_m: sampleEventDepthM,
      run_length_m: runLengthM,
      spt_blows_per_15cm: sptBlowsPer15cm,
      n_value_is_2131: nValueIs2131,
      total_core_length_cm: totalCoreLengthCm,
      tcr_percent: tcrPercent,
      rqd_length_cm: rqdLengthCm,
      rqd_percent: rqdPercent,
      return_water_colour: returnWaterColour,
      water_loss: waterLoss,
      borehole_diameter: boreholeDiameter
    };

    const relationalLayers = convertScalarToRelational(scalarData);
    if (relationalLayers.length > 0) {
      await saveStratumData(db.getPool(), borelogData.borelog_id, nextVersion, relationalLayers, payload.userId);
    }

    const response = createResponse(201, {
      success: true,
      message: 'Borelog version created successfully',
      data: {
        ...newVersion,
        version_no: nextVersion
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

  } catch (error) {
    logger.error('Error creating borelog version:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to create borelog version'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

