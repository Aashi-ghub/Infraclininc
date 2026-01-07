const { parseBoreholeCsv } = require('./src/utils/boreholeCsvParser');

// Sample CSV content that matches the expected format
const sampleCsv = `Project Name: BPC Consultant INDIA Pvt. Ltd.
Client Address: BPC Village, Khusiganj, Hooghly, 712410 (WB)
Website: www.bpcipl.com
Job Code: CNE-AGTL
Section Name: 
Chainage (km): 
Location: BR-365 (STEEL GIDER)
Borehole No.: 
Commencement Date: 18.01.24
Completion Date: 19.01.24
Mean Sea Level: 
Method of Boring: Rotary Drilling
Diameter of Hole: 150 mm
Termination Depth: 40.45 m BGL
Standing Water Level: 0.70 m BGL
Coordinates: E: , L: 
Lab Tests: Permeability Tests: 0, SP/VS Tests: 22, Undisturbed Samples: 5, Disturbed Samples: 23 (D-1 & S/D-22), Water Samples: 1

Description of Soil Stratum
Depth From (m) Depth To (m) Thickness (m) Description
0.00 0.70 0.70 Grey colour silty clay with mixed grass roots & brownish colour patches observed.
Sample ID: D-1
Sample Depth: 0.50
SPT Blows: -, -, -
N-Value: #VALUE!

0.70 1.20 0.50 Dark grey colour, fine grained, clayey silty sand.
Sample ID: D-1
Sample Depth: 1.00
SPT Blows: -, -, -
N-Value: #VALUE!
Colour of Return Water: BROWNISH
Water Loss: PARTIAL
Diameter of Borehole: 150MM

1.20 2.50 1.30 Light grey colour, medium grained, silty sand.
Sample ID: D-2
Sample Depth: 1.85
SPT Blows: 15, 18, 22
N-Value: 18
Colour of Return Water: CLEAR
Water Loss: NIL

2.50 5.00 2.50 Brownish grey colour, fine grained, clayey silt.
Sample ID: U-1
Sample Depth: 3.75
Run Length: 1.50
Total Core Length: 120
TCR %: 80
RQD Length: 95
RQD %: 79

5.00 8.50 3.50 Dark brown colour, medium grained, silty sand with gravel.
Sample ID: D-3
Sample Depth: 6.75
SPT Blows: 25, 28, 30
N-Value: 28
Colour of Return Water: BROWNISH
Water Loss: PARTIAL

8.50 12.00 3.50 Light brown colour, fine grained, clayey sand.
Sample ID: U-2
Sample Depth: 10.25
Run Length: 2.00
Total Core Length: 180
TCR %: 85
RQD Length: 150
RQD %: 83

12.00 15.50 3.50 Grey colour, fine grained, silty clay.
Sample ID: D-4
Sample Depth: 13.75
SPT Blows: 20, 22, 25
N-Value: 22
Colour of Return Water: CLEAR
Water Loss: NIL

15.50 20.00 4.50 Brown colour, medium grained, sandy silt.
Sample ID: U-3
Sample Depth: 17.75
Run Length: 1.80
Total Core Length: 160
TCR %: 78
RQD Length: 125
RQD %: 78

20.00 25.00 5.00 Dark grey colour, fine grained, clayey silt.
Sample ID: D-5
Sample Depth: 22.50
SPT Blows: 18, 20, 22
N-Value: 20
Colour of Return Water: BROWNISH
Water Loss: PARTIAL

25.00 30.00 5.00 Light brown colour, medium grained, silty sand.
Sample ID: U-4
Sample Depth: 27.50
Run Length: 2.20
Total Core Length: 200
TCR %: 82
RQD Length: 165
RQD %: 82

30.00 35.00 5.00 Grey colour, fine grained, clayey silt.
Sample ID: D-6
Sample Depth: 32.50
SPT Blows: 22, 25, 28
N-Value: 25
Colour of Return Water: CLEAR
Water Loss: NIL

35.00 40.45 5.45 Brown colour, medium grained, sandy silt.
Sample ID: U-5
Sample Depth: 37.75
Run Length: 1.90
Total Core Length: 175
TCR %: 80
RQD Length: 140
RQD %: 80

Termination Depth: 40.45 m BGL

SAMPLE RECEIVED: U-1, U-2, U-3, U-4, U-5
SAMPLE NOT RECEIVED: D-1, D-2, D-3, D-4, D-5, D-6

Core Quality Summary:
TCR %: 81.0
RQD %: 80.4`;

async function testParser() {
  try {
    console.log('Testing Borehole CSV Parser...\n');
    
    const result = await parseBoreholeCsv(sampleCsv);
    
    console.log('✅ Parsing successful!\n');
    
    // Display metadata
    console.log('📋 METADATA:');
    console.log(`Project: ${result.metadata.project_name}`);
    console.log(`Job Code: ${result.metadata.job_code}`);
    console.log(`Location: ${result.metadata.location}`);
    console.log(`Method: ${result.metadata.method_of_boring}`);
    console.log(`Diameter: ${result.metadata.diameter_of_hole}`);
    console.log(`Termination Depth: ${result.metadata.termination_depth}`);
    console.log(`Standing Water Level: ${result.metadata.standing_water_level}`);
    console.log(`Lab Tests: ${result.metadata.lab_tests.undisturbed_samples} undisturbed, ${result.metadata.lab_tests.disturbed_samples} disturbed`);
    
    // Display layers summary
    console.log(`\n🏗️  SOIL/ROCK LAYERS: ${result.layers.length} layers found`);
    result.layers.forEach((layer, index) => {
      console.log(`  Layer ${index + 1}: ${layer.depth_from}m - ${layer.depth_to}m (${layer.thickness}m)`);
      console.log(`    Description: ${layer.description.substring(0, 60)}...`);
      if (layer.sample_id) {
        console.log(`    Sample: ${layer.sample_id} at ${layer.sample_depth}m`);
      }
      if (layer.n_value && layer.n_value !== '#VALUE!') {
        console.log(`    N-Value: ${layer.n_value}`);
      }
    });
    
    // Display remarks
    console.log(`\n📝 SAMPLE REMARKS: ${result.remarks.length} entries`);
    result.remarks.forEach(remark => {
      console.log(`  ${remark.sample_id}: ${remark.status}`);
    });
    
    // Display core quality
    console.log(`\n🔬 CORE QUALITY:`);
    console.log(`  TCR %: ${result.core_quality.tcr_percent || 'N/A'}`);
    console.log(`  RQD %: ${result.core_quality.rqd_percent || 'N/A'}`);
    
    // Display full JSON structure
    console.log('\n📊 FULL PARSED STRUCTURE:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Parsing failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testParser();
