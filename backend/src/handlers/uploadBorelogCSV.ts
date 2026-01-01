import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import * as db from '../db';
import { isDbEnabled } from '../db';
import * as ExcelJS from 'exceljs';
import { getStorageService, validateFile } from '../services/storageService';
import { invokeBorelogParserLambda } from '../services/lambdaInvoker';
import { v4 as uuidv4 } from 'uuid';
// Import busboy for multipart/form-data parsing (v1.x uses factory function, not constructor)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const busboy = require('busboy');

// CSV Schema for borelog header (first row contains borelog metadata)
const BorelogHeaderSchema = z.object({
  // Project Information - These will be provided by the frontend
  project_id: z.string().uuid('Invalid project ID').optional(),
  structure_id: z.string().uuid('Invalid structure ID').optional(),
  substructure_id: z.string().uuid('Invalid substructure ID').optional(),
  borehole_id: z.string().uuid('Invalid borehole ID').optional(),
  project_name: z.string().optional(),
  job_code: z.string().min(1, 'Job code is required'),
  chainage_km: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Chainage KM must be a valid number"
  }).optional(),
  borehole_no: z.string().optional(),
  msl: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "MSL must be a valid number"
  }).optional(),
  
  // Borehole Information
  method_of_boring: z.string().min(1, 'Method of boring is required'),
  diameter_of_hole: z.string().min(1, 'Diameter of hole is required'),
  section_name: z.string().min(1, 'Section name is required'),
  location: z.string().min(1, 'Location is required'),
  coordinate_e: z.string().optional(),
  coordinate_l: z.string().optional(),
  commencement_date: z.string().min(1, 'Commencement date is required'),
  completion_date: z.string().min(1, 'Completion date is required'),
  standing_water_level: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Standing water level must be a valid number"
  }).optional(),
  termination_depth: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Termination depth must be a valid number"
  }).optional(),
  
  // Test Counts
  permeability_tests_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Permeability tests count must be a valid number"
  }).optional(),
  spt_tests_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "SPT tests count must be a valid number"
  }).optional(),
  vs_tests_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "VS tests count must be a valid number"
  }).optional(),
  undisturbed_samples_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Undisturbed samples count must be a valid number"
  }).optional(),
  disturbed_samples_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Disturbed samples count must be a valid number"
  }).optional(),
  water_samples_count: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Water samples count must be a valid number"
  }).optional(),
  
  // Metadata
  version_number: z.string().refine(val => !val || !isNaN(parseInt(val)), {
    message: "Version number must be a valid number"
  }).optional(),
  status: z.string().optional(),
  edited_by: z.string().uuid('Invalid edited_by user ID').optional(),
  editor_name: z.string().optional(),
  remarks: z.string().optional(),
});

// CSV Schema for stratum rows (subsequent rows contain sample layer data)
const StratumRowSchema = z.object({
  // Stratum Information
  stratum_description: z.string().min(1, 'Stratum description is required'),
  stratum_depth_from: z.string().refine(val => !isNaN(parseFloat(val)), {
    message: "Stratum depth from must be a valid number"
  }),
  stratum_depth_to: z.string().refine(val => !isNaN(parseFloat(val)), {
    message: "Stratum depth to must be a valid number"
  }),
  stratum_thickness_m: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Stratum thickness must be a valid number"
  }).optional(),
  
  // Sample Information
  sample_event_type: z.string().optional(),
  sample_event_depth_m: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Sample event depth must be a valid number"
  }).optional(),
  run_length_m: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Run length must be a valid number"
  }).optional(),
  
  // SPT Test Data
  spt_blows_1: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "SPT blows 1 must be a valid number"
  }).optional(),
  spt_blows_2: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "SPT blows 2 must be a valid number"
  }).optional(),
  spt_blows_3: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "SPT blows 3 must be a valid number"
  }).optional(),
  n_value_is_2131: z.string().optional(),
  
  // Core Recovery Data
  total_core_length_cm: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Total core length must be a valid number"
  }).optional(),
  tcr_percent: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "TCR percent must be a valid number"
  }).optional(),
  rqd_length_cm: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "RQD length must be a valid number"
  }).optional(),
  rqd_percent: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "RQD percent must be a valid number"
  }).optional(),
  
  // Water and Borehole Data
  return_water_colour: z.string().optional(),
  water_loss: z.string().optional(),
  borehole_diameter: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Borehole diameter must be a valid number"
  }).optional(),
  
  // Additional fields
  remarks: z.string().optional(),
  is_subdivision: z.string().refine(val => !val || ['true', 'false', '1', '0'].includes(val.toLowerCase()), {
    message: "Is subdivision must be true/false or 1/0"
  }).optional(),
  parent_row_id: z.string().optional(),
});

// Helper function to map status values to valid enum values
function mapStatusValue(status: string | undefined): 'draft' | 'submitted' | 'approved' | 'rejected' {
  if (!status) return 'draft';
  
  const statusLower = status.toLowerCase();
  
  switch (statusLower) {
    case 'draft':
    case 'd':
      return 'draft';
    case 'submitted':
    case 'submit':
    case 's':
      return 'submitted';
    case 'approved':
    case 'approve':
    case 'a':
    case 'final':
    case 'f':
      return 'approved';
    case 'rejected':
    case 'reject':
    case 'r':
    case 'reviewed':
      return 'rejected';
    default:
      return 'draft';
  }
}

/**
 * Parse multipart/form-data using Busboy and return the file buffer plus form fields
 */
function parseMultipartForm(
  event: APIGatewayProxyEvent,
  contentType: string
): Promise<{
  fileBuffer: Buffer;
  fileName?: string;
  fileType?: string;
  fields: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    // Busboy v1.x uses a factory function, not a constructor
    const parser = busboy({ headers: { 'content-type': contentType } });
    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let fileName: string | undefined;
    let fileType: string | undefined;

    parser.on('file', (_fieldname: string, file: any, info: any) => {
      const chunks: Buffer[] = [];
      fileName = info?.filename;
      const mime = info?.mimeType || info?.mimetype;
      if (mime) {
        if (mime.includes('sheet')) fileType = 'xlsx';
        else if (mime.includes('csv')) fileType = 'csv';
      }

      file.on('data', (data: Buffer) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    parser.on('field', (name: string, val: string) => {
      fields[name] = val;
    });

    parser.on('error', (err: Error) => {
      reject(err);
    });

    parser.on('finish', () => {
      if (!fileBuffer) {
        return reject(new Error('No file part found in multipart/form-data'));
      }
      resolve({ fileBuffer, fileName, fileType, fields });
    });

    const body = event.body || '';
    const bodyBuffer = event.isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'binary');
    parser.end(bodyBuffer);
  });
}

/**
 * Normalize ExcelJS cell value to a primitive string or number.
 * Handles richText, formula results, merged cells, and other object types.
 */
function normalizeCellValue(cell: ExcelJS.Cell): string | number | null {
  if (cell.value === null || cell.value === undefined) {
    return null;
  }

  const value = cell.value;

  // Handle Date objects
  if (value instanceof Date) {
    const day = value.getDate().toString().padStart(2, '0');
    const month = (value.getMonth() + 1).toString().padStart(2, '0');
    const year = value.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  }

  // Handle primitive types
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return String(value); // Convert boolean to string
  }

  // Handle objects (richText, formula results, etc.)
  if (typeof value === 'object') {
    // Check for richText array (formatted text)
    if (Array.isArray((value as any).richText)) {
      const richText = (value as any).richText;
      return richText.map((rt: any) => rt.text || '').join('');
    }

    // Check for .text property (simple rich text object)
    if ('text' in value && typeof (value as any).text === 'string') {
      return (value as any).text;
    }

    // Check for .result property (formula result)
    if ('result' in value) {
      const result = (value as any).result;
      if (result instanceof Date) {
        const day = result.getDate().toString().padStart(2, '0');
        const month = (result.getMonth() + 1).toString().padStart(2, '0');
        const year = result.getFullYear().toString().slice(-2);
        return `${day}.${month}.${year}`;
      }
      return normalizeCellValue({ value: result } as ExcelJS.Cell);
    }

    // Check for .formula property (if we need the formula itself)
    if ('formula' in value) {
      // For formulas, prefer result if available, otherwise return empty
      return null;
    }
  }

  // Fallback: convert to string
  try {
    return String(value);
  } catch {
    return null;
  }
}

/**
 * Normalize a value to a string, handling objects and trimming whitespace.
 */
function normalizeValueToString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  // If it's already a string or number, convert and trim
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  
  // If it's an object (might be a cell value that wasn't normalized), try to extract text
  if (typeof value === 'object') {
    if (Array.isArray((value as any).richText)) {
      return (value as any).richText.map((rt: any) => rt.text || '').join('').trim();
    }
    if ('text' in value) {
      return String((value as any).text).trim();
    }
    if ('result' in value) {
      return normalizeValueToString((value as any).result);
    }
  }
  
  // Fallback
  return String(value).trim();
}

/**
 * Normalize depth value - convert to number if possible, otherwise return trimmed string.
 * Handles numeric 0, "-", empty strings, and "[object Object]" safely.
 */
