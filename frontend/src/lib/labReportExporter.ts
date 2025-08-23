import * as XLSX from 'xlsx';

export interface UnifiedLabReportData {
  lab_report_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  test_types: string[];
  combined_data: {
    soil: any[];
    rock: any[];
  };
}

export const exportUnifiedLabReportToExcel = (reportData: UnifiedLabReportData) => {
  const workbook = XLSX.utils.book_new();
  
  // Create Summary Sheet
  const summaryData = [
    ['LABORATORY TEST REPORT SUMMARY'],
    [''],
    ['Project Information'],
    ['Project Name:', reportData.project_name],
    ['Borehole Number:', reportData.borehole_no],
    ['Client:', reportData.client],
    ['Report ID:', reportData.lab_report_id],
    ['Date:', reportData.date.toLocaleDateString()],
    [''],
    ['Personnel'],
    ['Tested By:', reportData.tested_by],
    ['Checked By:', reportData.checked_by],
    ['Approved By:', reportData.approved_by],
    [''],
    ['Test Types Included:'],
    ...reportData.test_types.map(type => [type]),
    [''],
    ['Summary'],
    ['Total Soil Tests:', reportData.combined_data.soil.length],
    ['Total Rock Tests:', reportData.combined_data.rock.length],
    ['Total Tests:', reportData.combined_data.soil.length + reportData.combined_data.rock.length]
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Create Soil Tests Sheet
  if (reportData.combined_data.soil.length > 0) {
    const soilHeaders = [
      'Sample No.',
      'Sample Depth (m)',
      'Observed N Value IS - 2131',
      'Corrected N" Value IS - 2131',
      'Type of Soil Sample',
      'Hatching Pattern',
      'Soil Classification',
      'Moisture Content (%)',
      'Dry Density (g/cm³)',
      'Liquid Limit (%)',
      'Plastic Limit (%)',
      'Shrinkage Limit (%)',
      'Specific Gravity',
      'Sieve Analysis (%)',
      'Hydrometer Test (%)',
      'Direct Shear Test (kPa)',
      'Natural Density (g/cm³)',
      'Consolidation Test (cm²/kg)',
      'UCS (kPa)',
      'Triaxial Test (kPa)'
    ];
    
    const soilData = [
      soilHeaders,
      ...reportData.combined_data.soil.map(soil => [
        soil.sample_no || '',
        soil.sample_depth || '',
        soil.observed_n_value || '',
        soil.corrected_n_value || '',
        soil.type_of_soil_sample || '',
        soil.hatching_pattern || '',
        soil.soil_classification || '',
        soil.moisture_content || '',
        soil.dry_density || '',
        soil.liquid_limit || '',
        soil.plastic_limit || '',
        soil.shrinkage_limit || '',
        soil.specific_gravity || '',
        soil.sieve_analysis || '',
        soil.hydrometer_test || '',
        soil.direct_shear_test || '',
        soil.natural_density || '',
        soil.consolidation_test || '',
        soil.ucs || '',
        soil.triaxial_test || ''
      ])
    ];
    
    const soilSheet = XLSX.utils.aoa_to_sheet(soilData);
    XLSX.utils.book_append_sheet(workbook, soilSheet, 'Soil Tests');
  }
  
  // Create Rock Tests Sheet
  if (reportData.combined_data.rock.length > 0) {
    const rockHeaders = [
      'Sample No.',
      'Depth (m)',
      'Rock Type',
      'Description',
      'Length (mm)',
      'Diameter (mm)',
      'Weight (g)',
      'Density (g/cm³)',
      'Moisture Content (%)',
      'Water Absorption (%)',
      'Porosity (%)',
      'Weight in Air (g)',
      'Weight in Water (g)',
      'Weight Saturated (g)',
      'Volume Water Displaced (cm³)',
      'Failure Load (kN)',
      'Point Load Index (Is50) (MPa)',
      'Uniaxial Compressive Strength (MPa)',
      'Brazilian Tensile Strength (MPa)'
    ];
    
    const rockData = [
      rockHeaders,
      ...reportData.combined_data.rock.map(rock => [
        rock.sample_no || '',
        rock.depth_m || '',
        rock.rock_type || '',
        rock.description || '',
        rock.length_mm || '',
        rock.diameter_mm || '',
        rock.weight_g || '',
        rock.density_g_cm3 || '',
        rock.moisture_content_percent || '',
        rock.water_absorption_percent || '',
        rock.porosity_percent || '',
        rock.weight_in_air_g || '',
        rock.weight_in_water_g || '',
        rock.weight_saturated_g || '',
        rock.volume_water_displaced_cm3 || '',
        rock.failure_load_kn || '',
        rock.point_load_index_mpa || '',
        rock.uniaxial_compressive_strength_mpa || '',
        rock.brazilian_tensile_strength_mpa || ''
      ])
    ];
    
    const rockSheet = XLSX.utils.aoa_to_sheet(rockData);
    XLSX.utils.book_append_sheet(workbook, rockSheet, 'Rock Tests');
  }
  
  // Create Caliper Method Sheet (if rock data exists)
  if (reportData.combined_data.rock.length > 0) {
    const caliperHeaders = [
      'Sample No.',
      'Depth (m)',
      'Length (mm)',
      'Diameter (mm)',
      'Weight (g)',
      'Density (g/cm³)',
      'Moisture Content (%)',
      'Water Absorption (%)',
      'Porosity (%)'
    ];
    
    const caliperData = [
      caliperHeaders,
      ...reportData.combined_data.rock.map(rock => [
        rock.sample_no || '',
        rock.depth_m || '',
        rock.length_mm || '',
        rock.diameter_mm || '',
        rock.weight_g || '',
        rock.density_g_cm3 || '',
        rock.moisture_content_percent || '',
        rock.water_absorption_percent || '',
        rock.porosity_percent || ''
      ])
    ];
    
    const caliperSheet = XLSX.utils.aoa_to_sheet(caliperData);
    XLSX.utils.book_append_sheet(workbook, caliperSheet, 'Caliper Method');
  }
  
  // Create Buoyancy Techniques Sheet (if rock data exists)
  if (reportData.combined_data.rock.length > 0) {
    const buoyancyHeaders = [
      'Sample No.',
      'Depth (m)',
      'Weight in Air (g)',
      'Weight in Water (g)',
      'Weight Saturated (g)',
      'Volume Water Displaced (cm³)',
      'Density (g/cm³)',
      'Moisture Content (%)',
      'Water Absorption (%)',
      'Porosity (%)'
    ];
    
    const buoyancyData = [
      buoyancyHeaders,
      ...reportData.combined_data.rock.map(rock => [
        rock.sample_no || '',
        rock.depth_m || '',
        rock.weight_in_air_g || '',
        rock.weight_in_water_g || '',
        rock.weight_saturated_g || '',
        rock.volume_water_displaced_cm3 || '',
        rock.density_g_cm3 || '',
        rock.moisture_content_percent || '',
        rock.water_absorption_percent || '',
        rock.porosity_percent || ''
      ])
    ];
    
    const buoyancySheet = XLSX.utils.aoa_to_sheet(buoyancyData);
    XLSX.utils.book_append_sheet(workbook, buoyancySheet, 'Buoyancy Techniques');
  }
  
  // Create Point Load Test Sheet (if rock data exists)
  if (reportData.combined_data.rock.length > 0) {
    const pointLoadHeaders = [
      'Sample No.',
      'Depth (m)',
      'Failure Load (kN)',
      'Point Load Index (Is50) (MPa)',
      'Uniaxial Compressive Strength (MPa)'
    ];
    
    const pointLoadData = [
      pointLoadHeaders,
      ...reportData.combined_data.rock.map(rock => [
        rock.sample_no || '',
        rock.depth_m || '',
        rock.failure_load_kn || '',
        rock.point_load_index_mpa || '',
        rock.uniaxial_compressive_strength_mpa || ''
      ])
    ];
    
    const pointLoadSheet = XLSX.utils.aoa_to_sheet(pointLoadData);
    XLSX.utils.book_append_sheet(workbook, pointLoadSheet, 'Point Load Test');
  }
  
  // Create Brazilian Tensile Strength Sheet (if rock data exists)
  if (reportData.combined_data.rock.length > 0) {
    const brazilianHeaders = [
      'Sample No.',
      'Depth (m)',
      'Brazilian Tensile Strength (MPa)'
    ];
    
    const brazilianData = [
      brazilianHeaders,
      ...reportData.combined_data.rock.map(rock => [
        rock.sample_no || '',
        rock.depth_m || '',
        rock.brazilian_tensile_strength_mpa || ''
      ])
    ];
    
    const brazilianSheet = XLSX.utils.aoa_to_sheet(brazilianData);
    XLSX.utils.book_append_sheet(workbook, brazilianSheet, 'Brazilian Tensile Strength');
  }
  
  // Generate filename
  const filename = `LabReport_${reportData.borehole_no}_${reportData.date.toISOString().split('T')[0]}.xlsx`;
  
  // Save the file
  XLSX.writeFile(workbook, filename);
  
  return filename;
};

export const exportLabReportToPDF = (reportData: UnifiedLabReportData) => {
  // This would integrate with a PDF library like jsPDF
  // For now, we'll just return a placeholder
  console.log('PDF export functionality would be implemented here');
  return `LabReport_${reportData.borehole_no}_${reportData.date.toISOString().split('T')[0]}.pdf`;
};
