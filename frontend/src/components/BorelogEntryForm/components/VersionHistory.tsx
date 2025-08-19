import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, CheckCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { BorelogFormData } from './types';

interface Version {
  version_no: number;
  created_at: string;
  created_by: {
    user_id: string;
    name: string;
    email: string;
  };
  details: {
    number: string;
    msl: string;
    boring_method: string;
    hole_diameter: number;
    commencement_date: string;
    completion_date: string;
    standing_water_level: number;
    termination_depth: number;
    coordinate: any;
    permeability_test_count: string;
    spt_vs_test_count: string;
    undisturbed_sample_count: string;
    disturbed_sample_count: string;
    water_sample_count: string;
    stratum_description: string;
    stratum_depth_from: number;
    stratum_depth_to: number;
    stratum_thickness_m: number;
    sample_event_type: string;
    sample_event_depth_m: number;
    run_length_m: number;
    spt_blows_per_15cm: number;
    n_value_is_2131: string;
    total_core_length_cm: number;
    tcr_percent: number;
    rqd_length_cm: number;
    rqd_percent: number;
    return_water_colour: string;
    water_loss: string;
    borehole_diameter: number;
    remarks: string;
    images: string;
  };
}

export interface VersionHistoryProps {
  versions: Version[];
  canApprove: boolean;
  form: UseFormReturn<BorelogFormData>;
  onLoadVersion: (version: Version) => void;
  onApproveVersion: (versionNo: number) => void;
  onRejectVersion: (versionNo: number) => void;
  activeVersionNo: number | null;
}

export function VersionHistory({
  versions,
  canApprove,
  form,
  onLoadVersion,
  onApproveVersion,
  onRejectVersion,
  activeVersionNo
}: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No version history available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {versions.map((version) => (
            <div key={version.version_no} className="flex items-center justify-between p-3 border rounded">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    Version {version.version_no}
                  </Badge>
                  <Badge variant="outline">
                    Created
                  </Badge>
                  {version.version_no === (versions[0]?.version_no ?? version.version_no) && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Latest
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Created by {version.created_by.name} on {new Date(version.created_at).toLocaleDateString()} at {new Date(version.created_at).toLocaleTimeString()}
                </p>
                {version.details.remarks && (
                  <p className="text-sm text-blue-600 mt-1">
                    <strong>Remarks:</strong> {version.details.remarks}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadVersion(version)}
                  disabled={activeVersionNo !== null ? version.version_no === activeVersionNo : version.version_no === form.watch('version_number')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {(activeVersionNo !== null ? version.version_no === activeVersionNo : version.version_no === form.watch('version_number')) ? 'Current' : 'Load'}
                </Button>
                {canApprove && version.version_no === (versions[0]?.version_no ?? version.version_no) && (
                  <div className="flex space-x-1">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => onApproveVersion(version.version_no)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onRejectVersion(version.version_no)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