function normalizeDepthValue(value: any): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle numeric values directly (including 0)
  if (typeof value === 'number') {
    if (isNaN(value)) return '';
    return value.toString();
  }
  
  // Handle boolean
  if (typeof value === 'boolean') {
    return '';
  }
  
  // Handle objects (skip "[object Object]")
  if (typeof value === 'object') {
    // Try to extract meaningful value from object
    if (Array.isArray((value as any).richText)) {
      const richText = (value as any).richText;
      const text = richText.map((rt: any) => rt.text || '').join('').trim();
      if (!text) return '';
      // Recursively process extracted text
      return normalizeDepthValue(text);
    }
    if ('text' in value && typeof (value as any).text === 'string') {
      return normalizeDepthValue((value as any).text);
    }
    if ('result' in value) {
      return normalizeDepthValue((value as any).result);
    }
    // Skip "[object Object]" and other objects
    return '';
  }
  
  // Handle string
  const normalized = String(value).trim();
  if (!normalized || normalized === '-' || normalized === '[object Object]') {
    return '';
  }
  
  // Remove common non-numeric characters but keep decimal point and minus sign
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  
  // If it's a valid number (including 0), return it as string
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return cleaned;
  }
  
  // Return empty if not a valid number
  return '';
}

// Helper function to parse Excel files with specific borelog format
async function parseExcelFile(fileBuffer: Buffer): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS expects Buffer - cast to satisfy type checker
    await workbook.xlsx.load(fileBuffer as any);
  } catch (error) {
    logger.error('ExcelJS load error:', {
      error: error instanceof Error ? error.message : String(error),
      bufferSize: fileBuffer.length
    });
    throw new Error(`Failed to load Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const worksheet = workbook.getWorksheet(1); // Get first worksheet
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }
  
  logger.info(`Excel worksheet dimensions: ${worksheet.rowCount} rows, ${worksheet.columnCount} columns`);
  
  // Extract all rows first to analyze the structure
  // Normalize ALL cell values during extraction to prevent "[object Object]" issues
  const allRows: any[][] = [];
  worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
    const rowValues: any[] = [];
    row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
      const normalized = normalizeCellValue(cell);
      rowValues[colNumber - 1] = normalized !== null ? normalized : '';
    });
    allRows.push(rowValues);
    logger.info(`Row ${rowNumber}:`, rowValues);
  });
  
  // Find the header row (look for "Description of Soil Stratum & Rock Methodology")
  let headerRowIndex = -1;
  let headerRow: string[] = [];
  
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    for (let j = 0; j < row.length; j++) {
      const cellValue = normalizeValueToString(row[j]);
      if (cellValue.includes('Description of Soil Stratum & Rock Methodology')) {
        headerRowIndex = i;
        headerRow = row.map(cell => normalizeValueToString(cell));
        logger.info(`Found header row at index ${i}:`, headerRow);
   logger.info('Header row details:');
   headerRow.forEach((header, index) => {
     if (header && header.trim()) {
       logger.info(`  Column ${index}: "${header}"`);
     }
   });
        break;
      }
    }
    if (headerRowIndex !== -1) break;
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Could not find header row with "Description of Soil Stratum & Rock Methodology"');
  }
  
  // Extract borelog header information from rows before the header row
  const borelogHeader: any = {};
  
  // Look for specific borelog information in the first few rows
  for (let i = 0; i < headerRowIndex; i++) {
    const row = allRows[i];
    for (let j = 0; j < row.length; j++) {
      const cellValue = normalizeValueToString(row[j]);
      
      // Extract Job Code
      if (cellValue === 'Job Code' && j + 1 < row.length) {
        borelogHeader.job_code = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Section Name
      if (cellValue === 'Section Name' && j + 1 < row.length) {
        borelogHeader.section_name = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Chainage
      if (cellValue === 'Chainage (Km)' && j + 1 < row.length) {
        borelogHeader.chainage_km = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Location
      if (cellValue === 'Location' && j + 1 < row.length) {
        borelogHeader.location = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Borehole No
      if (cellValue === 'Borehole No.' && j + 1 < row.length) {
        borelogHeader.borehole_no = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Commencement Date
      if (cellValue === 'Commencement Date' && j + 1 < row.length) {
        borelogHeader.commencement_date = normalizeValueToString(row[j + 1]);
      }
      
      // Extract MSL
      if (cellValue === 'Mean Sea Level (MSL)' && j + 1 < row.length) {
        borelogHeader.msl = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Coordinates (E and L)
      if ((cellValue === 'Coordinate E' || cellValue === 'E' || cellValue.includes('Coordinate') && cellValue.includes('E')) && j + 1 < row.length) {
        borelogHeader.coordinate_e = normalizeValueToString(row[j + 1]);
      }
      if ((cellValue === 'Coordinate L' || cellValue === 'L' || cellValue.includes('Coordinate') && cellValue.includes('L')) && j + 1 < row.length) {
        borelogHeader.coordinate_l = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Completion Date
      if (cellValue === 'Completion Date' && j + 1 < row.length) {
        borelogHeader.completion_date = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Method of Boring
      if (cellValue === 'Method of Boring / Drilling' && j + 1 < row.length) {
        borelogHeader.method_of_boring = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Diameter of Hole
      if (cellValue === 'Diameter of Hole' && j + 1 < row.length) {
        borelogHeader.diameter_of_hole = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Standing Water Level
      if (cellValue === 'Standing Water Level' && j + 1 < row.length) {
        borelogHeader.standing_water_level = normalizeValueToString(row[j + 1]);
      }
      
      // Extract Termination Depth
      if (cellValue === 'Termination Depth' && j + 1 < row.length) {
        borelogHeader.termination_depth = normalizeValueToString(row[j + 1]);
      }
      
      // Extract test counts
      if (cellValue.includes('No. of Permeabilty test') && j + 1 < row.length) {
        borelogHeader.permeability_tests_count = normalizeValueToString(row[j + 1]);
      }
      
      if (cellValue.includes('No. of SP test') && j + 1 < row.length) {
        const spValue = normalizeValueToString(row[j + 1]);
        borelogHeader.spt_tests_count = spValue;
      }
      
      if (cellValue.includes('No. of Undisturbed Sample') && j + 1 < row.length) {
        borelogHeader.undisturbed_samples_count = normalizeValueToString(row[j + 1]);
      }
      
      if (cellValue.includes('No. of Disturbed Sample') && j + 1 < row.length) {
        borelogHeader.disturbed_samples_count = normalizeValueToString(row[j + 1]);
      }
      
      if (cellValue.includes('No. of Water Sample') && j + 1 < row.length) {
        borelogHeader.water_samples_count = normalizeValueToString(row[j + 1]);
      }
    }
  }
  
  logger.info('Extracted borelog header:', borelogHeader);
  
  // Check if there's a sub-header row (row after main header with "From", "To", "Thickness")
  let subHeaderRowIndex = -1;
  let subHeaderRow: string[] = [];
  let dataStartIndex = headerRowIndex + 1;
  
  if (headerRowIndex + 1 < allRows.length) {
    const nextRow = allRows[headerRowIndex + 1];
    const nextRowNormalized = nextRow.map(cell => normalizeValueToString(cell));
    // Check if this row contains "From" and "To" (sub-header indicators)
    const hasFrom = nextRowNormalized.some(cell => cell.includes('From'));
    const hasTo = nextRowNormalized.some(cell => cell.includes('To'));
    
    if (hasFrom && hasTo) {
      subHeaderRowIndex = headerRowIndex + 1;
      subHeaderRow = nextRowNormalized;
      dataStartIndex = headerRowIndex + 2; // Skip both header rows
      logger.info(`Found sub-header row at index ${subHeaderRowIndex}, data starts at ${dataStartIndex}`);
    }
  }
  
  // Build column mapping based on header rows
  // Use sub-header if available, otherwise use main header
  const columnMap: { [key: string]: number } = {};
  const mappingRow = subHeaderRow.length > 0 ? subHeaderRow : headerRow;
  
  for (let j = 0; j < mappingRow.length; j++) {
    const header = mappingRow[j];
    const normalizedHeader = normalizeValueToString(header);
    
    // Map by position and content
    if (normalizedHeader.includes('Description of Soil Stratum')) {
      columnMap.description = j;
    } else if (normalizedHeader === 'From' || (normalizedHeader.includes('Depth') && normalizedHeader.includes('From'))) {
      columnMap.depth_from = j;
    } else if (normalizedHeader === 'To' || (normalizedHeader.includes('Depth') && normalizedHeader.includes('To'))) {
      columnMap.depth_to = j;
    } else if (normalizedHeader.includes('Thickness')) {
      columnMap.thickness = j;
    } else if (normalizedHeader.toLowerCase() === 'type' || (normalizedHeader.includes('Sample') && normalizedHeader.includes('Type'))) {
      columnMap.sample_type = j;
    } else if (normalizedHeader.includes('Depth (m)') && !normalizedHeader.includes('Stratum')) {
      // Use the first Depth (m) column that's not related to Stratum depth
      if (!columnMap.sample_depth) {
        columnMap.sample_depth = j;
      }
    } else if (normalizedHeader.includes('Run Length')) {
      columnMap.run_length = j;
    } else if (normalizedHeader.includes('Standard Penetration Test') && normalizedHeader.includes('15 cm')) {
      if (!columnMap.spt_blows_1) columnMap.spt_blows_1 = j;
      else if (!columnMap.spt_blows_2) columnMap.spt_blows_2 = j;
      else if (!columnMap.spt_blows_3) columnMap.spt_blows_3 = j;
    } else if (normalizedHeader.includes('N - Value')) {
      columnMap.n_value = j;
    } else if (normalizedHeader.includes('Total Core Length')) {
      columnMap.total_core_length = j;
    } else if (normalizedHeader.includes('TCR (%)')) {
      columnMap.tcr_percent = j;
    } else if (normalizedHeader.includes('RQD Length')) {
      columnMap.rqd_length = j;
    } else if (normalizedHeader.includes('RQD (%)')) {
      columnMap.rqd_percent = j;
    } else if (normalizedHeader.includes('Colour of return water')) {
      columnMap.return_water_colour = j;
    } else if (normalizedHeader.includes('Water loss')) {
      columnMap.water_loss = j;
    } else if (normalizedHeader.includes('Diameter of Bore hole')) {
      columnMap.borehole_diameter = j;
    } else if (normalizedHeader.includes('Remarks')) {
      columnMap.remarks = j;
    }
  }
  
  logger.info('Column mapping:', columnMap);
  
  // Extract stratum data rows and group by depth range
  // PART 2: Group consecutive rows with same depth range into ONE stratum
  const stratumRows: any[] = [];
  let currentStratum: any = null;
  
  // Helper functions
  const getValue = (row: any[], colIndex: number | undefined): string => {
    if (colIndex === undefined || colIndex >= row.length) return '';
    const rawValue = row[colIndex];
    return normalizeValueToString(rawValue);
  };
  
  const getNumericValue = (row: any[], colIndex: number | undefined): string => {
    if (colIndex === undefined || colIndex >= row.length) return '';
    const rawValue = row[colIndex];
    const normalized = normalizeDepthValue(rawValue);
    if (normalized === '-' || normalized === '') return '';
    return normalized;
  };
  
  for (let i = dataStartIndex; i < allRows.length; i++) {
    const row = allRows[i];
    
    // Skip completely empty rows
    if (row.length === 0 || row.every(cell => {
      const normalized = normalizeValueToString(cell);
      return !normalized || normalized.trim() === '';
    })) {
      continue;
    }
    
    const description = getValue(row, columnMap.description);
    const depthFrom = getNumericValue(row, columnMap.depth_from);
    const depthTo = getNumericValue(row, columnMap.depth_to);
    const thickness = getNumericValue(row, columnMap.thickness);
    
    // Check if this is a valid stratum row
    const hasDescription = description && description.trim() !== '';
    const hasFromDepth = depthFrom !== '' && !isNaN(parseFloat(depthFrom));
    const hasToDepth = depthTo !== '' && !isNaN(parseFloat(depthTo));
    const hasThickness = thickness !== '' && !isNaN(parseFloat(thickness));
    const hasDepthInfo = (hasFromDepth && hasToDepth) || hasThickness;
    
    if (!hasDescription || !hasDepthInfo) {
      logger.debug(`Skipped row ${i + 1}: hasDescription=${hasDescription}, hasDepthInfo=${hasDepthInfo}`);
      continue;
    }
    
    // Check if this row belongs to the current stratum (same depth range)
    const depthFromNum = parseFloat(depthFrom);
    const depthToNum = parseFloat(depthTo);
    const isSameStratum = currentStratum && 
      currentStratum.stratum_depth_from === depthFrom &&
      currentStratum.stratum_depth_to === depthTo;
    
    if (isSameStratum) {
      // This is a sample within the same stratum
      const sampleType = getValue(row, columnMap.sample_type);
      const sampleDepth = getNumericValue(row, columnMap.sample_depth);
      
      if (sampleType || sampleDepth) {
        const sample: any = {
          type: sampleType || null,
          depth_m: sampleDepth ? parseFloat(sampleDepth) : null,
          remarks: getValue(row, columnMap.remarks) || null,
        };
        
        // Add sample to current stratum if not already added
        if (!currentStratum.samples) {
          currentStratum.samples = [];
        }
        currentStratum.samples.push(sample);
        logger.info(`Added sample to stratum ${stratumRows.length}: type="${sampleType}", depth="${sampleDepth}"`);
      }
    } else {
      // This is a new stratum - save previous if exists
      if (currentStratum) {
        stratumRows.push(currentStratum);
      }
      
      // Create new stratum
      currentStratum = {
        stratum_description: description.trim(),
        stratum_depth_from: depthFrom,
        stratum_depth_to: depthTo,
        stratum_thickness_m: thickness || (hasFromDepth && hasToDepth ? (depthToNum - depthFromNum).toFixed(2) : ''),
        samples: [],
      };
      
      // Add stratum-level fields (from first row of this stratum)
      const nValue = getValue(row, columnMap.n_value);
      if (nValue && nValue !== '-' && nValue !== '[object Object]') {
        currentStratum.n_value_is_2131 = nValue;
      }
      
      const tcrPercent = getNumericValue(row, columnMap.tcr_percent);
      if (tcrPercent && tcrPercent !== '-') currentStratum.tcr_percent = tcrPercent;
      
      const rqdPercent = getNumericValue(row, columnMap.rqd_percent);
      if (rqdPercent && rqdPercent !== '-') currentStratum.rqd_percent = rqdPercent;
      
      const returnWaterColour = getValue(row, columnMap.return_water_colour);
      if (returnWaterColour && returnWaterColour !== '-') currentStratum.return_water_colour = returnWaterColour;
      
      const waterLoss = getValue(row, columnMap.water_loss);
      if (waterLoss && waterLoss !== '-') currentStratum.water_loss = waterLoss;
      
      const boreholeDiameter = getNumericValue(row, columnMap.borehole_diameter);
      if (boreholeDiameter && boreholeDiameter !== '-') currentStratum.borehole_diameter = boreholeDiameter;
      
      const remarks = getValue(row, columnMap.remarks);
      if (remarks && remarks !== '-') currentStratum.remarks = remarks;
      
      // Check if this row also has sample data
      const sampleType = getValue(row, columnMap.sample_type);
      const sampleDepth = getNumericValue(row, columnMap.sample_depth);
      if (sampleType || sampleDepth) {
        const sample: any = {
          type: sampleType || null,
          depth_m: sampleDepth ? parseFloat(sampleDepth) : null,
          remarks: remarks || null,
        };
        currentStratum.samples.push(sample);
      }
      
      logger.info(`Created new stratum ${stratumRows.length + 1}: description="${currentStratum.stratum_description.substring(0, 50)}...", from="${currentStratum.stratum_depth_from}", to="${currentStratum.stratum_depth_to}"`);
    }
  }
  
  // Don't forget the last stratum
  if (currentStratum) {
    stratumRows.push(currentStratum);
  }
  
  logger.info(`Extracted ${stratumRows.length} strata (grouped from ${allRows.length - dataStartIndex} data rows)`);
  
  // Generate sample codes for all samples across all strata
  const sampleCounters: { [key: string]: number } = { 'D': 0, 'U': 0, 'S/D': 0, 'W': 0 };
  
  for (const stratum of stratumRows) {
    if (stratum.samples && Array.isArray(stratum.samples)) {
      for (const sample of stratum.samples) {
        if (sample.type) {
          // Extract sample type prefix (D, U, S/D, W, etc.)
          const typeUpper = String(sample.type).toUpperCase().trim();
          let prefix = 'D'; // default
          
          if (typeUpper.includes('D') && typeUpper.includes('S')) {
            prefix = 'S/D';
          } else if (typeUpper.includes('U')) {
            prefix = 'U';
          } else if (typeUpper.includes('W')) {
            prefix = 'W';
          } else if (typeUpper.includes('D')) {
            prefix = 'D';
          }
          
          // Increment counter and generate code
          if (!sampleCounters[prefix]) {
            sampleCounters[prefix] = 0;
          }
          sampleCounters[prefix]++;
          sample.sample_code = `${prefix}-${sampleCounters[prefix]}`;
          
          logger.info(`Generated sample code: ${sample.sample_code} for type "${sample.type}"`);
        }
      }
    }
  }
  
  // Return the borelog header as the first row, followed by grouped stratum rows
  return [borelogHeader, ...stratumRows];
}

// Helper function to parse borelog template format (specific to the provided template)
// Helper function to find a non-empty value in the same row (excluding field names)
function findValueInRow(row: string[], startIndex: number): string | null {
  const fieldNames = ['Job Code', 'Chainage (Km)', 'Borehole No.', 'Mean Sea Level (MSL)', 
                     'Method of Boring / Drilling', 'Diameter of Hole', 'Section Name', 
                     'Location', 'Commencement Date', 'Completion Date'];
  
  for (let i = startIndex + 1; i < row.length; i++) {
    if (row[i] && row[i].trim() !== '' && !fieldNames.includes(row[i].trim())) {
      return row[i].trim();
    }
  }
  return null;
}

// Helper function to find a non-empty value in the next row (excluding field names)
function findValueInNextRow(allRows: string[][], currentRowIndex: number): string | null {
  const fieldNames = ['Job Code', 'Chainage (Km)', 'Borehole No.', 'Mean Sea Level (MSL)', 
                     'Method of Boring / Drilling', 'Diameter of Hole', 'Section Name', 
                     'Location', 'Commencement Date', 'Completion Date'];
  
  if (currentRowIndex + 1 < allRows.length) {
    const nextRow = allRows[currentRowIndex + 1];
    for (let i = 0; i < nextRow.length; i++) {
      if (nextRow[i] && nextRow[i].trim() !== '' && !fieldNames.includes(nextRow[i].trim())) {
        return nextRow[i].trim();
      }
    }
  }
  return null;
}

function parseBorelogTemplateFormat(csvRows: any[]): { header: any, stratumData: any[] } {
  const header: any = {};
  const stratumData: any[] = [];
  
  if (csvRows.length === 0) {
    throw new Error('No CSV rows found');
  }

  logger.info('Analyzing CSV structure for borelog template format...');
  logger.info(`Total CSV rows: ${csvRows.length}`);
  
  // Convert CSV rows to array format for easier processing
  const allRows: string[][] = [];
  csvRows.forEach((row, index) => {
    const rowValues = Object.values(row).map(val => String(val || '').trim());
    allRows.push(rowValues);
    logger.info(`Row ${index}:`, rowValues);
  });
  
  // Find the stratum table header row
  let headerRowIndex = -1;
  let headerRow: string[] = [];
  
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    for (let j = 0; j < row.length; j++) {
      const cellValue = row[j];
      if (cellValue && cellValue.includes('Description of Soil Stratum')) {
        headerRowIndex = i;
        headerRow = row;
        logger.info(`Found stratum header row at index ${i}:`, headerRow);
        break;
      }
    }
    if (headerRowIndex !== -1) break;
  }
  
  if (headerRowIndex === -1) {
    logger.error('Could not find stratum header row');
    throw new Error('Could not find stratum header row');
  }
  
  // Extract borelog header information from rows before the stratum table
  for (let i = 0; i < headerRowIndex; i++) {
    const row = allRows[i];
    
    // Look for field names in any column and find their values
    for (let j = 0; j < row.length; j++) {
      const cellValue = row[j];
      
      // Extract Job Code - look for value in any column of the same row or next row
      if (cellValue === 'Job Code') {
        header.job_code = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found job_code: ${header.job_code}`);
      }
      
      // Extract Section Name
      if (cellValue === 'Section Name') {
        header.section_name = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found section_name: ${header.section_name}`);
      }
      
      // Extract Chainage
      if (cellValue === 'Chainage (Km)') {
        header.chainage_km = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found chainage_km: ${header.chainage_km}`);
      }
      
      // Extract Location
      if (cellValue === 'Location') {
        header.location = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found location: ${header.location}`);
      }
      
      // Extract Borehole No
      if (cellValue === 'Borehole No.') {
        header.borehole_no = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found borehole_no: ${header.borehole_no}`);
      }
      
      // Extract Commencement Date
      if (cellValue === 'Commencement Date') {
        header.commencement_date = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found commencement_date: ${header.commencement_date}`);
      }
      
      // Extract MSL
      if (cellValue === 'Mean Sea Level (MSL)') {
        header.msl = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found msl: ${header.msl}`);
      }
      
      // Extract Coordinates
      if (cellValue === 'Coordinate E' || cellValue === 'E' || (cellValue.includes('Coordinate') && cellValue.includes('E'))) {
        header.coordinate_e = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found coordinate_e: ${header.coordinate_e}`);
      }
      if (cellValue === 'Coordinate L' || cellValue === 'L' || (cellValue.includes('Coordinate') && cellValue.includes('L'))) {
        header.coordinate_l = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found coordinate_l: ${header.coordinate_l}`);
      }
      
      // Extract Completion Date
      if (cellValue === 'Completion Date') {
        header.completion_date = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found completion_date: ${header.completion_date}`);
      }
      
      // Extract Method of Boring
      if (cellValue === 'Method of Boring / Drilling') {
        header.method_of_boring = findValueInRow(row, j) || findValueInNextRow(allRows, i);
        logger.info(`Found method_of_boring: ${header.method_of_boring}`);
      }
      
      // Extract Diameter of Hole
      if (cellValue === 'Diameter of Hole' && j + 1 < row.length) {
        header.diameter_of_hole = row[j + 1];
        logger.info(`Found diameter_of_hole: ${header.diameter_of_hole}`);
      }
      
      // Extract Standing Water Level
      if (cellValue === 'Standing Water Level' && j + 1 < row.length) {
        header.standing_water_level = row[j + 1];
        logger.info(`Found standing_water_level: ${header.standing_water_level}`);
      }
      
      // Extract Termination Depth
      if (cellValue === 'Termination Depth' && j + 1 < row.length) {
        header.termination_depth = row[j + 1];
        logger.info(`Found termination_depth: ${header.termination_depth}`);
      }
    }
  }
  
  // Find column indices for stratum data
  const columnMap: { [key: string]: number } = {};
  for (let j = 0; j < headerRow.length; j++) {
    const header = headerRow[j];
    if (header) {
      if (header.includes('Description of Soil Stratum')) {
        columnMap.description = j;
      } else if (header.includes('From')) {
        columnMap.depth_from = j;
      } else if (header.includes('To')) {
        columnMap.depth_to = j;
      } else if (header.includes('Thickness')) {
        columnMap.thickness = j;
      } else if (header.includes('Type')) {
        columnMap.sample_type = j;
      } else if (header.includes('Depth (m)')) {
        columnMap.sample_depth = j;
      } else if (header.includes('Run Length')) {
        columnMap.run_length = j;
      } else if (header.includes('15 cm')) {
        columnMap.spt_blows = j;
      } else if (header.includes('N - Value')) {
        columnMap.n_value = j;
      } else if (header.includes('Total Core Length')) {
        columnMap.total_core_length = j;
      } else if (header.includes('TCR (%)')) {
        columnMap.tcr_percent = j;
      } else if (header.includes('RQD Length')) {
        columnMap.rqd_length = j;
      } else if (header.includes('RQD (%)')) {
        columnMap.rqd_percent = j;
      } else if (header.includes('Colour of return water')) {
        columnMap.return_water_colour = j;
      } else if (header.includes('Water loss')) {
        columnMap.water_loss = j;
      } else if (header.includes('Diameter of Bore hole')) {
        columnMap.borehole_diameter = j;
      } else if (header.includes('Remarks')) {
        columnMap.remarks = j;
      }
    }
  }
  
  logger.info('Column mapping:', columnMap);
  
  // Extract stratum data rows
  let currentStratum: any = null;
  
  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
      continue; // Skip empty rows
    }
    
    // Check if this is a new stratum layer (has description and depth)
    let description = columnMap.description !== undefined ? row[columnMap.description] : '';
    let depthFrom = columnMap.depth_from !== undefined ? row[columnMap.depth_from] : '';
    let depthTo = columnMap.depth_to !== undefined ? row[columnMap.depth_to] : '';

    // Instrumentation: log raw row and any regex-derived depths from description in column 0
    const rawCol0 = row[columnMap.description ?? 0] || '';
    const normalizedCol0 = String(rawCol0).replace(/\r?\n+/g, ' ').trim();
    const relaxedRange = normalizedCol0.match(/^(.*?)(\d+(?:\.\d+)?)[ ]*[-–][ ]*(\d+(?:\.\d+)?)[ ]*m?$/i);
    logger.info(`Stratum candidate row ${i}: col0="${rawCol0}", col2="${row[2] || ''}", col4="${row[4] || ''}", mappedFrom="${depthFrom}", mappedTo="${depthTo}"`);
    if (relaxedRange) {
      logger.info(`  Regex extracted depths for row ${i}: from=${relaxedRange[2]} to=${relaxedRange[3]} description="${relaxedRange[1].trim()}"`);
      // If mapped columns are missing or non-numeric (e.g., '-') use regex-derived depths
      const isNumeric = (v: any) => v !== undefined && v !== null && /^\d+(?:\.\d+)?$/.test(String(v).trim());
      if (!isNumeric(depthFrom) || !isNumeric(depthTo)) {
        description = relaxedRange[1].trim();
        depthFrom = relaxedRange[2];
        depthTo = relaxedRange[3];
      }
    } else {
      logger.info(`  No regex depth match found in col0 for row ${i}`);
    }

    // Also capture extra fields commonly found in columns 2 and 4
    const totalCoreLengthFromPos = row[2] && row[2] !== '-' ? String(row[2]).trim() : '';
    const sampleTypeFromPos = row[4] && row[4] !== '-' ? String(row[4]).trim() : '';

    // PART 2: Group by depth range - check if this row belongs to current stratum
    const isSameStratum = currentStratum && 
      currentStratum.stratum_depth_from === depthFrom &&
      currentStratum.stratum_depth_to === depthTo;
    
    if (description && depthFrom && depthTo && !isSameStratum) {
      // This is a new stratum layer (different depth range)
      if (currentStratum) {
        stratumData.push(currentStratum);
      }
      
      currentStratum = {
        stratum_description: description,
        stratum_depth_from: depthFrom,
        stratum_depth_to: depthTo,
        stratum_thickness_m: (columnMap.thickness !== undefined ? row[columnMap.thickness] : '') || (Number.isFinite(parseFloat(String(depthTo))) && Number.isFinite(parseFloat(String(depthFrom))) ? (parseFloat(String(depthTo)) - parseFloat(String(depthFrom))).toFixed(2) : ''),
        return_water_colour: columnMap.return_water_colour !== undefined ? row[columnMap.return_water_colour] : '',
        water_loss: columnMap.water_loss !== undefined ? row[columnMap.water_loss] : '',
        borehole_diameter: columnMap.borehole_diameter !== undefined ? row[columnMap.borehole_diameter] : '',
        remarks: columnMap.remarks !== undefined ? row[columnMap.remarks] : '',
        samples: []
      };
      
      // Add stratum-level fields if present
      if (columnMap.n_value !== undefined && row[columnMap.n_value]) {
        currentStratum.n_value_is_2131 = row[columnMap.n_value];
      }
      if (columnMap.tcr_percent !== undefined && row[columnMap.tcr_percent]) {
        currentStratum.tcr_percent = row[columnMap.tcr_percent];
      }
      if (columnMap.rqd_percent !== undefined && row[columnMap.rqd_percent]) {
        currentStratum.rqd_percent = row[columnMap.rqd_percent];
      }
      
      logger.info(`Created new stratum: ${description} (${depthFrom}-${depthTo}m)`);
    }
    
    // Check if this row has sample data (either new stratum or same stratum)
    if (description && depthFrom && depthTo) {
      const mappedSampleType = columnMap.sample_type !== undefined ? row[columnMap.sample_type] : '';
      const mappedSampleDepth = columnMap.sample_depth !== undefined ? row[columnMap.sample_depth] : '';
      // Fallbacks for templates where sample type is in col 4 and depth may be absent
      const fallbackSampleType = row[4] && row[4] !== '-' ? String(row[4]).trim() : '';
      const sampleType = mappedSampleType || fallbackSampleType;
      const sampleDepth = mappedSampleDepth; // keep as-is; may be empty

      if (sampleType && currentStratum) {
        const sample = {
          type: sampleType,
          depth_m: sampleDepth ? parseFloat(String(sampleDepth)) : null,
          remarks: columnMap.remarks !== undefined ? (row[columnMap.remarks] || null) : null,
        };

        currentStratum.samples.push(sample);
        logger.info(`Added sample to stratum: type=${sampleType}${sampleDepth ? ` depth=${sampleDepth}m` : ''}`);
      }
    }
  }
  
  // Add the last stratum if it exists
  if (currentStratum) {
    stratumData.push(currentStratum);
  }
  
  logger.info(`Extracted ${stratumData.length} stratum layers with samples`);
  
  // Generate sample codes for all samples across all strata
  const sampleCounters: { [key: string]: number } = { 'D': 0, 'U': 0, 'S/D': 0, 'W': 0 };
  
  for (const stratum of stratumData) {
    if (stratum.samples && Array.isArray(stratum.samples)) {
      for (const sample of stratum.samples) {
        if (sample.type) {
          // Extract sample type prefix (D, U, S/D, W, etc.)
          const typeUpper = String(sample.type).toUpperCase().trim();
          let prefix = 'D'; // default
          
          if (typeUpper.includes('D') && typeUpper.includes('S')) {
            prefix = 'S/D';
          } else if (typeUpper.includes('U')) {
            prefix = 'U';
          } else if (typeUpper.includes('W')) {
            prefix = 'W';
          } else if (typeUpper.includes('D')) {
            prefix = 'D';
          }
          
          // Increment counter and generate code
          if (!sampleCounters[prefix]) {
            sampleCounters[prefix] = 0;
          }
          sampleCounters[prefix]++;
          sample.sample_code = `${prefix}-${sampleCounters[prefix]}`;
          
          logger.info(`Generated sample code: ${sample.sample_code} for type "${sample.type}"`);
        }
      }
    }
  }
  
  return { header, stratumData };
}

// Helper function to parse CSV data
async function parseFileData(fileData: string, fileType: string): Promise<any[]> {
  logger.info(`parseFileData called with fileType: ${fileType}`);
  
  if (fileType.toLowerCase() === 'csv') {
    logger.info('Parsing as CSV...');
    logger.info('CSV data sample (first 200 chars):', fileData.substring(0, 200));
    
    const result = parse(fileData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    });
    logger.info(`CSV parsing result: ${result.length} rows`);
    if (result.length > 0) {
      logger.info('First row keys:', Object.keys(result[0] as any));
    }
    return result;
  } else {
    throw new Error(`parseFileData only supports CSV. Use parseExcelFile for Excel files.`);
  }
}

// Helper function to validate foreign key constraints
async function validateForeignKeys(borelogData: any) {
  const pool = await db.getPool();
  const client = await pool.connect();
  
  try {
    // Check if project exists
    const projectResult = await client.query(
      'SELECT project_id FROM projects WHERE project_id = $1',
      [borelogData.project_id]
    );
    if (projectResult.rows.length === 0) {
      throw new Error(`Project with ID ${borelogData.project_id} does not exist`);
    }

    // Check if structure exists
    const structureResult = await client.query(
      'SELECT structure_id FROM structure WHERE structure_id = $1',
      [borelogData.structure_id]
    );
    if (structureResult.rows.length === 0) {
      throw new Error(`Structure with ID ${borelogData.structure_id} does not exist`);
    }

    // Check if substructure exists
    const substructureResult = await client.query(
      'SELECT substructure_id FROM sub_structures WHERE substructure_id = $1',
      [borelogData.substructure_id]
    );
    if (substructureResult.rows.length === 0) {
      throw new Error(`Substructure with ID ${borelogData.substructure_id} does not exist`);
    }

         // Note: Borehole will be created from CSV data, so we don't validate it exists

  } finally {
    client.release();
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // MIGRATED: Removed DB guard since storage is now S3-based
  // Foreign key validation is conditional based on DB availability

  const startTime = Date.now();
  logRequest(event, { awsRequestId: 'local' });

  try {
    // Only Project Manager and Admin can upload CSV
    const authError = await checkRole(['Admin', 'Project Manager'])(event);
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

    const userId = payload.userId;

    // Enforce multipart/form-data and reject JSON/base64 flows
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
      const response = createResponse(400, {
        success: false,
        message: 'Invalid Content-Type. Only multipart/form-data is accepted.',
        error: 'JSON uploads are not supported for borelog CSV/XLSX. Please upload as multipart/form-data with a file part.'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }
    if (contentType.toLowerCase().includes('application/json')) {
      const response = createResponse(400, {
        success: false,
        message: 'JSON uploads are not supported.',
        error: 'Send the file using multipart/form-data with a file part. Base64/JSON uploads are rejected for binary integrity.'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse multipart form-data using Busboy
    let fileBuffer: Buffer | null = null;
    let fileName: string | undefined;
    let detectedFileType: string | undefined;
    const formFields: Record<string, string> = {};

    try {
      const parsed = await parseMultipartForm(event, contentType);
      fileBuffer = parsed.fileBuffer;
      fileName = parsed.fileName;
      detectedFileType = parsed.fileType;
      Object.assign(formFields, parsed.fields);
    } catch (error) {
      logger.error('Failed to parse multipart form-data:', error);
      const response = createResponse(400, {
        success: false,
        message: 'Invalid multipart/form-data payload',
        error: error instanceof Error ? error.message : 'Failed to parse multipart body'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    const projectId = formFields.projectId || formFields.project_id;
    const structureId = formFields.structureId || formFields.structure_id;
    const substructureId = formFields.substructureId || formFields.substructure_id;
    const fileType = (formFields.fileType || formFields.file_type || detectedFileType || 'xlsx').toLowerCase();

    logger.info('Multipart body parsed:', {
      hasFileBuffer: !!fileBuffer,
      fileBufferSize: fileBuffer ? fileBuffer.length : 0,
      fileType,
      fileName,
      formFieldsKeys: Object.keys(formFields)
    });

    if (!fileBuffer || fileBuffer.length === 0) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing file data',
        error: 'File part is required and cannot be empty'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (!projectId || !structureId || !substructureId) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'projectId, structureId, and substructureId are required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // For XLSX, enforce ZIP signature and minimum size
    if (fileType === 'xlsx' || fileType === 'xls') {
      if (fileBuffer.length < 4) {
        const response = createResponse(400, {
          success: false,
          message: 'Invalid XLSX file format',
          error: 'XLSX buffer too small (corrupt upload)'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
      if (!(fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04)) {
        const response = createResponse(400, {
          success: false,
          message: 'Invalid XLSX file format',
          error: 'XLSX must start with ZIP signature (PK\\x03\\x04)'
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    }

    // Convert file content for parsing
    let csvDataForParsing = '';
    if (fileType === 'csv') {
      csvDataForParsing = fileBuffer.toString('utf-8');
    }

    // Determine MIME type based on fileType
    const mimeType = fileType === 'csv' 
      ? 'text/csv' 
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    // Validate file size and MIME type
    const validation = validateFile(fileBuffer, mimeType, 'CSV');
    
    if (!validation.valid) {
      const response = createResponse(400, {
        success: false,
        message: 'File validation failed',
        error: validation.error
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse file data (CSV or Excel)
    let parsedData;
    try {
      logger.info(`Parsing ${fileType.toUpperCase()} data...`);
      logger.info('File type detected:', fileType);
      logger.info('File buffer size:', fileBuffer.length);
      
      // For Excel files, pass the buffer directly; for CSV, pass the string
      if (fileType === 'xlsx' || fileType === 'xls') {
        parsedData = await parseExcelFile(fileBuffer);
      } else {
        logger.info('CSV data sample (first 200 chars):', csvDataForParsing.substring(0, 200));
        parsedData = await parseFileData(csvDataForParsing, fileType);
      }
      
      logger.info(`Parsed ${parsedData.length} rows from ${fileType.toUpperCase()}`);
      if (parsedData.length > 0) {
        logger.info('Available columns in first row:', Object.keys(parsedData[0] as any));
        logger.info('First row sample:', parsedData[0]);
      } else {
        logger.warn('No rows parsed from file');
        
        // Try parsing as CSV as a fallback if no rows were parsed
        if (fileType.toLowerCase() !== 'csv') {
          logger.info('Trying fallback CSV parsing...');
          try {
            const fallbackResult = parse(csvDataForParsing, {
              columns: true,
              skip_empty_lines: true,
              trim: true,
              relax_quotes: true,
              relax_column_count: true
            });
            logger.info(`Fallback CSV parsing result: ${fallbackResult.length} rows`);
            if (fallbackResult.length > 0) {
              parsedData = fallbackResult;
              logger.info('Using fallback CSV parsing result');
            }
          } catch (fallbackError) {
            logger.error('Fallback CSV parsing also failed:', fallbackError);
          }
        }
      }
    } catch (error) {
      logger.error(`${fileType.toUpperCase()} parsing error:`, error);
      const response = createResponse(400, {
        success: false,
        message: `Invalid ${fileType.toUpperCase()} format`,
        error: `Failed to parse ${fileType.toUpperCase()} data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    if (parsedData.length === 0) {
      const response = createResponse(400, {
        success: false,
        message: `No data rows found in ${fileType.toUpperCase()}`,
        error: `${fileType.toUpperCase()} must contain at least one data row`
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Normalize CSV formats: template-style (scattered header) or standard (first-row header)
    // For XLSX files, parseExcelFile already returns [header, ...stratumRows] structure
    let normalizedHeader: any;
    let normalizedStratumRows: any[];

    // XLSX files parsed by parseExcelFile have structure: [borelogHeader, ...stratumRows]
    // where borelogHeader is an object and stratumRows are objects
    if (fileType === 'xlsx' || fileType === 'xls') {
      logger.info('Processing XLSX file structure: [header, ...stratumRows]');
      normalizedHeader = parsedData[0];
      normalizedStratumRows = parsedData.slice(1);
      logger.info(`XLSX: Extracted header and ${normalizedStratumRows.length} stratum rows`);
    } else {
      // For CSV files, check if it's template-style or standard
      const firstRow = parsedData[0] as any;
      const keys = Object.keys(firstRow || {});
      const values = Object.values(firstRow || {}).map(v => String(v || ''));
      const isTemplateCsv = keys.some(k => k.includes('Project Name')) || values.some(v => v.includes('Description of Soil Stratum'));

      if (isTemplateCsv) {
        logger.info('Detected template-style CSV. Extracting scattered metadata and stratum.');
        const { header, stratumData } = parseBorelogTemplateFormat(parsedData as any[]);
        normalizedHeader = header;
        normalizedStratumRows = stratumData;
      } else {
        // Assume standard CSV: first row header-like, rest stratum
        normalizedHeader = parsedData[0];
        normalizedStratumRows = parsedData.slice(1);
      }
    }

    const safeNumber = (val: any) => (val === undefined || val === null || val === '' ? null : parseFloat(String(val)));
    const safeInt = (val: any, def = 0) => (val === undefined || val === null || val === '' ? def : parseInt(String(val)));

    // Build borelogData without strict header schema validation
    const borelogData = {
      project_id: projectId,
      structure_id: structureId,
      substructure_id: substructureId,
      borehole_id: undefined,
      project_name: normalizedHeader.project_name || normalizedHeader['Project Name'] || normalizedHeader['Project Name:'],
      job_code: normalizedHeader.job_code || normalizedHeader['Job Code'] || normalizedHeader['job_code'],
      chainage_km: safeNumber(normalizedHeader.chainage_km || normalizedHeader['Chainage (Km)']),
      borehole_no: normalizedHeader.borehole_no || normalizedHeader['Borehole No.'],
      msl: safeNumber(normalizedHeader.msl || normalizedHeader['MSL'] || normalizedHeader['Mean Sea Level (MSL)']),
      method_of_boring: normalizedHeader.method_of_boring || normalizedHeader['Method of Boring'] || normalizedHeader['Method of Boring / Drilling'],
      diameter_of_hole: normalizedHeader.diameter_of_hole || normalizedHeader['Diameter of Hole'],
      section_name: normalizedHeader.section_name || normalizedHeader['Section Name'],
      location: normalizedHeader.location || normalizedHeader['Location'],
      coordinate_e: normalizedHeader.coordinate_e,
      coordinate_l: normalizedHeader.coordinate_l,
      commencement_date: normalizedHeader.commencement_date || normalizedHeader['Commencement Date'],
      completion_date: normalizedHeader.completion_date || normalizedHeader['Completion Date'],
      standing_water_level: safeNumber(normalizedHeader.standing_water_level),
      termination_depth: safeNumber(normalizedHeader.termination_depth),
      permeability_tests_count: safeInt(normalizedHeader.permeability_tests_count),
      spt_tests_count: safeInt(normalizedHeader.spt_tests_count),
      vs_tests_count: safeInt(normalizedHeader.vs_tests_count),
      undisturbed_samples_count: safeInt(normalizedHeader.undisturbed_samples_count),
      disturbed_samples_count: safeInt(normalizedHeader.disturbed_samples_count),
      water_samples_count: safeInt(normalizedHeader.water_samples_count),
      version_number: safeInt(normalizedHeader.version_number, 1),
      status: mapStatusValue(normalizedHeader.status),
      edited_by: normalizedHeader.edited_by || userId,
      editor_name: normalizedHeader.editor_name,
      remarks: normalizedHeader.remarks,
      created_by_user_id: userId
    };

    logger.info('Processing borelog (normalized) header:', { job_code: borelogData.job_code, project_id: projectId });

    // Validate foreign keys before attempting to create (only if DB is enabled)
    // MIGRATED: Foreign key validation is now optional - skipped when DB is disabled
    if (isDbEnabled()) {
      try {
        await validateForeignKeys(borelogData);
      } catch (fkError) {
        logger.error('Foreign key validation failed:', fkError);
        const response = createResponse(400, {
          success: false,
          message: 'Foreign key constraint violation',
          error: (fkError as Error).message
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }
    } else {
      logger.info('Skipping foreign key validation - database is disabled');
    }

    // Validate stratum rows
    const stratumErrors = [];
    const validatedStratumRows = [];

    for (let i = 0; i < normalizedStratumRows.length; i++) {
      const row = normalizedStratumRows[i];
      const rowNumber = i + 3; // +3 because CSV has header, first row is borelog header, and arrays are 0-indexed

      try {
        const stratumValidation = StratumRowSchema.safeParse(row);
        if (!stratumValidation.success) {
          logger.error(`Stratum validation failed for row ${rowNumber}:`, {
            validationErrors: stratumValidation.error.errors
          });
          
          stratumErrors.push({
            row: rowNumber,
            errors: stratumValidation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
          });
          continue;
        }

        const stratumData = stratumValidation.data;
        
        // Calculate N-value from SPT blows if not provided
        let nValue = stratumData.n_value_is_2131;
        if (!nValue && (stratumData.spt_blows_2 || stratumData.spt_blows_3)) {
          const blows2 = stratumData.spt_blows_2 ? parseFloat(stratumData.spt_blows_2) : 0;
          const blows3 = stratumData.spt_blows_3 ? parseFloat(stratumData.spt_blows_3) : 0;
          nValue = (blows2 + blows3).toString();
        }

        // Preserve samples array from original row - schema validation doesn't include it
        // Samples are added during parsing and must be preserved
        const preservedSamples = row.samples || [];
        
        if (preservedSamples.length > 0) {
          logger.info(`Preserving ${preservedSamples.length} samples for stratum row ${rowNumber}`, {
            sampleCodes: preservedSamples.map((s: any) => s.sample_code || s.type).filter(Boolean)
          });
        }
        
        validatedStratumRows.push({
          ...stratumData,
          stratum_depth_from: parseFloat(stratumData.stratum_depth_from),
          stratum_depth_to: parseFloat(stratumData.stratum_depth_to),
          stratum_thickness_m: stratumData.stratum_thickness_m ? parseFloat(stratumData.stratum_thickness_m) : null,
          sample_event_depth_m: stratumData.sample_event_depth_m ? parseFloat(stratumData.sample_event_depth_m) : null,
          run_length_m: stratumData.run_length_m ? parseFloat(stratumData.run_length_m) : null,
          spt_blows_1: stratumData.spt_blows_1 ? parseFloat(stratumData.spt_blows_1) : null,
          spt_blows_2: stratumData.spt_blows_2 ? parseFloat(stratumData.spt_blows_2) : null,
          spt_blows_3: stratumData.spt_blows_3 ? parseFloat(stratumData.spt_blows_3) : null,
          n_value_is_2131: nValue,
          total_core_length_cm: stratumData.total_core_length_cm ? parseFloat(stratumData.total_core_length_cm) : null,
          tcr_percent: stratumData.tcr_percent ? parseFloat(stratumData.tcr_percent) : null,
          rqd_length_cm: stratumData.rqd_length_cm ? parseFloat(stratumData.rqd_length_cm) : null,
          rqd_percent: stratumData.rqd_percent ? parseFloat(stratumData.rqd_percent) : null,
          // CRITICAL: Preserve samples array from parsed data - DO NOT lose during validation
          samples: preservedSamples,
          borehole_diameter: stratumData.borehole_diameter ? parseFloat(stratumData.borehole_diameter) : null,
          is_subdivision: stratumData.is_subdivision ? stratumData.is_subdivision.toLowerCase() === 'true' || stratumData.is_subdivision === '1' : false
        });

      } catch (error) {
        logger.error(`Error processing stratum row ${rowNumber}:`, error);
        stratumErrors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Failed to process stratum row'
        });
      }
    }

    // Generate borelog_id upfront for S3 storage path
    const borelogId = uuidv4();
    
    // Create basic metadata.json immediately so borelog appears in listing
    const storageService = getStorageService();
    const createdAt = new Date().toISOString();
    const metadata = {
      borelog_id: borelogId,
      project_id: projectId,
      substructure_id: substructureId,
      structure_id: structureId,
      type: 'Geotechnical',
      created_at: createdAt,
      created_by_user_id: userId,
      latest_version: borelogData.version_number || 1,
      versions: [
        {
          version: borelogData.version_number || 1,
          status: 'PENDING_PARSING', // Will be updated by parser
          created_by: userId,
          created_at: createdAt,
          number: borelogData.job_code || null,
          msl: borelogData.msl || null,
          boring_method: borelogData.method_of_boring || null,
          hole_diameter: borelogData.diameter_of_hole ? parseFloat(borelogData.diameter_of_hole) : null,
          commencement_date: borelogData.commencement_date || null,
          completion_date: borelogData.completion_date || null,
          standing_water_level: borelogData.standing_water_level ? parseFloat(String(borelogData.standing_water_level)) : null,
          termination_depth: borelogData.termination_depth ? parseFloat(String(borelogData.termination_depth)) : null
        }
      ]
    };
    
    const metadataKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/metadata.json`;
    try {
      await storageService.uploadFile(
        Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'),
        metadataKey,
        'application/json',
        {
          project_id: projectId,
          structure_id: structureId,
          substructure_id: substructureId,
        }
      );
      logger.info(`Created metadata.json for borelog ${borelogId} at ${metadataKey}`);
    } catch (error) {
      logger.error('Error creating metadata.json:', error);
      // Continue - parser will create/update it later
    }
    
    // Store the CSV upload in pending status for approval
    logger.info(`Storing CSV upload in pending status with ${validatedStratumRows.length} stratum rows`);
    const pendingUpload = await storePendingCSVUpload(
      borelogData, 
      validatedStratumRows, 
      fileType, 
      userId,
      fileBuffer,
      fileName || `borelog_${Date.now()}.${fileType.toLowerCase()}`,
      borelogId
    );

    // Log validatedStratumRows before persisting to debug sample preservation
    const totalSamplesBeforePersist = validatedStratumRows.reduce((sum, r) => sum + (r.samples?.length || 0), 0);
    logger.info(`About to persist stratum data`, {
      validatedStratumRowsCount: validatedStratumRows.length,
      totalSamplesBeforePersist,
      samplesPerRow: validatedStratumRows.map(r => ({
        desc: r.stratum_description,
        sampleCount: r.samples?.length || 0,
        hasSamples: 'samples' in r,
        samples: r.samples || []
      }))
    });
    
    // Persist parsed stratum data immediately so it's available for getBorelogDetails
    await persistParsedStratumData(
      projectId,
      borelogId,
      pendingUpload.version_no,
      normalizedHeader,
      validatedStratumRows,
      borelogData,
      userId,
      pendingUpload.upload_id,
      fileType
    );

    await enqueueParserJob({
      projectId,
      borelogId,
      uploadId: pendingUpload.upload_id,
      csvKey: pendingUpload.csv_s3_key,
      versionNo: pendingUpload.version_no,
      fileType,
      requestedBy: userId,
    });
    
    const response = createResponse(201, {
      success: true,
      message: `CSV upload stored successfully and pending approval. ${validatedStratumRows.length} stratum layers validated. ${stratumErrors.length} stratum rows had errors.`,
      data: {
        upload_id: pendingUpload.upload_id,
        status: 'pending',
        job_code: borelogData.job_code,
        stratum_layers_validated: validatedStratumRows.length,
        stratum_errors: stratumErrors,
        summary: {
          total_stratum_rows: normalizedStratumRows.length,
          successful_stratum_layers: validatedStratumRows.length,
          failed_stratum_rows: stratumErrors.length
        },
        next_steps: 'Upload is pending approval by an Approval Engineer, Admin, or Project Manager'
      }
    });

    logResponse(response, 0);
    return response;

  } catch (error) {
    logger.error('Error uploading CSV:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to process CSV upload'
    });

    logResponse(response, 0);
    return response;
  }
};

// Helper function to store CSV upload in pending status for approval
// MIGRATED: Replaced database persistence with S3 storage
async function storePendingCSVUpload(
  borelogData: any, 
  _stratumRows: any[], // Not used here, passed to persistParsedStratumData separately
  fileType: string, 
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  borelogId: string
) {
  // Generate upload_id for API compatibility
  const uploadId = uuidv4();
  
  // Determine MIME type based on fileType
  const mimeType = fileType.toLowerCase() === 'csv' 
    ? 'text/csv' 
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  
  const versionNo = borelogData.version_number || 1;
  
  // Construct S3 key: projects/{project_id}/borelogs/{borelog_id}/versions/v{version_no}/uploads/csv/raw.csv
  const csvS3Key = `projects/${borelogData.project_id}/borelogs/${borelogId}/versions/v${versionNo}/uploads/csv/raw.csv`;
  
  // Upload CSV file to S3 (streaming via buffer - file already in memory from request)
  const storageService = getStorageService();
  try {
    await storageService.uploadFile(
      fileBuffer,
      csvS3Key,
      mimeType,
      {
        project_id: borelogData.project_id,
        structure_id: borelogData.structure_id,
        substructure_id: borelogData.substructure_id,
        file_type: fileType,
      }
    );
    logger.info('CSV file uploaded to S3', { csvS3Key, borelogId });
  } catch (error) {
    logger.error('Error uploading CSV to S3:', error);
    throw new Error(`Failed to upload CSV to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Write manifest.json in the same folder
  const manifest = {
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
    original_filename: fileName,
    version_no: versionNo,
    status: 'UPLOADED'
  };
  
  const manifestS3Key = `projects/${borelogData.project_id}/borelogs/${borelogId}/versions/v${versionNo}/uploads/csv/manifest.json`;
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
  
  try {
    await storageService.uploadFile(
      manifestBuffer,
      manifestS3Key,
      'application/json',
      {
        project_id: borelogData.project_id,
        structure_id: borelogData.structure_id,
        substructure_id: borelogData.substructure_id,
      }
    );
    logger.info('Manifest file uploaded to S3', { manifestS3Key });
  } catch (error) {
    logger.error('Error uploading manifest to S3:', error);
    throw new Error(`Failed to upload manifest to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    upload_id: uploadId,
    csv_s3_key: csvS3Key,
    manifest_s3_key: manifestS3Key,
    version_no: versionNo,
  };
} 

/**
 * Persist parsed stratum data to S3 so it's immediately available for getBorelogDetails API
 * Format matches what getBorelogDetailsByBorelogId expects
 */
async function persistParsedStratumData(
  projectId: string,
  borelogId: string,
  versionNo: number,
  header: any,
  stratumRows: any[],
  borelogData: any,
  userId: string,
  uploadId: string,
  fileType: string
): Promise<void> {
  try {
    const storageService = getStorageService();
    const parsedAt = new Date().toISOString();
    
    // Transform stratum rows to match expected format
    // Samples are already grouped per stratum - preserve ALL sample fields
    const strata = stratumRows.map((row) => {
      // Calculate thickness if not provided
      const depthFrom = row.stratum_depth_from ? parseFloat(String(row.stratum_depth_from)) : null;
      const depthTo = row.stratum_depth_to ? parseFloat(String(row.stratum_depth_to)) : null;
      const thickness = row.stratum_thickness_m 
        ? parseFloat(String(row.stratum_thickness_m)) 
        : (depthFrom !== null && depthTo !== null ? depthTo - depthFrom : null);
      
      // Preserve samples array - DO NOT reinitialize as empty
      // Use samples directly from row - they were preserved during validation
      const rawSamples = row.samples || [];
      
      logger.info(`Processing stratum samples for persist`, {
        stratumDescription: row.stratum_description,
        rawSamplesCount: rawSamples.length,
        rawSamples: rawSamples.length > 0 ? rawSamples.map((s: any) => ({
          type: s.type,
          sample_code: s.sample_code,
          depth_m: s.depth_m
        })) : [],
        rowHasSamples: 'samples' in row,
        rowKeys: Object.keys(row)
      });
      
      if (rawSamples.length === 0) {
        logger.warn(`No samples found for stratum: ${row.stratum_description}`, {
          rowKeys: Object.keys(row),
          hasSamplesKey: 'samples' in row,
          rowSampleValue: row.samples
        });
      }
      
      // Map all available sample fields to expected format
      const samples = rawSamples.map((sample: any) => {
        // Map sample fields - preserve all available data
        const mappedSample: any = {
          sample_code: sample.sample_code || null,
          sample_type: sample.sample_event_type || sample.type || null,
          depth_m: sample.sample_event_depth_m || sample.depth_m || null,
          remarks: sample.remarks || null,
        };
        
        // Include optional fields if present
        if (sample.n_value !== null && sample.n_value !== undefined) {
          mappedSample.n_value = typeof sample.n_value === 'string' ? parseFloat(sample.n_value) : sample.n_value;
        }
        if (sample.run_length_m !== null && sample.run_length_m !== undefined) {
          mappedSample.run_length_m = typeof sample.run_length_m === 'string' ? parseFloat(sample.run_length_m) : sample.run_length_m;
        }
        if (sample.penetration_15cm !== null && sample.penetration_15cm !== undefined) {
          mappedSample.spt_blows = sample.penetration_15cm;
        }
        if (sample.total_core_length_cm !== null && sample.total_core_length_cm !== undefined) {
          mappedSample.total_core_length_cm = typeof sample.total_core_length_cm === 'string' ? parseFloat(sample.total_core_length_cm) : sample.total_core_length_cm;
        }
        if (sample.tcr_percent !== null && sample.tcr_percent !== undefined) {
          mappedSample.tcr_percent = typeof sample.tcr_percent === 'string' ? parseFloat(sample.tcr_percent) : sample.tcr_percent;
        }
        if (sample.rqd_length_cm !== null && sample.rqd_length_cm !== undefined) {
          mappedSample.rqd_length_cm = typeof sample.rqd_length_cm === 'string' ? parseFloat(sample.rqd_length_cm) : sample.rqd_length_cm;
        }
        if (sample.rqd_percent !== null && sample.rqd_percent !== undefined) {
          mappedSample.rqd_percent = typeof sample.rqd_percent === 'string' ? parseFloat(sample.rqd_percent) : sample.rqd_percent;
        }
        
        return mappedSample;
      });
      
      const stratum: any = {
        description: row.stratum_description || '',
        depth_from: depthFrom,
        depth_to: depthTo,
        thickness_m: thickness,
        // Store stratum-level fields
        n_value: row.n_value_is_2131 ? (typeof row.n_value_is_2131 === 'string' ? parseFloat(row.n_value_is_2131) : row.n_value_is_2131) : null,
        tcr_percent: row.tcr_percent ? parseFloat(String(row.tcr_percent)) : null,
        rqd_percent: row.rqd_percent ? parseFloat(String(row.rqd_percent)) : null,
        return_water_colour: row.return_water_colour || null,
        water_loss: row.water_loss || null,
        borehole_diameter: row.borehole_diameter ? String(row.borehole_diameter) : null,
        remarks: row.remarks || null,
        // Include samples array - preserve all sample data
        samples: samples,
      };
      
      return stratum;
    });
    
    // Build metadata object from header
    const metadata: any = {
      project_name: header.project_name || borelogData.project_name || null,
      job_code: header.job_code || borelogData.job_code || null,
      chainage_km: header.chainage_km || borelogData.chainage_km || null,
      borehole_no: header.borehole_no || borelogData.borehole_no || null,
      msl: header.msl || borelogData.msl || null,
      method_of_boring: header.method_of_boring || borelogData.method_of_boring || null,
      diameter_of_hole: header.diameter_of_hole || borelogData.diameter_of_hole || null,
      section_name: header.section_name || borelogData.section_name || null,
      location: header.location || borelogData.location || null,
      coordinate_e: header.coordinate_e || borelogData.coordinate_e || null,
      coordinate_l: header.coordinate_l || borelogData.coordinate_l || null,
      commencement_date: header.commencement_date || borelogData.commencement_date || null,
      completion_date: header.completion_date || borelogData.completion_date || null,
      standing_water_level: header.standing_water_level || borelogData.standing_water_level || null,
      termination_depth: header.termination_depth || borelogData.termination_depth || null,
      permeability_tests_count: header.permeability_tests_count || borelogData.permeability_tests_count || null,
      spt_tests_count: header.spt_tests_count || borelogData.spt_tests_count || null,
      vs_tests_count: header.vs_tests_count || borelogData.vs_tests_count || null,
      undisturbed_samples_count: header.undisturbed_samples_count || borelogData.undisturbed_samples_count || null,
      disturbed_samples_count: header.disturbed_samples_count || borelogData.disturbed_samples_count || null,
      water_samples_count: header.water_samples_count || borelogData.water_samples_count || null,
      version_number: versionNo,
      status: 'draft',
      remarks: header.remarks || borelogData.remarks || null,
    };
    
    // Format to match what getBorelogDetailsByBorelogId expects
    const parsedData = {
      borehole: {
        project_id: projectId,
        structure_id: borelogData.structure_id,
        substructure_id: borelogData.substructure_id,
        borelog_id: borelogId,
        version_no: versionNo,
        upload_id: uploadId,
        file_type: fileType,
        requested_by: userId,
        job_code: metadata.job_code,
        metadata: metadata,
        parsed_at: parsedAt,
      },
      strata: strata,
    };
    
    // Write to S3 at the path getBorelogDetailsByBorelogId expects
    const strataKey = `projects/project_${projectId}/borelogs/borelog_${borelogId}/parsed/v${versionNo}/strata.json`;
    const strataBuffer = Buffer.from(JSON.stringify(parsedData, null, 2), 'utf-8');
    
    await storageService.uploadFile(
      strataBuffer,
      strataKey,
      'application/json',
      {
        project_id: projectId,
        structure_id: borelogData.structure_id,
        substructure_id: borelogData.substructure_id,
      }
    );
    
    // Calculate total samples for logging
    const totalSamples = strata.reduce((sum, s) => sum + (s.samples?.length || 0), 0);
    const samplesPerStratum = strata.map(s => ({ 
      description: s.description, 
      sampleCount: s.samples?.length || 0,
      samples: s.samples || []
    }));
    
    logger.info(`Persisted parsed stratum data to ${strataKey}`, {
      strataCount: strata.length,
      totalSamples,
      samplesPerStratum,
      firstStratumSamples: strata[0]?.samples || []
    });
    
    if (totalSamples === 0) {
      logger.error(`CRITICAL: No samples persisted to ${strataKey}`, {
        strataCount: strata.length,
        allStratumSamples: strata.map(s => ({ 
          desc: s.description, 
          samples: s.samples,
          samplesLength: s.samples?.length 
        })),
        inputStratumRowsSampleCount: stratumRows.map(r => ({ 
          desc: r.stratum_description, 
          samplesCount: r.samples?.length || 0,
          hasSamples: 'samples' in r
        }))
      });
    }
  } catch (error) {
    logger.error('Error persisting parsed stratum data:', error);
    // Don't throw - upload should still succeed even if parsed data write fails
    // The Python parser will create it later
  }
}

async function enqueueParserJob(input: {
  projectId: string;
  borelogId: string;
  uploadId: string;
  csvKey?: string;
  versionNo: number;
  fileType: string;
  requestedBy: string;
}) {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    logger.warn('Skipping parser Lambda invocation because S3_BUCKET_NAME is not configured');
    return;
  }

  const csvKey = input.csvKey;
  if (!csvKey) {
    logger.warn('Skipping parser Lambda invocation because CSV key is missing', {
      borelogId: input.borelogId,
      uploadId: input.uploadId
    });
    return;
  }

  await invokeBorelogParserLambda({
    bucket,
    csvKey,
    project_id: input.projectId,
    borelog_id: input.borelogId,
    upload_id: input.uploadId,
    version_no: input.versionNo || 1,
    fileType: input.fileType,
    requestedBy: input.requestedBy,
  });
}