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

      // Project details table
      (doc as any).autoTable({
        startY: 50,
        head: [['Field', 'Value']],
        body: [
          ['Project ID', data.project_id],
          ['Project Name', data.project_name],
          ['Borehole ID', data.borehole_id],
          ['Location', data.location],
          ['Coordinates', `Lat: ${data.latitude}, Long: ${data.longitude}`],
          ['Elevation', `${data.elevation} m`],
          ['Total Depth', `${data.total_depth} m`],
          ['Water Level', data.water_level !== undefined ? `${data.water_level} m` : 'Not recorded'],
          ['Start Date', new Date(data.start_date).toLocaleDateString()],
          ['End Date', new Date(data.end_date).toLocaleDateString()],
          ['Logged By', data.logged_by],
          ['Drilling Method', data.drilling_method],
        ],
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      });

      // Add remarks if available
      if (data.remarks) {
        const finalY = (doc as any).lastAutoTable.finalY || 150;
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