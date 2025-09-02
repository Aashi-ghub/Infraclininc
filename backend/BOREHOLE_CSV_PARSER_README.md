# Borehole CSV Parser

A comprehensive CSV parser for geological borehole data that extracts metadata, soil/rock layers, and subsections from structured borehole reports.

## Features

- **Metadata Extraction**: Automatically parses project information, coordinates, lab tests, and borehole specifications
- **Soil/Rock Layer Parsing**: Handles multi-line stratum data with depth, thickness, and sample information
- **Sample Remarks**: Extracts sample status information (received/not received)
- **Core Quality Metrics**: Parses TCR and RQD percentages for rock quality assessment
- **Flexible Format Support**: Adapts to various CSV layouts and field naming conventions

## Data Structure

### Input Format

The parser expects CSV content with the following structure:

```
Project Name: [Project Name]
Client Address: [Address]
Website: [URL]
Job Code: [Code]
Location: [Location]
Method of Boring: [Method]
Diameter of Hole: [Diameter]
Termination Depth: [Depth]
Standing Water Level: [Level]
Coordinates: E: [East], L: [North]
Lab Tests: [Test Details]

Description of Soil Stratum
Depth From (m) Depth To (m) Thickness (m) Description
[Depth] [Depth] [Thickness] [Description]
Sample ID: [ID]
Sample Depth: [Depth]
SPT Blows: [Value1], [Value2], [Value3]
N-Value: [Value]
...

Termination Depth: [Final Depth]

SAMPLE RECEIVED: [Sample IDs]
SAMPLE NOT RECEIVED: [Sample IDs]

Core Quality Summary:
TCR %: [Percentage]
RQD %: [Percentage]
```

### Output Structure

```typescript
interface BoreholeCsvData {
  metadata: BoreholeMetadata;
  layers: SoilLayer[];
  remarks: SampleRemark[];
  core_quality: CoreQuality;
}
```

#### Metadata Fields

- `project_name`: Project identifier
- `client_address`: Client location
- `website`: Project website
- `job_code`: Job reference code
- `section_name`: Section identifier (optional)
- `chainage_km`: Chainage in kilometers (optional)
- `location`: Borehole location
- `borehole_no`: Borehole number (optional)
- `commencement_date`: Start date
- `completion_date`: End date
- `mean_sea_level`: MSL reference (optional)
- `method_of_boring`: Drilling method
- `diameter_of_hole`: Hole diameter
- `termination_depth`: Final depth
- `standing_water_level`: Water level
- `coordinates`: Easting and Northing coordinates
- `lab_tests`: Laboratory test summary

#### Soil Layer Fields

- `description`: Geological description
- `depth_from`: Starting depth (m)
- `depth_to`: Ending depth (m)
- `thickness`: Layer thickness (m)
- `sample_id`: Sample identifier
- `sample_depth`: Sample collection depth
- `run_length`: Core run length
- `penetration_15cm`: SPT blows for 15cm intervals
- `n_value`: N-value for soil classification
- `total_core_length_cm`: Total core length
- `tcr_percent`: Total Core Recovery percentage
- `rqd_length_cm`: Rock Quality Designation length
- `rqd_percent`: RQD percentage
- `colour_of_return_water`: Drilling fluid color
- `water_loss`: Water loss during drilling
- `diameter_of_borehole`: Borehole diameter
- `remarks`: Additional notes

## Usage

### Basic Usage

```typescript
import { parseBoreholeCsv } from './src/utils/boreholeCsvParser';

// Parse CSV content
const csvContent = `Project Name: My Project
Job Code: TEST-001
...`;

try {
  const result = await parseBoreholeCsv(csvContent);
  console.log('Project:', result.metadata.project_name);
  console.log('Layers:', result.layers.length);
} catch (error) {
  console.error('Parsing failed:', error.message);
}
```

### Advanced Usage

```typescript
import { BoreholeCsvParser } from './src/utils/boreholeCsvParser';

// Create parser instance for custom processing
const parser = new BoreholeCsvParser(csvContent);

// Access individual components
const metadata = parser.parseMetadata();
const layers = parser.parseSoilLayers();
const remarks = parser.parseRemarks();
const coreQuality = parser.parseCoreQuality();
```

### Error Handling

