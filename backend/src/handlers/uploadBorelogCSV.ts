import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { checkRole, validateToken } from '../utils/validateInput';
import { logger, logRequest, logResponse } from '../utils/logger';
import { createResponse } from '../types/common';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import * as db from '../db';
import * as ExcelJS from 'exceljs';

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

// Helper function to parse Excel files with specific borelog format
async function parseExcelFile(fileBuffer: Buffer): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.getWorksheet(1); // Get first worksheet
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }
  
  logger.info(`Excel worksheet dimensions: ${worksheet.rowCount} rows, ${worksheet.columnCount} columns`);
  
  // Extract all rows first to analyze the structure
  const allRows: any[][] = [];
  worksheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
    const rowValues: any[] = [];
    row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
      let value = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'text' in cell.value) {
          value = (cell.value as any).text;
        } else if (cell.value instanceof Date) {
          // Convert Excel date to DD.MM.YY format
          const day = cell.value.getDate().toString().padStart(2, '0');
          const month = (cell.value.getMonth() + 1).toString().padStart(2, '0');
          const year = cell.value.getFullYear().toString().slice(-2);
          value = `${day}.${month}.${year}`;
        } else {
          value = String(cell.value);
        }
      }
      rowValues[colNumber - 1] = value;
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
      const cellValue = String(row[j] || '').trim();
      if (cellValue.includes('Description of Soil Stratum & Rock Methodology')) {
        headerRowIndex = i;
        headerRow = row.map(cell => String(cell || '').trim());
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
      const cellValue = String(row[j] || '').trim();
      
      // Extract Job Code
      if (cellValue === 'Job Code' && j + 1 < row.length) {
        borelogHeader.job_code = String(row[j + 1] || '').trim();
      }
      
      // Extract Section Name
      if (cellValue === 'Section Name' && j + 1 < row.length) {
        borelogHeader.section_name = String(row[j + 1] || '').trim();
      }
      
      // Extract Chainage
      if (cellValue === 'Chainage (Km)' && j + 1 < row.length) {
        borelogHeader.chainage_km = String(row[j + 1] || '').trim();
      }
      
      // Extract Location
      if (cellValue === 'Location' && j + 1 < row.length) {
        borelogHeader.location = String(row[j + 1] || '').trim();
      }
      
      // Extract Borehole No
      if (cellValue === 'Borehole No.' && j + 1 < row.length) {
        borelogHeader.borehole_no = String(row[j + 1] || '').trim();
      }
      
      // Extract Commencement Date
      if (cellValue === 'Commencement Date' && j + 1 < row.length) {
        borelogHeader.commencement_date = String(row[j + 1] || '').trim();
      }
      
      // Extract MSL
      if (cellValue === 'Mean Sea Level (MSL)' && j + 1 < row.length) {
        borelogHeader.msl = String(row[j + 1] || '').trim();
      }
      
      // Extract Completion Date
      if (cellValue === 'Completion Date' && j + 1 < row.length) {
        borelogHeader.completion_date = String(row[j + 1] || '').trim();
      }
      
      // Extract Method of Boring
      if (cellValue === 'Method of Boring / Drilling' && j + 1 < row.length) {
        borelogHeader.method_of_boring = String(row[j + 1] || '').trim();
      }
      
      // Extract Diameter of Hole
      if (cellValue === 'Diameter of Hole' && j + 1 < row.length) {
        borelogHeader.diameter_of_hole = String(row[j + 1] || '').trim();
      }
      
      // Extract Standing Water Level
      if (cellValue === 'Standing Water Level' && j + 1 < row.length) {
        borelogHeader.standing_water_level = String(row[j + 1] || '').trim();
      }
      
      // Extract Termination Depth
      if (cellValue === 'Termination Depth' && j + 1 < row.length) {
        borelogHeader.termination_depth = String(row[j + 1] || '').trim();
      }
      
      // Extract test counts
      if (cellValue.includes('No. of Permeabilty test') && j + 1 < row.length) {
        borelogHeader.permeability_tests_count = String(row[j + 1] || '').trim();
      }
      
      if (cellValue.includes('No. of SP test') && j + 1 < row.length) {
        const spValue = String(row[j + 1] || '').trim();
        borelogHeader.spt_tests_count = spValue;
      }
      
      if (cellValue.includes('No. of Undisturbed Sample') && j + 1 < row.length) {
        borelogHeader.undisturbed_samples_count = String(row[j + 1] || '').trim();
      }
      
      if (cellValue.includes('No. of Disturbed Sample') && j + 1 < row.length) {
        borelogHeader.disturbed_samples_count = String(row[j + 1] || '').trim();
      }
      
      if (cellValue.includes('No. of Water Sample') && j + 1 < row.length) {
        borelogHeader.water_samples_count = String(row[j + 1] || '').trim();
      }
    }
  }
  
  logger.info('Extracted borelog header:', borelogHeader);
  
     // Extract stratum data rows
   const stratumRows: any[] = [];
   
   // Find SPT blows column indices
   const sptBlowsColumns: number[] = [];
   for (let j = 0; j < headerRow.length; j++) {
     const header = headerRow[j];
     if (header && header.includes('Standard Penetration Test') && header.includes('15 cm')) {
       sptBlowsColumns.push(j);
     }
   }
   logger.info(`Found ${sptBlowsColumns.length} SPT blows columns at indices:`, sptBlowsColumns);
   
   for (let i = headerRowIndex + 1; i < allRows.length; i++) {
     const row = allRows[i];
     if (row.length === 0 || row.every(cell => !cell || String(cell).trim() === '')) {
       continue; // Skip empty rows
     }
     
     const rowData: any = {};
     
     // Map columns based on the header row
     for (let j = 0; j < Math.min(row.length, headerRow.length); j++) {
       const header = headerRow[j];
       const value = String(row[j] || '').trim();
       
       if (header && value) {
         // Map specific columns to our schema
         if (header.includes('Description of Soil Stratum')) {
           rowData.stratum_description = value;
         } else if (header.includes('Depth of Stratum') && header.includes('From')) {
           rowData.stratum_depth_from = value;
         } else if (header.includes('Depth of Stratum') && header.includes('To')) {
           rowData.stratum_depth_to = value;
         } else if (header.includes('Thickness of Stratum')) {
           rowData.stratum_thickness_m = value;
         } else if (header.includes('Sample / Event') && header.includes('Type')) {
           rowData.sample_event_type = value;
         } else if (header.includes('Sample / Event') && header.includes('Depth')) {
           rowData.sample_event_depth_m = value;
         } else if (header.includes('Run Length')) {
           rowData.run_length_m = value;
         } else if (header.includes('N - Value')) {
           rowData.n_value_is_2131 = value;
         } else if (header.includes('Total Core Length')) {
           rowData.total_core_length_cm = value;
         } else if (header.includes('TCR (%)')) {
           rowData.tcr_percent = value;
         } else if (header.includes('RQD Length')) {
           rowData.rqd_length_cm = value;
         } else if (header.includes('RQD (%)')) {
           rowData.rqd_percent = value;
         } else if (header.includes('Colour of return water')) {
           rowData.return_water_colour = value;
         } else if (header.includes('Water loss')) {
           rowData.water_loss = value;
         } else if (header.includes('Diameter of Bore hole')) {
           rowData.borehole_diameter = value;
         } else if (header.includes('Remarks')) {
           rowData.remarks = value;
         }
       }
     }
     
     // Handle SPT blows columns separately
     if (sptBlowsColumns.length >= 1) {
       rowData.spt_blows_1 = String(row[sptBlowsColumns[0]] || '').trim();
     }
     if (sptBlowsColumns.length >= 2) {
       rowData.spt_blows_2 = String(row[sptBlowsColumns[1]] || '').trim();
     }
     if (sptBlowsColumns.length >= 3) {
       rowData.spt_blows_3 = String(row[sptBlowsColumns[2]] || '').trim();
     }
     
     // Only add rows that have stratum description (actual data rows)
     if (rowData.stratum_description && rowData.stratum_depth_from && rowData.stratum_depth_to) {
       stratumRows.push(rowData);
     }
   }
  
  logger.info(`Extracted ${stratumRows.length} stratum rows`);
  
  // Return the borelog header as the first row, followed by stratum rows
  return [borelogHeader, ...stratumRows];
}

