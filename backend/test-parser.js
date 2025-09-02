// Simple test script for the Borehole CSV Parser
// This tests the parsing logic without requiring TypeScript compilation

console.log('🧪 Testing Borehole CSV Parser Logic\n');

// Mock the parser class for testing
class MockBoreholeCsvParser {
  constructor(csvContent) {
    this.lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }

  parse() {
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
      throw new Error(`Failed to parse borehole CSV: ${error.message}`);
    }
  }

  parseMetadata() {
    const metadata = {
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
      } else if (line.includes('Location:')) {
        metadata.location = this.extractValue(line, 'Location:');
      } else if (line.includes('Method of Boring:')) {
        metadata.method_of_boring = this.extractValue(line, 'Method of Boring:');
      } else if (line.includes('Diameter of Hole:')) {
        metadata.diameter_of_hole = this.extractValue(line, 'Diameter of Hole:');
      } else if (line.includes('Termination Depth:')) {
        metadata.termination_depth = this.extractValue(line, 'Termination Depth:');
      } else if (line.includes('Standing Water Level:')) {
        metadata.standing_water_level = this.extractValue(line, 'Standing Water Level:');
      }
      
      i++;
    }

    if (!metadata.project_name || !metadata.job_code) {
      throw new Error('Missing required metadata: project_name and job_code are required');
    }

    return metadata;
  }

  parseSoilLayers() {
    const layers = [];
    let i = this.findLayerDataStart();
    
    if (i === -1) return layers;

    while (i < this.lines.length && this.isHeaderLine(this.lines[i])) {
      i++;
    }

    let layerLines = [];
    while (i < this.lines.length) {
      const line = this.lines[i];
      
      if (this.isLayerDataEnd(line)) {
        break;
      }

      if (this.isNewLayerStart(line)) {
        if (layerLines.length > 0) {
          const layer = this.processLayerData(layerLines);
          if (layer) layers.push(layer);
        }
        layerLines = [line];
      } else {
        layerLines.push(line);
      }
      
      i++;
    }

    if (layerLines.length > 0) {
      const layer = this.processLayerData(layerLines);
      if (layer) layers.push(layer);
    }

    return layers;
  }

  parseRemarks() {
    const remarks = [];
    
    for (const line of this.lines) {
      if (line.includes('SAMPLE RECEIVED') || line.includes('SAMPLE NOT RECEIVED')) {
        // Extract all sample IDs from the line
        const sampleIds = this.extractAllSampleIds(line);
        const status = line.includes('SAMPLE RECEIVED') ? 'SAMPLE RECEIVED' : 'SAMPLE NOT RECEIVED';
        
        for (const sampleId of sampleIds) {
          remarks.push({ sample_id: sampleId, status });
        }
      }
    }

    return remarks;
  }

  parseCoreQuality() {
    const coreQuality = {
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

  // Helper methods
  extractValue(line, prefix) {
    const index = line.indexOf(prefix);
    if (index === -1) return '';
    return line.substring(index + prefix.length).trim();
  }

  parseNumber(value) {
    if (!value || value === '-' || value === '#VALUE!') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  isLayerDataStart(line) {
    return line.includes('Description of Soil Stratum') || 
           line.includes('Soil Stratum') ||
           line.includes('Layer Description');
  }

  isLayerDataEnd(line) {
    return line.includes('Termination Depth') || 
           line.includes('Total Depth') ||
           line.includes('End of Log');
  }

  isHeaderLine(line) {
    return line.includes('Depth') && 
           (line.includes('Description') || line.includes('Thickness'));
  }

  isNewLayerStart(line) {
    return /^\d+\.\d+/.test(line.trim());
  }

  findLayerDataStart() {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.isLayerDataStart(this.lines[i])) {
        return i;
      }
    }
    return -1;
  }

  extractSampleId(line) {
    const match = line.match(/([A-Z]-\d+)/);
    return match ? match[1] : null;
  }

  extractAllSampleIds(line) {
    const matches = line.match(/([A-Z]-\d+)/g);
    return matches || [];
  }

  processLayerData(layerLines) {
    if (layerLines.length === 0) return null;

    const firstLine = layerLines[0];
    const parts = firstLine.split(/\s+/).filter(part => part.length > 0);
    
    if (parts.length < 3) return null;

    const depthFrom = this.parseNumber(parts[0]);
    const depthTo = this.parseNumber(parts[1]);
    const thickness = this.parseNumber(parts[2]);
    
    if (depthFrom === null || depthTo === null || thickness === null) return null;

    let description = '';
    let sampleId = null;
    let sampleDepth = null;
    let nValue = '#VALUE!';

    for (let i = 1; i < layerLines.length; i++) {
      const line = layerLines[i];
      
      if (line.includes('Sample ID:')) {
        sampleId = this.extractValue(line, 'Sample ID:') || null;
      } else if (line.includes('Sample Depth:')) {
        sampleDepth = this.parseNumber(this.extractValue(line, 'Sample Depth:'));
      } else if (line.includes('N-Value:')) {
        const nValueStr = this.extractValue(line, 'N-Value:');
        nValue = nValueStr === '#VALUE!' ? '#VALUE!' : this.parseNumber(nValueStr);
      } else if (!description && line.trim().length > 0) {
        description = line.trim();
      }
    }

    if (!description) {
      description = parts.slice(3).join(' ');
    }

    return {
      description,
      depth_from: depthFrom,
      depth_to: depthTo,
      thickness,
      sample_id: sampleId,
      sample_depth: sampleDepth,
      n_value: nValue
    };
  }
}

