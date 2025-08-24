import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

interface Version {
  version_no: number;
  created_at: string;
  status: string;
  created_by: {
    user_id: string;
    name: string;
    email: string;
  };
  details: {
    project_name: string;
    borehole_no: string;
    client: string;
    test_date: string;
    tested_by: string;
    checked_by: string;
    approved_by: string;
    test_types: string[];
    soil_test_data: any[];
    rock_test_data: any[];
    remarks: string;
    submission_comments?: string;
    review_comments?: string;
    rejection_reason?: string;
  };
}

export interface LabReportVersionHistoryProps {
  versions: Version[];
  canApprove: boolean;
  form: UseFormReturn<any>;
  onLoadVersion: (version: Version) => void;
  onApproveVersion: (versionNo: number) => void;
  onRejectVersion: (versionNo: number) => void;
  onReturnForRevision: (versionNo: number) => void;
  activeVersionNo: number | null;
}

export function LabReportVersionHistory({
  versions,
  canApprove,
  form,
  onLoadVersion,
  onApproveVersion,
  onRejectVersion,
  onReturnForRevision,
  activeVersionNo
}: LabReportVersionHistoryProps) {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'returned_for_revision':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'submitted':
        return <FileText className="h-4 w-4 text-blue-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'returned_for_revision':
        return 'secondary';
      case 'submitted':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {versions.map((version) => (
            <div key={version.version_no} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline">
                    Version {version.version_no}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(version.status)}>
                    {getStatusIcon(version.status)}
                    <span className="ml-1 capitalize">{version.status.replace('_', ' ')}</span>
                  </Badge>
                  {version.version_no === (versions[0]?.version_no ?? version.version_no) && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Latest
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Created by:</strong> {version.created_by.name} on {new Date(version.created_at).toLocaleDateString()} at {new Date(version.created_at).toLocaleTimeString()}
                  </p>
                  <p>
                    <strong>Project:</strong> {version.details.project_name} | <strong>Borehole:</strong> {version.details.borehole_no}
                  </p>
                  <p>
                    <strong>Test Types:</strong> {version.details.test_types?.join(', ') || 'None specified'}
                  </p>
                  {version.details.remarks && (
                    <p className="text-blue-600">
                      <strong>Remarks:</strong> {version.details.remarks}
                    </p>
                  )}
                  {version.details.submission_comments && (
                    <p className="text-green-600">
                      <strong>Submission Comments:</strong> {version.details.submission_comments}
                    </p>
                  )}
                  {version.details.review_comments && (
                    <p className="text-purple-600">
                      <strong>Review Comments:</strong> {version.details.review_comments}
                    </p>
                  )}
                  {version.details.rejection_reason && (
                    <p className="text-red-600">
                      <strong>Rejection Reason:</strong> {version.details.rejection_reason}
                    </p>
                  )}
                </div>
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
                
                {canApprove && version.version_no === (versions[0]?.version_no ?? version.version_no) && version.status === 'submitted' && (
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onReturnForRevision(version.version_no)}
                    >
                      Return
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