// Helper function to parse borelog template format (specific to the provided template)
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
    for (let j = 0; j < row.length; j++) {
      const cellValue = row[j];
      
      // Extract Job Code
      if (cellValue === 'Job Code' && j + 1 < row.length) {
        header.job_code = row[j + 1];
        logger.info(`Found job_code: ${header.job_code}`);
      }
      
      // Extract Section Name
      if (cellValue === 'Section Name' && j + 1 < row.length) {
        header.section_name = row[j + 1];
        logger.info(`Found section_name: ${header.section_name}`);
      }
      
      // Extract Chainage
      if (cellValue === 'Chainage (Km)' && j + 1 < row.length) {
        header.chainage_km = row[j + 1];
        logger.info(`Found chainage_km: ${header.chainage_km}`);
      }
      
      // Extract Location
      if (cellValue === 'Location' && j + 1 < row.length) {
        header.location = row[j + 1];
        logger.info(`Found location: ${header.location}`);
      }
      
      // Extract Borehole No
      if (cellValue === 'Borehole No.' && j + 1 < row.length) {
        header.borehole_no = row[j + 1];
        logger.info(`Found borehole_no: ${header.borehole_no}`);
      }
      
      // Extract Commencement Date
      if (cellValue === 'Commencement Date' && j + 1 < row.length) {
        header.commencement_date = row[j + 1];
        logger.info(`Found commencement_date: ${header.commencement_date}`);
      }
      
      // Extract MSL
      if (cellValue === 'Mean Sea Level (MSL)' && j + 1 < row.length) {
        header.msl = row[j + 1];
        logger.info(`Found msl: ${header.msl}`);
      }
      
      // Extract Completion Date
      if (cellValue === 'Completion Date' && j + 1 < row.length) {
        header.completion_date = row[j + 1];
        logger.info(`Found completion_date: ${header.completion_date}`);
      }
      
      // Extract Method of Boring
      if (cellValue === 'Method of Boring / Drilling' && j + 1 < row.length) {
        header.method_of_boring = row[j + 1];
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
    const description = columnMap.description !== undefined ? row[columnMap.description] : '';
    const depthFrom = columnMap.depth_from !== undefined ? row[columnMap.depth_from] : '';
    const depthTo = columnMap.depth_to !== undefined ? row[columnMap.depth_to] : '';
    
    if (description && depthFrom && depthTo) {
      // This is a new stratum layer
      if (currentStratum) {
        stratumData.push(currentStratum);
      }
      
      currentStratum = {
        stratum_description: description,
        stratum_depth_from: depthFrom,
        stratum_depth_to: depthTo,
        stratum_thickness_m: columnMap.thickness !== undefined ? row[columnMap.thickness] : '',
        return_water_colour: columnMap.return_water_colour !== undefined ? row[columnMap.return_water_colour] : '',
        water_loss: columnMap.water_loss !== undefined ? row[columnMap.water_loss] : '',
        borehole_diameter: columnMap.borehole_diameter !== undefined ? row[columnMap.borehole_diameter] : '',
        remarks: columnMap.remarks !== undefined ? row[columnMap.remarks] : '',
        samples: []
      };
      
      logger.info(`Created new stratum: ${description} (${depthFrom}-${depthTo}m)`);
    } else if (currentStratum) {
      // This is a sample point within the current stratum
      const sampleType = columnMap.sample_type !== undefined ? row[columnMap.sample_type] : '';
      const sampleDepth = columnMap.sample_depth !== undefined ? row[columnMap.sample_depth] : '';
      
      if (sampleType && sampleDepth) {
        const sample = {
          sample_event_type: sampleType,
          sample_event_depth_m: sampleDepth,
          run_length_m: columnMap.run_length !== undefined ? row[columnMap.run_length] : '',
          spt_blows_1: columnMap.spt_blows !== undefined ? row[columnMap.spt_blows] : '',
          spt_blows_2: '',
          spt_blows_3: '',
          n_value_is_2131: columnMap.n_value !== undefined ? row[columnMap.n_value] : '',
          total_core_length_cm: columnMap.total_core_length !== undefined ? row[columnMap.total_core_length] : '',
          tcr_percent: columnMap.tcr_percent !== undefined ? row[columnMap.tcr_percent] : '',
          rqd_length_cm: columnMap.rqd_length !== undefined ? row[columnMap.rqd_length] : '',
          rqd_percent: columnMap.rqd_percent !== undefined ? row[columnMap.rqd_percent] : '',
          remarks: columnMap.remarks !== undefined ? row[columnMap.remarks] : ''
        };
        
        currentStratum.samples.push(sample);
        logger.info(`Added sample: ${sampleType} at ${sampleDepth}m`);
      }
    }
  }
  
  // Add the last stratum if it exists
  if (currentStratum) {
    stratumData.push(currentStratum);
  }
  
  logger.info(`Extracted ${stratumData.length} stratum layers with samples`);
  
  return { header, stratumData };
}