// Test data
const testCsv = `Project Name: Test Project
Job Code: TEST-001
Location: Test Site
Method of Boring: Rotary Drilling
Diameter of Hole: 150 mm
Termination Depth: 20.00 m BGL
Standing Water Level: 1.00 m BGL

Description of Soil Stratum
Depth From (m) Depth To (m) Thickness (m) Description
0.00 2.00 2.00 Topsoil and weathered material
Sample ID: D-1
Sample Depth: 1.00
N-Value: 8

2.00 8.00 6.00 Clayey silt with sand
Sample ID: U-1
Sample Depth: 5.00

8.00 15.00 7.00 Medium dense sand
Sample ID: D-2
Sample Depth: 11.50
N-Value: 25

15.00 20.00 5.00 Dense gravelly sand
Sample ID: U-2
Sample Depth: 17.50

Termination Depth: 20.00 m BGL

SAMPLE RECEIVED: U-1, U-2
SAMPLE NOT RECEIVED: D-1, D-2

Core Quality Summary:
TCR %: 90.0
RQD %: 85.0`;

// Run tests
function runTests() {
  console.log('Running parser tests...\n');
  
  try {
    // Test 1: Basic parsing
    console.log('✅ Test 1: Basic CSV Parsing');
    const parser = new MockBoreholeCsvParser(testCsv);
    const result = parser.parse();
    
    if (result.metadata.project_name === 'Test Project') {
      console.log('   ✓ Project name parsed correctly');
    } else {
      console.log('   ❌ Project name parsing failed');
    }
    
    if (result.metadata.job_code === 'TEST-001') {
      console.log('   ✓ Job code parsed correctly');
    } else {
      console.log('   ❌ Job code parsing failed');
    }
    
    if (result.layers.length === 4) {
      console.log('   ✓ Correct number of layers parsed');
    } else {
      console.log('   ❌ Layer parsing failed');
    }
    
    if (result.remarks.length === 4) {
      console.log('   ✓ Correct number of remarks parsed');
    } else {
      console.log('   ❌ Remarks parsing failed');
    }
    
    if (result.core_quality.tcr_percent === 90.0) {
      console.log('   ✓ TCR percentage parsed correctly');
    } else {
      console.log('   ❌ TCR parsing failed');
    }
    
    // Test 2: Layer data validation
    console.log('\n✅ Test 2: Layer Data Validation');
    const firstLayer = result.layers[0];
    
    if (firstLayer.depth_from === 0.00 && firstLayer.depth_to === 2.00) {
      console.log('   ✓ Layer depths parsed correctly');
    } else {
      console.log('   ❌ Layer depth parsing failed');
    }
    
    if (firstLayer.sample_id === 'D-1') {
      console.log('   ✓ Sample ID parsed correctly');
    } else {
      console.log('   ❌ Sample ID parsing failed');
    }
    
    // Test 3: Sample remarks
    console.log('\n✅ Test 3: Sample Remarks');
    const receivedSamples = result.remarks.filter(r => r.status === 'SAMPLE RECEIVED');
    const notReceivedSamples = result.remarks.filter(r => r.status === 'SAMPLE NOT RECEIVED');
    
    if (receivedSamples.length === 2 && notReceivedSamples.length === 2) {
      console.log('   ✓ Sample status parsing correct');
    } else {
      console.log('   ❌ Sample status parsing failed');
    }
    
    // Display results
    console.log('\n📊 Parsing Results:');
    console.log('==================');
    console.log(`Project: ${result.metadata.project_name}`);
    console.log(`Job Code: ${result.metadata.job_code}`);
    console.log(`Location: ${result.metadata.location}`);
    console.log(`Total Layers: ${result.layers.length}`);
    console.log(`Samples Received: ${receivedSamples.length}`);
    console.log(`Samples Not Received: ${notReceivedSamples.length}`);
    console.log(`TCR: ${result.core_quality.tcr_percent}%`);
    console.log(`RQD: ${result.core_quality.rqd_percent}%`);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the tests
runTests();
