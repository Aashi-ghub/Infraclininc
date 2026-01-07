import { 
  BoreholeCsvData, 
  BoreholeMetadata, 
  SoilLayer, 
  SampleRemark, 
  CoreQuality
} from '../types/boreholeCsv';

export class BoreholeCsvParser {
  private lines: string[] = [];

  constructor(csvContent: string) {
    this.lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }

  /**
   * Main parsing method that processes the entire CSV content
   */
  public async parse(): Promise<BoreholeCsvData> {
    try {
      const metadata = this.parseMetadata();
      const layers = this.parseSoilLayers();
      const remarks = this.parseRemarks();
      const coreQuality = this.parseCoreQuality();

      return {
        metadata,
        layers,
        remarks,
        core_quality: coreQuality
      };
    } catch (error) {
      throw new Error(`Failed to parse borehole CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse metadata section (lines before "Description of Soil Stratum")
   */
  private parseMetadata(): BoreholeMetadata {
    const metadata: Partial<BoreholeMetadata> = {
      project_name: '',
      client_address: '',
      website: '',
      job_code: '',
      section_name: null,
      chainage_km: null,
      location: '',
      borehole_no: null,
      commencement_date: '',
      completion_date: '',
      mean_sea_level: null,
      method_of_boring: '',
      diameter_of_hole: '',
      termination_depth: '',
      standing_water_level: '',
      coordinates: { E: null, L: null },
      lab_tests: {
        permeability_tests: 0,
        sp_vs_tests: 0,
        spt_tests: 0,
        vs_tests: 0,
        undisturbed_samples: 0,
        disturbed_samples: '',
        water_samples: 0
      }
    };

    let i = 0;
    while (i < this.lines.length && !this.isLayerDataStart(this.lines[i])) {
      const line = this.lines[i];
      
      if (line.includes('Project Name:')) {
        metadata.project_name = this.extractValue(line, 'Project Name:');
      } else if (line.includes('Client Address:')) {
        metadata.client_address = this.extractValue(line, 'Client Address:');
      } else if (line.includes('Website:')) {
        metadata.website = this.extractValue(line, 'Website:');
      } else if (line.includes('Job Code:')) {
        metadata.job_code = this.extractValue(line, 'Job Code:');
      } else if (line.includes('Section Name:')) {
        metadata.section_name = this.extractValue(line, 'Section Name:') || null;
      } else if (line.includes('Chainage (km):')) {
        metadata.chainage_km = this.parseNumber(this.extractValue(line, 'Chainage (km):'));
      } else if (line.includes('Location:')) {
        metadata.location = this.extractValue(line, 'Location:');
      } else if (line.includes('Borehole No.:')) {
        metadata.borehole_no = this.extractValue(line, 'Borehole No.:') || null;
      } else if (line.includes('Commencement Date:')) {
        metadata.commencement_date = this.extractValue(line, 'Commencement Date:');
      } else if (line.includes('Completion Date:')) {
        metadata.completion_date = this.extractValue(line, 'Completion Date:');
      } else if (line.includes('Mean Sea Level:')) {
        metadata.mean_sea_level = this.parseNumber(this.extractValue(line, 'Mean Sea Level:'));
      } else if (line.includes('Method of Boring:')) {
        metadata.method_of_boring = this.extractValue(line, 'Method of Boring:');
      } else if (line.includes('Diameter of Hole:')) {
        metadata.diameter_of_hole = this.extractValue(line, 'Diameter of Hole:');
      } else if (line.includes('Termination Depth:')) {
        metadata.termination_depth = this.extractValue(line, 'Termination Depth:');
      } else if (line.includes('Standing Water Level:')) {
        metadata.standing_water_level = this.extractValue(line, 'Standing Water Level:');
      } else if (line.includes('Coordinates:')) {
        // Handle coordinates - might be on multiple lines
        const coords = this.parseCoordinates(i);
        if (coords) {
          metadata.coordinates = coords;
          i += coords.lineOffset || 0;
        }
      } else if (line.includes('Lab Tests:')) {
        // Handle lab tests - might be on multiple lines
        const labTests = this.parseLabTests(i);
        if (labTests) {
          metadata.lab_tests = labTests;
          i += labTests.lineOffset || 0;
        }
      }
      
      i++;
    }

    // Validate required fields
    if (!metadata.project_name || !metadata.job_code) {
      throw new Error('Missing required metadata: project_name and job_code are required');
    }

    return metadata as BoreholeMetadata;
  }

  /**
   * Parse soil/rock layer data (tabular format)
   */
  private parseSoilLayers(): SoilLayer[] {
    const layers: SoilLayer[] = [];
    let i = this.findLayerDataStart();
    
    if (i === -1) return layers;

    // Skip header lines
    while (i < this.lines.length && this.isHeaderLine(this.lines[i])) {
      i++;
    }

    let currentLayer: Partial<SoilLayer> = {};
    let layerLines: string[] = [];

    while (i < this.lines.length) {
      const line = this.lines[i];
      
      if (this.isLayerDataEnd(line)) {
        break;
      }

      if (this.isNewLayerStart(line)) {
        // Process previous layer if exists
        if (Object.keys(currentLayer).length > 0) {
          const layer = this.processLayerData(layerLines);
          if (layer) layers.push(layer);
        }
        
        // Start new layer
        currentLayer = {};
        layerLines = [line];
      } else {
        layerLines.push(line);
      }
      
      i++;
    }

    // Process the last layer
    if (layerLines.length > 0) {
      const layer = this.processLayerData(layerLines);
      if (layer) layers.push(layer);
    }

    return layers;
  }

  /**
   * Parse remarks and subsections
   */
  private parseRemarks(): SampleRemark[] {
    const remarks: SampleRemark[] = [];
    
    for (const line of this.lines) {
      if (line.includes('SAMPLE RECEIVED') || line.includes('SAMPLE NOT RECEIVED')) {
        const sampleId = this.extractSampleId(line);
        const status = line.includes('SAMPLE RECEIVED') ? 'SAMPLE RECEIVED' : 'SAMPLE NOT RECEIVED';
        
        if (sampleId) {
          remarks.push({ sample_id: sampleId, status });
        }
      }
    }

    return remarks;
  }

  /**
   * Parse core quality information
   */
  private parseCoreQuality(): CoreQuality {
    const coreQuality: CoreQuality = {
      tcr_percent: null,
      rqd_percent: null
    };

    for (const line of this.lines) {
      if (line.includes('TCR %:')) {
        coreQuality.tcr_percent = this.parseNumber(this.extractValue(line, 'TCR %:'));
      } else if (line.includes('RQD %:')) {
        coreQuality.rqd_percent = this.parseNumber(this.extractValue(line, 'RQD %:'));
      }
    }

    return coreQuality;
  }

  /**
   * Helper methods
   */
  private extractValue(line: string, prefix: string): string {
    const index = line.indexOf(prefix);
    if (index === -1) return '';
    return line.substring(index + prefix.length).trim();
  }

  private parseNumber(value: string): number | null {
    if (!value || value === '-' || value === '#VALUE!') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  private isLayerDataStart(line: string): boolean {
    return line.includes('Description of Soil Stratum') || 
           line.includes('Soil Stratum') ||
           line.includes('Layer Description');
  }

  private isLayerDataEnd(line: string): boolean {
    return line.includes('Termination Depth') || 
           line.includes('Total Depth') ||
           line.includes('End of Log');
  }

  private isHeaderLine(line: string): boolean {
    // Text headers
    if (line.includes('Depth') && (line.includes('Description') || line.includes('Thickness'))) {
      return true;
    }
    // CSV headers
    const fields = this.splitCsvLine(line);
    if (fields.length > 2) {
      const joined = fields.join(' ').toLowerCase();
      if (joined.includes('description') && joined.includes('depth') && joined.includes('thickness')) {
        return true;
      }
    }
    return false;
  }

  private isNewLayerStart(line: string): boolean {
    // Check if line starts with a depth value (number followed by decimal)
    const trimmed = line.trim();
    if (/^\d+\.\d+/.test(trimmed)) {
      return true;
    }
    // Also support lines that END with a depth range like "0.00-0.70 m"
    // Example: "Grey silty clay ... 0.00-0.70 m"
    if (/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)[ ]*m$/i.test(trimmed)) {
      return true;
    }
    // CSV row that has description first column and numeric From/To later
    const fields = this.splitCsvLine(line);
    if (fields.length >= 3 && fields[0] && !/^(description|depth)/i.test(fields[0])) {
      // Find two consecutive numeric-like fields after index 0
      for (let i = 1; i < fields.length - 1; i++) {
        const a = this.parseNumber(fields[i]);
        const b = this.parseNumber(fields[i + 1]);
        if (a !== null && b !== null) {
          return true;
        }
      }
    }
    return false;
  }

  private findLayerDataStart(): number {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.isLayerDataStart(this.lines[i])) {
        return i;
      }
    }
    return -1;
  }

  private parseCoordinates(startIndex: number): { E: number | null; L: number | null; lineOffset?: number } | null {
    let lineOffset = 0;
    
    for (let i = startIndex; i < Math.min(startIndex + 3, this.lines.length); i++) {
      const line = this.lines[i];
      
      if (line.includes('E:') || line.includes('East:')) {
        const eValue = this.extractValue(line, line.includes('E:') ? 'E:' : 'East:');
        const lValue = this.extractValue(line, line.includes('L:') ? 'L:' : 'North:');
        
        return {
          E: this.parseNumber(eValue),
          L: this.parseNumber(lValue),
          lineOffset
        };
      }
      
      lineOffset++;
    }
    
    return null;
  }

  private parseLabTests(startIndex: number): { 
    permeability_tests: number; 
    sp_vs_tests: number; 
    spt_tests: number;
    vs_tests: number;
    undisturbed_samples: number; 
    disturbed_samples: string; 
    water_samples: number;
    lineOffset?: number;
  } | null {
    let lineOffset = 0;
    
    for (let i = startIndex; i < Math.min(startIndex + 5, this.lines.length); i++) {
      const line = this.lines[i];
      
      if (line.includes('Permeability Tests:') || line.includes('SP/VS Tests:')) {
        const permeability = this.parseNumber(this.extractValue(line, 'Permeability Tests:')) || 0;
        const spVs = this.parseNumber(this.extractValue(line, 'SP/VS Tests:')) || 0;
        
        // Look for more test info in subsequent lines
        let undisturbed = 0;
        let disturbed = '';
        let water = 0;
        
        for (let j = i + 1; j < Math.min(i + 4, this.lines.length); j++) {
          const nextLine = this.lines[j];
          if (nextLine.includes('Undisturbed Samples:')) {
            undisturbed = this.parseNumber(this.extractValue(nextLine, 'Undisturbed Samples:')) || 0;
          } else if (nextLine.includes('Disturbed Samples:')) {
            disturbed = this.extractValue(nextLine, 'Disturbed Samples:');
          } else if (nextLine.includes('Water Samples:')) {
            water = this.parseNumber(this.extractValue(nextLine, 'Water Samples:')) || 0;
          }
        }
        
        // For CSV format "SP/VS Tests: 15", we need to make an assumption about the split
        // Common practice: assume 70% SPT, 30% VS for combined counts
        const sptCount = Math.round(spVs * 0.7);
        const vsCount = spVs - sptCount;

        return {
          permeability_tests: permeability,
          sp_vs_tests: spVs,
          spt_tests: sptCount,
          vs_tests: vsCount,
          undisturbed_samples: undisturbed,
          disturbed_samples: disturbed,
          water_samples: water,
          lineOffset
        };
      }
      
      lineOffset++;
    }
    
    return null;
  }

  private extractSampleId(line: string): string | null {
    // Extract sample ID from lines like "U-1 SAMPLE RECEIVED" or "D-1 SAMPLE NOT RECEIVED"
    const match = line.match(/([A-Z]-\d+)/);
    return match ? match[1] : null;
  }

  private processLayerData(layerLines: string[]): SoilLayer | null {
    if (layerLines.length === 0) return null;

    const firstLine = layerLines[0];
    const parts = firstLine.split(/\s+/).filter(part => part.length > 0);
    
    // Try regex-based parsing where the line ends with a depth range "a-b m"
    let depthFrom: number | null = null;
    let depthTo: number | null = null;
    let thickness: number | null = null;
    let descriptionFromRegex: string | null = null;

    // Try relaxed regex on column 0 content (handles missing 'm' and en-dash)
    const csvForFirst = this.splitCsvLine(firstLine);
    const descriptionCol0 = (csvForFirst[0]?.trim() || firstLine).trim();
    const rangeMatch = descriptionCol0.match(/^(.*?)(\d+(?:\.\d+)?)[ ]*[-–][ ]*(\d+(?:\.\d+)?)[ ]*m?$/i);
    if (rangeMatch) {
      descriptionFromRegex = rangeMatch[1].trim();
      depthFrom = this.parseNumber(rangeMatch[2]);
      depthTo = this.parseNumber(rangeMatch[3]);
      if (depthFrom !== null && depthTo !== null) {
        thickness = parseFloat((depthTo - depthFrom).toFixed(2));
      }
    }

    // Extra fields from other CSV columns (e.g., core length, sample type)
    let extraCoreLength: number | null = null;
    let extraSampleType: string | null = null;
    if (csvForFirst.length > 4) {
      extraCoreLength = this.parseNumber(csvForFirst[2] || '');
      extraSampleType = (csvForFirst[4] || '').trim() || null;
    }

    // CSV-based parsing: description in col 0, depths in later columns
    if (depthFrom === null || depthTo === null) {
      const csv = csvForFirst;
      if (csv.length >= 3 && csv[0]) {
        // locate first two numeric fields after description
        for (let i = 1; i < csv.length - 1; i++) {
          const a = this.parseNumber(csv[i]);
          const b = this.parseNumber(csv[i + 1]);
          if (a !== null && b !== null) {
            descriptionFromRegex = (descriptionFromRegex || csv[0].trim());
            depthFrom = a;
            depthTo = b;
            const maybeThickness = this.parseNumber(csv[i + 2] || '');
            thickness = maybeThickness !== null ? maybeThickness : parseFloat((b - a).toFixed(2));
            break;
          }
        }
      }
    }

    // Fallback to column-based numeric-first parsing (depthFrom depthTo thickness ...)
    if (depthFrom === null || depthTo === null || thickness === null) {
      if (parts.length >= 3) {
        const df = this.parseNumber(parts[0]);
        const dt = this.parseNumber(parts[1]);
        const th = this.parseNumber(parts[2]);
        if (df !== null && dt !== null) {
          depthFrom = df;
          depthTo = dt;
          thickness = th !== null ? th : parseFloat((dt - df).toFixed(2));
        }
      }
    }
    
    if (depthFrom === null || depthTo === null || thickness === null) return null;

    // Extract description from remaining parts or subsequent lines
    let description = descriptionFromRegex || '';
    let sampleId: string | null = null;
    let sampleDepth: number | null = null;
    let runLength: number | null = null;
    let penetration15cm: (number | string)[] = ['-', '-', '-'];
    let nValue: number | string | null = '#VALUE!';
    let totalCoreLength: number | null = null;
    let tcrPercent: number | null = null;
    let rqdLength: number | null = null;
    let rqdPercent: number | null = null;
    let colourOfReturnWater: string | null = null;
    let waterLoss: string | null = null;
    let diameterOfBorehole: string | null = null;
    let remarks: string | null = null;

    // Process additional lines for more details
    for (let i = 1; i < layerLines.length; i++) {
      const line = layerLines[i];
      
      if (line.includes('Sample ID:')) {
        sampleId = this.extractValue(line, 'Sample ID:') || null;
      } else if (line.includes('Sample Depth:')) {
        sampleDepth = this.parseNumber(this.extractValue(line, 'Sample Depth:'));
      } else if (line.includes('Run Length:')) {
        runLength = this.parseNumber(this.extractValue(line, 'Run Length:'));
      } else if (line.includes('SPT Blows:')) {
        // Parse SPT blows (3 values for 15cm intervals)
        const sptMatch = line.match(/SPT Blows:\s*([^,]+),?\s*([^,]+),?\s*([^,]+)/);
        if (sptMatch) {
          penetration15cm = [
            this.parseNumber(sptMatch[1]) || '-',
            this.parseNumber(sptMatch[2]) || '-',
            this.parseNumber(sptMatch[3]) || '-'
          ];
        }
      } else if (line.includes('N-Value:')) {
        const nValueStr = this.extractValue(line, 'N-Value:');
        nValue = nValueStr === '#VALUE!' ? '#VALUE!' : this.parseNumber(nValueStr);
      } else if (line.includes('Total Core Length:')) {
        totalCoreLength = this.parseNumber(this.extractValue(line, 'Total Core Length:'));
      } else if (line.includes('TCR %:')) {
        tcrPercent = this.parseNumber(this.extractValue(line, 'TCR %:'));
      } else if (line.includes('RQD Length:')) {
        rqdLength = this.parseNumber(this.extractValue(line, 'RQD Length:'));
      } else if (line.includes('RQD %:')) {
        rqdPercent = this.parseNumber(this.extractValue(line, 'RQD %:'));
      } else if (line.includes('Colour of Return Water:')) {
        colourOfReturnWater = this.extractValue(line, 'Colour of Return Water:') || null;
      } else if (line.includes('Water Loss:')) {
        waterLoss = this.extractValue(line, 'Water Loss:') || null;
      } else if (line.includes('Diameter of Borehole:')) {
        diameterOfBorehole = this.extractValue(line, 'Diameter of Borehole:') || null;
      } else if (line.includes('Remarks:')) {
        remarks = this.extractValue(line, 'Remarks:') || null;
      } else if (!description && line.trim().length > 0) {
        // If no description yet, use this line as description
        description = line.trim();
      }
    }

    // If no description was found in additional lines, construct from first line
    if (!description) {
      // If we parsed with regex, descriptionFromRegex already used.
      // Otherwise, use remaining parts of the first line as description (after the first 3 numeric columns)
      description = parts.slice(3).join(' ');
    }

    return {
      description,
      depth_from: depthFrom,
      depth_to: depthTo,
      thickness,
      sample_id: sampleId,
      sample_type: extraSampleType ?? null,
      sample_depth: sampleDepth,
      run_length: runLength,
      penetration_15cm: penetration15cm,
      n_value: nValue,
      total_core_length_cm: totalCoreLength ?? extraCoreLength,
      tcr_percent: tcrPercent,
      rqd_length_cm: rqdLength,
      rqd_percent: rqdPercent,
      colour_of_return_water: colourOfReturnWater,
      water_loss: waterLoss,
      diameter_of_borehole: diameterOfBorehole,
      remarks
    };
  }

  // Split a CSV line on commas not inside quotes, and trim quotes/whitespace
  private splitCsvLine(line: string): string[] {
    const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return parts.map(p => {
      let s = p.trim();
      if (s.startsWith('"') && s.endsWith('"')) {
        s = s.substring(1, s.length - 1);
      }
      return s.trim();
    });
  }
}

/**
 * Convenience function to parse borehole CSV content
 */
export async function parseBoreholeCsv(csvContent: string): Promise<BoreholeCsvData> {
  const parser = new BoreholeCsvParser(csvContent);
  return parser.parse();
}