// Helper function to detect file type and parse accordingly
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
  } else if (fileType.toLowerCase() === 'xlsx' || fileType.toLowerCase() === 'xls') {
    logger.info('Parsing as Excel...');
    // Convert base64 to buffer for Excel files
    const buffer = Buffer.from(fileData, 'base64');
    const result = await parseExcelFile(buffer);
    logger.info(`Excel parsing result: ${result.length} rows`);
    return result;
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
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

    // Parse and validate request body
    if (!event.body) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing request body',
        error: 'Request body is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

         const requestBody = JSON.parse(event.body);
     const { csvData, fileType = 'csv', projectId, structureId, substructureId } = requestBody;

    logger.info('Request body parsed:', {
      hasCsvData: !!csvData,
      csvDataLength: csvData ? csvData.length : 0,
      fileType: fileType,
      requestBodyKeys: Object.keys(requestBody)
    });

    if (!csvData) {
      const response = createResponse(400, {
        success: false,
        message: 'Missing required fields',
        error: 'csvData is required'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

    // Parse file data (CSV or Excel)
    let parsedData;
    try {
      logger.info(`Parsing ${fileType.toUpperCase()} data...`);
      logger.info('Raw data (first 500 chars):', csvData.substring(0, 500));
      logger.info('File type detected:', fileType);
      logger.info('Raw data length:', csvData.length);
      
      // Check if the data looks like CSV or base64
      const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(csvData);
      logger.info('Data appears to be base64:', isBase64);
      
      parsedData = await parseFileData(csvData, fileType);
      
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
            const fallbackResult = parse(csvData, {
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

    // First row contains borelog header information
    const headerRow = parsedData[0];
    const stratumRows = parsedData.slice(1); // Remaining rows are stratum data

    try {
      // Validate header row with borelog schema
      const headerValidation = BorelogHeaderSchema.safeParse(headerRow);
      if (!headerValidation.success) {
        logger.error('Header validation failed:', {
          availableColumns: Object.keys(headerRow as any),
          expectedColumns: Object.keys(BorelogHeaderSchema.shape),
          validationErrors: headerValidation.error.errors
        });
        
        const response = createResponse(400, {
          success: false,
          message: 'Invalid borelog header data',
          error: 'First row contains invalid borelog information',
          data: {
            errors: headerValidation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
            availableColumns: Object.keys(headerRow as any)
          }
        });
        logResponse(response, Date.now() - startTime);
        return response;
      }

             const headerData = headerValidation.data;
       logger.info('Processing borelog header:', { 
         job_code: headerData.job_code,
         project_id: projectId 
       });

       // Convert header string values to appropriate types
                 const borelogData = {
         project_id: projectId,
         structure_id: structureId,
         substructure_id: substructureId,
         borehole_id: undefined, // Will be created from CSV data
        project_name: headerData.project_name,
        job_code: headerData.job_code,
        chainage_km: headerData.chainage_km ? parseFloat(headerData.chainage_km) : null,
        borehole_no: headerData.borehole_no,
        msl: headerData.msl ? parseFloat(headerData.msl) : null,
        method_of_boring: headerData.method_of_boring,
        diameter_of_hole: headerData.diameter_of_hole,
        section_name: headerData.section_name,
        location: headerData.location,
        coordinate_e: headerData.coordinate_e,
        coordinate_l: headerData.coordinate_l,
        commencement_date: headerData.commencement_date,
        completion_date: headerData.completion_date,
        standing_water_level: headerData.standing_water_level ? parseFloat(headerData.standing_water_level) : null,
        termination_depth: headerData.termination_depth ? parseFloat(headerData.termination_depth) : null,
        permeability_tests_count: headerData.permeability_tests_count ? parseInt(headerData.permeability_tests_count) : 0,
        spt_tests_count: headerData.spt_tests_count ? parseInt(headerData.spt_tests_count) : 0,
        vs_tests_count: headerData.vs_tests_count ? parseInt(headerData.vs_tests_count) : 0,
        undisturbed_samples_count: headerData.undisturbed_samples_count ? parseInt(headerData.undisturbed_samples_count) : 0,
        disturbed_samples_count: headerData.disturbed_samples_count ? parseInt(headerData.disturbed_samples_count) : 0,
        water_samples_count: headerData.water_samples_count ? parseInt(headerData.water_samples_count) : 0,
        version_number: headerData.version_number ? parseInt(headerData.version_number) : 1,
        status: mapStatusValue(headerData.status),
        edited_by: headerData.edited_by || (await payload).userId,
        editor_name: headerData.editor_name,
        remarks: headerData.remarks,
          created_by_user_id: (await payload).userId
        };

        // Validate foreign keys before attempting to create
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

      // Validate stratum rows
      const stratumErrors = [];
      const validatedStratumRows = [];

      for (let i = 0; i < stratumRows.length; i++) {
        const row = stratumRows[i];
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

      // Create the borelog with all stratum data
      logger.info(`Creating borelog with ${validatedStratumRows.length} stratum rows`);
      const createdBorelog = await createBorelogFromCSV(borelogData, validatedStratumRows);
    
    const response = createResponse(201, {
      success: true,
        message: `Borelog created successfully with ${validatedStratumRows.length} stratum layers. ${stratumErrors.length} stratum rows had errors.`,
      data: {
          borelog_id: createdBorelog.borelog_id,
          submission_id: createdBorelog.submission_id,
          job_code: borelogData.job_code,
          stratum_layers_created: validatedStratumRows.length,
          stratum_errors: stratumErrors,
        summary: {
            total_stratum_rows: stratumRows.length,
            successful_stratum_layers: validatedStratumRows.length,
            failed_stratum_rows: stratumErrors.length
        }
      }
    });

    logResponse(response, Date.now() - startTime);
    return response;

    } catch (error) {
      logger.error('Error creating borelog:', error);
      const response = createResponse(500, {
        success: false,
        message: 'Failed to create borelog',
        error: error instanceof Error ? error.message : 'Internal server error'
      });
      logResponse(response, Date.now() - startTime);
      return response;
    }

  } catch (error) {
    logger.error('Error uploading CSV:', error);
    
    const response = createResponse(500, {
      success: false,
      message: 'Internal server error',
      error: 'Failed to process CSV upload'
    });

    logResponse(response, Date.now() - startTime);
    return response;
  }
};

// Helper function to create borelog from CSV data with multiple stratum layers
async function createBorelogFromCSV(borelogData: any, stratumRows: any[]) {
  const pool = await db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create a borehole first if it doesn't exist
    let borehole_id: string;
    const existingBoreholeResult = await client.query(
      `SELECT borehole_id FROM borehole 
       WHERE project_id = $1 AND structure_id = $2 AND borehole_number = $3`,
      [borelogData.project_id, borelogData.structure_id, borelogData.borehole_no || borelogData.job_code]
    );

    if (existingBoreholeResult.rows.length > 0) {
      borehole_id = existingBoreholeResult.rows[0].borehole_id;
      logger.info('Using existing borehole:', borehole_id);
    } else {
      // Create new borehole
      const newBoreholeResult = await client.query(
        `INSERT INTO borehole (borehole_id, project_id, structure_id, borehole_number, location, created_by_user_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         RETURNING borehole_id`,
        [
          borelogData.project_id,
          borelogData.structure_id,
          borelogData.borehole_no || borelogData.job_code,
          borelogData.location || 'Location from CSV',
          borelogData.created_by_user_id
        ]
      );
      borehole_id = newBoreholeResult.rows[0].borehole_id;
      logger.info('Created new borehole:', borehole_id);
    }

    // Create the main borelog record
    const borelogResult = await client.query(
      `INSERT INTO boreloge (borelog_id, substructure_id, project_id, type, created_by_user_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING borelog_id`,
      [borelogData.substructure_id, borelogData.project_id, 'Geotechnical', borelogData.created_by_user_id]
    );

    const borelog_id = borelogResult.rows[0].borelog_id;

    // Create borelog details with header information
    const detailsResult = await client.query(
      `INSERT INTO borelog_details (
        borelog_id, version_no, number, msl, boring_method, hole_diameter,
        commencement_date, completion_date, standing_water_level, termination_depth,
        permeability_test_count, spt_vs_test_count, undisturbed_sample_count,
        disturbed_sample_count, water_sample_count, remarks, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING borelog_id`,
      [
        borelog_id,
        borelogData.version_number,
        borelogData.job_code, // Use job_code as the number
        borelogData.msl?.toString(),
        borelogData.method_of_boring,
        parseFloat(borelogData.diameter_of_hole),
        borelogData.commencement_date,
        borelogData.completion_date,
        borelogData.standing_water_level,
        borelogData.termination_depth,
        borelogData.permeability_tests_count?.toString(),
        `${borelogData.spt_tests_count}&${borelogData.vs_tests_count}`,
        borelogData.undisturbed_samples_count?.toString(),
        borelogData.disturbed_samples_count?.toString(),
        borelogData.water_samples_count?.toString(),
        borelogData.remarks,
        borelogData.created_by_user_id
      ]
    );

    // Create stratum records for each stratum row
    const stratumIds: string[] = [];
    for (const stratum of stratumRows) {
      const stratumResult = await client.query(
        `INSERT INTO stratum (
          stratum_id, borelog_id, description, depth_from, depth_to, thickness_m,
          sample_event_type, sample_event_depth_m, run_length_m, spt_blows_per_15cm,
          n_value_is_2131, total_core_length_cm, tcr_percent, rqd_length_cm, rqd_percent,
          return_water_colour, water_loss, borehole_diameter, remarks, is_subdivision,
          parent_stratum_id, created_by_user_id
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING stratum_id`,
        [
          borelog_id,
          stratum.stratum_description,
          stratum.stratum_depth_from,
          stratum.stratum_depth_to,
          stratum.stratum_thickness_m,
          stratum.sample_event_type,
          stratum.sample_event_depth_m,
          stratum.run_length_m,
          // Store SPT blows as JSON string for all three values
          JSON.stringify({
            blows_1: stratum.spt_blows_1,
            blows_2: stratum.spt_blows_2,
            blows_3: stratum.spt_blows_3
          }),
          stratum.n_value_is_2131,
          stratum.total_core_length_cm,
          stratum.tcr_percent,
          stratum.rqd_length_cm,
          stratum.rqd_percent,
          stratum.return_water_colour,
          stratum.water_loss,
          stratum.borehole_diameter,
          stratum.remarks,
          stratum.is_subdivision,
          stratum.parent_row_id ? stratumIds[parseInt(stratum.parent_row_id)] : null,
          borelogData.created_by_user_id
        ]
      );
      stratumIds.push(stratumResult.rows[0].stratum_id);
    }

         // Create borelog submission record for version control
     const submissionResult = await client.query(
       `INSERT INTO borelog_submissions (
         project_id, structure_id, borehole_id, version_number, edited_by,
         form_data, status, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING submission_id`,
       [
         borelogData.project_id,
         borelogData.structure_id,
         borehole_id,
        borelogData.version_number,
        borelogData.edited_by,
        JSON.stringify({
          rows: [
            {
              id: 'header',
              fields: [
                { id: 'project_name', name: 'Project Name', value: borelogData.project_name, fieldType: 'manual', isRequired: false },
                { id: 'job_code', name: 'Job Code', value: borelogData.job_code, fieldType: 'manual', isRequired: true },
                { id: 'chainage_km', name: 'Chainage (Km)', value: borelogData.chainage_km, fieldType: 'manual', isRequired: false },
                { id: 'borehole_no', name: 'Borehole No.', value: borelogData.borehole_no, fieldType: 'manual', isRequired: false },
                { id: 'msl', name: 'MSL', value: borelogData.msl, fieldType: 'manual', isRequired: false },
                { id: 'method_of_boring', name: 'Method of Boring', value: borelogData.method_of_boring, fieldType: 'manual', isRequired: true },
                { id: 'diameter_of_hole', name: 'Diameter of Hole', value: borelogData.diameter_of_hole, fieldType: 'manual', isRequired: true },
                { id: 'section_name', name: 'Section Name', value: borelogData.section_name, fieldType: 'manual', isRequired: true },
                { id: 'location', name: 'Location', value: borelogData.location, fieldType: 'manual', isRequired: true },
                { id: 'coordinate_e', name: 'Coordinate E', value: borelogData.coordinate_e, fieldType: 'manual', isRequired: false },
                { id: 'coordinate_l', name: 'Coordinate L', value: borelogData.coordinate_l, fieldType: 'manual', isRequired: false },
                { id: 'commencement_date', name: 'Commencement Date', value: borelogData.commencement_date, fieldType: 'manual', isRequired: true },
                { id: 'completion_date', name: 'Completion Date', value: borelogData.completion_date, fieldType: 'manual', isRequired: true },
                { id: 'standing_water_level', name: 'Standing Water Level', value: borelogData.standing_water_level, fieldType: 'manual', isRequired: false },
                { id: 'termination_depth', name: 'Termination Depth', value: borelogData.termination_depth, fieldType: 'manual', isRequired: false },
                { id: 'remarks', name: 'Remarks', value: borelogData.remarks, fieldType: 'manual', isRequired: false }
              ],
              description: 'Borelog header information'
            },
            ...stratumRows.map((stratum, index) => ({
              id: `stratum_${index}`,
              fields: [
                { id: 'stratum_description', name: 'Description of Soil Stratum & Rock Methodology', value: stratum.stratum_description, fieldType: 'manual', isRequired: true },
                { id: 'stratum_depth_from', name: 'Depth From (m)', value: stratum.stratum_depth_from, fieldType: 'manual', isRequired: true },
                { id: 'stratum_depth_to', name: 'Depth To (m)', value: stratum.stratum_depth_to, fieldType: 'manual', isRequired: true },
                { id: 'stratum_thickness_m', name: 'Thickness (m)', value: stratum.stratum_thickness_m, fieldType: 'calculated', isRequired: false },
                { id: 'sample_event_type', name: 'Sample/Event Type', value: stratum.sample_event_type, fieldType: 'manual', isRequired: false },
                { id: 'sample_event_depth_m', name: 'Sample/Event Depth (m)', value: stratum.sample_event_depth_m, fieldType: 'manual', isRequired: false },
                { id: 'run_length_m', name: 'Run Length (m)', value: stratum.run_length_m, fieldType: 'manual', isRequired: false },
                { id: 'spt_blows_1', name: 'SPT Blows 1', value: stratum.spt_blows_1, fieldType: 'manual', isRequired: false },
                { id: 'spt_blows_2', name: 'SPT Blows 2', value: stratum.spt_blows_2, fieldType: 'manual', isRequired: false },
                { id: 'spt_blows_3', name: 'SPT Blows 3', value: stratum.spt_blows_3, fieldType: 'manual', isRequired: false },
                { id: 'n_value_is_2131', name: 'N-Value (IS-2131)', value: stratum.n_value_is_2131, fieldType: 'calculated', isRequired: false },
                { id: 'total_core_length_cm', name: 'Total Core Length (cm)', value: stratum.total_core_length_cm, fieldType: 'manual', isRequired: false },
                { id: 'tcr_percent', name: 'TCR (%)', value: stratum.tcr_percent, fieldType: 'manual', isRequired: false },
                { id: 'rqd_length_cm', name: 'RQD Length (cm)', value: stratum.rqd_length_cm, fieldType: 'manual', isRequired: false },
                { id: 'rqd_percent', name: 'RQD (%)', value: stratum.rqd_percent, fieldType: 'manual', isRequired: false },
                { id: 'return_water_colour', name: 'Colour of Return Water', value: stratum.return_water_colour, fieldType: 'manual', isRequired: false },
                { id: 'water_loss', name: 'Water Loss', value: stratum.water_loss, fieldType: 'manual', isRequired: false },
                { id: 'borehole_diameter', name: 'Diameter of Borehole', value: stratum.borehole_diameter, fieldType: 'manual', isRequired: false },
                { id: 'remarks', name: 'Remarks', value: stratum.remarks, fieldType: 'manual', isRequired: false }
              ],
              description: `Stratum layer ${index + 1}`,
              isSubdivision: stratum.is_subdivision,
              parentRowId: stratum.parent_row_id
            }))
          ],
          metadata: {
            project_name: borelogData.project_name || borelogData.job_code,
            borehole_number: borelogData.borehole_no || borelogData.job_code,
            commencement_date: borelogData.commencement_date,
            completion_date: borelogData.completion_date,
            standing_water_level: borelogData.standing_water_level,
            termination_depth: borelogData.termination_depth
          }
        }),
        borelogData.status,
        borelogData.created_by_user_id
      ]
    );

    await client.query('COMMIT');

    return {
      borelog_id,
      submission_id: submissionResult.rows[0].submission_id,
      version_no: borelogData.version_number,
      status: 'created',
      stratum_layers_created: stratumRows.length
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} 
