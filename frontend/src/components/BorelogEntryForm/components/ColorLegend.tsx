import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ColorLegend() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Color Code & Legend</CardTitle>
      </CardHeader>
      <CardContent>
                                                                                                           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
             <div className="flex items-center space-x-2">
               <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: '#FFEB00' }}></div>
               <span>Manual Input</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: '#ADADAC' }}></div>
               <span>Numeric Input</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: '#B55110' }}></div>
               <span>Calculated</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: '#FFC0CB' }}></div>
               <span>Linked Data/Sources</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: '#90EE90' }}></div>
               <span>Final Output</span>
             </div>
             <div className="flex items-center space-x-2">
               <div className="w-4 h-4 border border-gray-300 rounded" style={{ backgroundColor: '#FF6B6B' }}></div>
               <span>Hatch/Attachment</span>
             </div>
           </div>
      </CardContent>
    </Card>
  );
}

