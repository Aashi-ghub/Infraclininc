import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function ColorLegend() {
  return (
    <>
      {/* Compact Color Code Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs bg-gray-50 p-2 rounded">
        <div className="flex items-center space-x-1">
          <div className="w-4 h-3 bg-yellow-200 border border-gray-300"></div>
          <span><strong>Manual Input</strong></span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-3 bg-gray-200 border border-gray-300"></div>
          <span><strong>Numeric Input</strong></span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-4 h-3 bg-amber-700 border border-gray-300"></div>
          <span><strong>Calculated</strong></span>
        </div>
        <div className="ml-4">
          <strong>Sample Types:</strong> D=Disturbed, S/D=SPT+Disturbed, S=SPT, U=Undisturbed, W=Water, R/C=Run+Core (use subdivisions like S/D-1, S/D-2, U-1, etc.)
        </div>
      </div>

      {/* Color Code Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Color Code & Legend</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Color coding explanation - Matching Excel exactly */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-6 bg-yellow-300 border border-gray-800"></div>
              <span><strong>Text Manual Input</strong> - Editable fields for manual entry</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-6 bg-gray-300 border border-gray-800"></div>
              <span><strong>Numerical value Manual Input</strong> - Numeric input fields</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-6 bg-red-200 border border-gray-800"></div>
              <span><strong>Others Input Source</strong> - Links from other sources</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-6 bg-orange-600 border border-gray-800"></div>
              <span><strong>Calculation Part (Link Required)</strong> - Auto-calculated values</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-6 bg-emerald-400 border border-gray-800"></div>
              <span><strong>Final output</strong> - System auto-filled values</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-6 bg-red-600 border border-gray-800"></div>
              <span><strong>Hatch Insert as a Photo</strong> - Image/attachment fields</span>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          {/* Comprehensive legend matching Excel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <strong className="text-sm">Sample Types:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>D:</strong> Disturbed Sample</li>
                <li><strong>U:</strong> Undisturbed Sample</li>
                <li><strong>S/D:</strong> Standard Penetration Test with disturbed sample collected</li>
                <li><strong>S:</strong> Standard Penetration Test but sample not recovered</li>
                <li><strong>U*:</strong> UDS Could not been Collected (Slipped)</li>
              </ul>
            </div>
            <div>
              <strong className="text-sm">Test & Recovery Codes:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>VS:</strong> Vane Shear Test</li>
                <li><strong>W:</strong> Water Sample</li>
                <li><strong>PT:</strong> Permeability Test</li>
                <li><strong>R/C:</strong> Run with core sample collected</li>
                <li><strong>R:</strong> Run but core sample not recovered</li>
                <li><strong>Re:</strong> Refusal</li>
                <li><strong>B:</strong> Blows</li>
              </ul>
            </div>
            <div>
              <strong className="text-sm">Measurements & Standards:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>BGL:</strong> Below Ground Level</li>
                <li><strong>AGL:</strong> Above Ground Level</li>
                <li><strong>MSL:</strong> Mean Sea Level</li>
                <li><strong>TCR:</strong> Total Core Recovery</li>
                <li><strong>RQD:</strong> Rock Quality Designation</li>
                <li><strong>SPT:</strong> Standard Penetration Test</li>
              </ul>
            </div>
            <div>
              <strong className="text-sm">Field Codes:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>N:</strong> N-Value (SPT blows)</li>
                <li><strong>15cm:</strong> 15 centimeter intervals</li>
                <li><strong>Run:</strong> Drilling run length</li>
                <li><strong>Core:</strong> Core sample length</li>
                <li><strong>Chainage:</strong> Distance along alignment</li>
                <li><strong>Coordinates:</strong> E=Easting, L=Northing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