```typescript
try {
  const result = await parseBoreholeCsv(csvContent);
  // Process successful result
} catch (error) {
  if (error.message.includes('Missing required metadata')) {
    console.error('CSV is missing required project information');
  } else if (error.message.includes('Failed to parse')) {
    console.error('CSV format is invalid or corrupted');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Field Mapping

### Metadata Field Detection

The parser automatically detects metadata fields using these patterns:

| Field | Detection Pattern | Example |
|-------|------------------|---------|
| Project Name | `Project Name:` | `Project Name: BPC Consultant INDIA Pvt. Ltd.` |
| Job Code | `Job Code:` | `Job Code: CNE-AGTL` |
| Location | `Location:` | `Location: BR-365 (STEEL GIDER)` |
| Method | `Method of Boring:` | `Method of Boring: Rotary Drilling` |
| Diameter | `Diameter of Hole:` | `Diameter of Hole: 150 mm` |

### Layer Data Detection

Soil/rock layers are identified by:

1. **Section Header**: Lines containing "Description of Soil Stratum"
2. **Data Start**: Lines beginning with decimal numbers (depth values)
3. **Layer Boundaries**: Depth values followed by thickness and description
4. **Additional Data**: Sample information, SPT values, core metrics

### Sample Remark Detection

Sample status is extracted from lines containing:
- `SAMPLE RECEIVED`
- `SAMPLE NOT RECEIVED`

Sample IDs are extracted using regex pattern: `[A-Z]-\d+`

## Data Validation

### Required Fields

- `project_name`: Must be non-empty
- `job_code`: Must be non-empty

### Optional Fields

All other fields are optional and will be set to `null` or default values if not present.

### Number Parsing

- Numeric values are parsed as floats
- Invalid values (`-`, `#VALUE!`, empty) are converted to `null`
- Coordinates and measurements maintain precision

## Performance Considerations

- **Line-by-line processing**: Efficient for large files
- **Memory efficient**: Processes data incrementally
- **Regex optimization**: Minimal regex usage for performance
- **Early termination**: Stops processing at end markers

## Error Recovery

The parser includes several error recovery mechanisms:

1. **Missing Fields**: Gracefully handles missing optional fields
2. **Format Variations**: Adapts to different field naming conventions
3. **Data Corruption**: Skips invalid lines and continues processing
4. **Partial Data**: Returns partial results when possible

## Testing

Run the test file to verify parser functionality:

```bash
cd backend
node test-borehole-csv-parser.js
```

The test includes a comprehensive sample CSV that demonstrates all parser features.

## Integration

### With Database

```typescript
// Save parsed data to database
const result = await parseBoreholeCsv(csvContent);

// Insert metadata
await db.boreholes.insert(result.metadata);

// Insert layers
for (const layer of result.layers) {
  await db.strata.insert({
    ...layer,
    borehole_id: result.metadata.job_code
  });
}
```

### With API Endpoints

```typescript
// API handler for CSV upload
export const uploadBoreholeCsv = async (event) => {
  const csvContent = event.body;
  
  try {
    const parsedData = await parseBoreholeCsv(csvContent);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: parsedData
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
```

## Customization

### Adding New Fields

To add new metadata fields:

1. Update the `BoreholeMetadata` interface in `types/boreholeCsv.ts`
2. Add detection logic in `parseMetadata()` method
3. Include field in the metadata object initialization

### Modifying Layer Parsing

To customize soil layer parsing:

1. Update the `SoilLayer` interface
2. Modify the `processLayerData()` method
3. Add new field extraction logic

### Extending Sample Remarks

To add new remark types:

1. Update the `SampleRemark` interface
2. Modify the `parseRemarks()` method
3. Add new pattern detection logic

## Troubleshooting

### Common Issues

1. **Missing Metadata**: Ensure CSV contains required project information
2. **Layer Detection**: Check for proper "Description of Soil Stratum" header
3. **Sample Parsing**: Verify sample ID format matches `[A-Z]-\d+` pattern
4. **Number Parsing**: Check for invalid numeric values (`#VALUE!`, `-`)

### Debug Mode

Enable detailed logging by modifying the parser:

```typescript
// Add logging to parser methods
private parseMetadata(): BoreholeMetadata {
  console.log('Parsing metadata...');
  // ... existing code
}
```

## License

This parser is part of the BackendBore project and follows the same licensing terms.
