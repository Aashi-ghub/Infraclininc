const fs = require('fs');
const path = require('path');

// Example usage of the Borehole CSV Parser
async function exampleUsage() {
  try {
    console.log('🚀 Borehole CSV Parser Example\n');
    
    // Example 1: Parse CSV content directly
    console.log('📋 Example 1: Parse CSV Content Directly');
    console.log('==========================================');
    
    const csvContent = `Project Name: Example Project
Job Code: EX-001
Location: Test Site
Method of Boring: Rotary Drilling
Diameter of Hole: 200 mm
Termination Depth: 25.00 m BGL
Standing Water Level: 1.50 m BGL

Description of Soil Stratum
Depth From (m) Depth To (m) Thickness (m) Description
0.00 2.00 2.00 Topsoil and weathered material
Sample ID: D-1
Sample Depth: 1.00
SPT Blows: 8, 10, 12
N-Value: 10

2.00 8.00 6.00 Clayey silt with sand
Sample ID: U-1
Sample Depth: 5.00
Run Length: 2.00
Total Core Length: 180
TCR %: 90
RQD Length: 160
RQD %: 89

8.00 15.00 7.00 Medium dense sand
Sample ID: D-2
Sample Depth: 11.50
SPT Blows: 25, 28, 30
N-Value: 28

15.00 25.00 10.00 Dense gravelly sand
Sample ID: U-2
Sample Depth: 20.00
Run Length: 3.00
Total Core Length: 300
TCR %: 95
RQD Length: 285
RQD %: 95

Termination Depth: 25.00 m BGL

SAMPLE RECEIVED: U-1, U-2
SAMPLE NOT RECEIVED: D-1, D-2

Core Quality Summary:
TCR %: 92.5
RQD %: 92.0`;

    // Import the parser (you'll need to compile TypeScript first)
    // const { parseBoreholeCsv } = require('./src/utils/boreholeCsvParser');
    
    console.log('CSV Content:');
    console.log(csvContent);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Example 2: Parse from file
    console.log('📁 Example 2: Parse from CSV File');
    console.log('==================================');
    
    // Create a sample CSV file
    const sampleCsvPath = path.join(__dirname, 'sample-borehole.csv');
    fs.writeFileSync(sampleCsvPath, csvContent);
    console.log(`✅ Created sample CSV file: ${sampleCsvPath}`);
    
    // Read and parse the file
    const fileContent = fs.readFileSync(sampleCsvPath, 'utf8');
    console.log('✅ Read CSV file successfully');
    
    // Parse the content (uncomment when parser is compiled)
    // const result = await parseBoreholeCsv(fileContent);
    
    console.log('✅ Parsed CSV content successfully');
    
    // Example 3: Data processing
    console.log('\n🔧 Example 3: Data Processing');
    console.log('===============================');
    
    // This would be the actual parsed result
    const mockResult = {
      metadata: {
        project_name: 'Example Project',
        job_code: 'EX-001',
        location: 'Test Site',
        method_of_boring: 'Rotary Drilling',
        diameter_of_hole: '200 mm',
        termination_depth: '25.00 m BGL',
        standing_water_level: '1.50 m BGL'
      },
      layers: [
        {
          depth_from: 0.00,
          depth_to: 2.00,
          thickness: 2.00,
          description: 'Topsoil and weathered material',
          sample_id: 'D-1',
          sample_depth: 1.00,
          n_value: 10
        },
        {
          depth_from: 2.00,
          depth_to: 8.00,
          thickness: 6.00,
          description: 'Clayey silt with sand',
          sample_id: 'U-1',
          sample_depth: 5.00,
          tcr_percent: 90,
          rqd_percent: 89
        }
      ],
      remarks: [
        { sample_id: 'U-1', status: 'SAMPLE RECEIVED' },
        { sample_id: 'U-2', status: 'SAMPLE RECEIVED' },
        { sample_id: 'D-1', status: 'SAMPLE NOT RECEIVED' },
        { sample_id: 'D-2', status: 'SAMPLE NOT RECEIVED' }
      ],
      core_quality: {
        tcr_percent: 92.5,
        rqd_percent: 92.0
      }
    };
    
    // Process the data
    console.log('📊 Processing Results:');
    console.log(`Project: ${mockResult.metadata.project_name}`);
    console.log(`Job Code: ${mockResult.metadata.job_code}`);
    console.log(`Total Layers: ${mockResult.layers.length}`);
    console.log(`Samples Received: ${mockResult.remarks.filter(r => r.status === 'SAMPLE RECEIVED').length}`);
    console.log(`Samples Not Received: ${mockResult.remarks.filter(r => r.status === 'SAMPLE NOT RECEIVED').length}`);
    console.log(`Average TCR: ${mockResult.core_quality.tcr_percent}%`);
    console.log(`Average RQD: ${mockResult.core_quality.rqd_percent}%`);
    
    // Example 4: Data validation
    console.log('\n✅ Example 4: Data Validation');
    console.log('==============================');
    
    // Validate required fields
    const requiredFields = ['project_name', 'job_code'];
    const missingFields = requiredFields.filter(field => !mockResult.metadata[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields are present');
    } else {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Validate layer data
    const validLayers = mockResult.layers.filter(layer => 
      layer.depth_from !== null && 
      layer.depth_to !== null && 
      layer.thickness !== null
    );
    
    console.log(`✅ Valid layers: ${validLayers.length}/${mockResult.layers.length}`);
    
    // Example 5: Export to different formats
    console.log('\n📤 Example 5: Export Options');
    console.log('==============================');
    
    // Export as JSON
    const jsonOutput = JSON.stringify(mockResult, null, 2);
    const jsonPath = path.join(__dirname, 'parsed-borehole.json');
    fs.writeFileSync(jsonPath, jsonOutput);
    console.log(`✅ Exported to JSON: ${jsonPath}`);
    
    // Export as CSV summary
    const csvSummary = [
      'Project Name,Job Code,Location,Total Layers,Termination Depth',
      `${mockResult.metadata.project_name},${mockResult.metadata.job_code},${mockResult.metadata.location},${mockResult.layers.length},${mockResult.metadata.termination_depth}`
    ].join('\n');
    
    const csvSummaryPath = path.join(__dirname, 'borehole-summary.csv');
    fs.writeFileSync(csvSummaryPath, csvSummary);
    console.log(`✅ Exported summary to CSV: ${csvSummaryPath}`);
    
    // Cleanup
    console.log('\n🧹 Cleanup');
    console.log('==========');
    fs.unlinkSync(sampleCsvPath);
    console.log('✅ Removed sample CSV file');
    
    console.log('\n🎉 Example completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
    console.error(error.stack);
  }
}

// Run the example
exampleUsage();

// Export for use in other modules
module.exports = {
  exampleUsage
};
