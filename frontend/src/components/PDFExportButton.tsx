import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GeologicalLog } from '@/lib/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FileDown } from 'lucide-react';

interface PDFExportButtonProps {
  data: GeologicalLog;
  filename?: string;
}

export function PDFExportButton({ data, filename = 'export' }: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const safeFilename = filename.replace(/[^a-z0-9]/gi, '-').toLowerCase();

      // Add title
      doc.setFontSize(18);
      doc.text('Geological Log Report', 14, 22);

      // Add subtitle with date
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

      // Add project information
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Project Information', 14, 45);
      doc.setFontSize(10);
      doc.setTextColor(50);

      // Extract coordinates if available
      const coordinates = data.coordinate 
        ? `Lat: ${data.coordinate.coordinates[1].toFixed(6)}, Long: ${data.coordinate.coordinates[0].toFixed(6)}`
        : 'Not recorded';

      // Project details table
      doc.autoTable({
        startY: 50,
        head: [['Field', 'Value']],
        body: [
          ['Project Name', data.project_name || 'N/A'],
          ['Borehole ID', data.borelog_id || 'N/A'],
          ['Borehole Number', data.borehole_number || 'N/A'],
          ['Location', data.borehole_location || 'N/A'],
          ['Coordinates', coordinates],
          ['MSL', data.msl || 'Not recorded'],
          ['Total Depth', `${data.termination_depth || 'N/A'} m`],
          ['Water Level', data.standing_water_level !== undefined ? `${data.standing_water_level} m` : 'Not recorded'],
          ['Start Date', data.commencement_date ? new Date(data.commencement_date).toLocaleDateString() : 'N/A'],
          ['End Date', data.completion_date ? new Date(data.completion_date).toLocaleDateString() : 'N/A'],
          ['Logged By', data.logged_by || 'N/A'],
          ['Checked By', data.checked_by || 'N/A'],
          ['Method of Boring', data.method_of_boring || 'N/A'],
          ['Diameter of Hole', `${data.diameter_of_hole || 'N/A'} mm`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      });

      // Add technical information if available
      if (data.lithology || data.rock_methodology || data.structural_condition) {
        const finalY = doc.lastAutoTable.finalY || 150;
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Technical Information', 14, finalY + 15);
        
        doc.autoTable({
          startY: finalY + 20,
          head: [['Field', 'Value']],
          body: [
            ['Lithology', data.lithology || 'Not recorded'],
            ['Rock Methodology', data.rock_methodology || 'Not recorded'],
            ['Structural Condition', data.structural_condition || 'Not recorded'],
            ['Weathering Classification', data.weathering_classification || 'Not recorded'],
            ['Fracture Frequency', data.fracture_frequency_per_m !== undefined ? `${data.fracture_frequency_per_m} per m` : 'Not recorded'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        });
      }

      // Add remarks if available
      if (data.remarks) {
        const finalY = doc.lastAutoTable.finalY || 150;
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Remarks', 14, finalY + 15);
        doc.setFontSize(10);
        doc.setTextColor(50);
        
        // Split remarks into lines to prevent overflow
        const textLines = doc.splitTextToSize(data.remarks, 180);
        doc.text(textLines, 14, finalY + 25);
      }

      // Save the PDF
      doc.save(`${safeFilename}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleExport} 
      disabled={isExporting}
    >
      <FileDown className="mr-2 h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export PDF'}
    </Button>
  );
}