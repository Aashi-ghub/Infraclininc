import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, CheckCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { BorelogFormData } from './types';

interface Version {
  version_id: string;
  version_number: number;
  status: string;
  editor_name: string;
  created_at: string;
  approval_comments?: string;
  is_latest_approved?: boolean;
}

interface VersionHistoryProps {
  versions: Version[];
  canApprove: boolean;
  form: UseFormReturn<BorelogFormData>;
  onLoadVersion: (versionId: string) => void;
  onApproveVersion: (versionId: string) => void;
  onRejectVersion: (versionId: string) => void;
}

export function VersionHistory({
  versions,
  canApprove,
  form,
  onLoadVersion,
  onApproveVersion,
  onRejectVersion
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
            <div key={version.version_id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Badge variant={version.status === 'approved' ? 'default' : version.status === 'submitted' ? 'secondary' : 'outline'}>
                    Version {version.version_number}
                  </Badge>
                  <Badge variant={version.status === 'approved' ? 'default' : version.status === 'submitted' ? 'secondary' : 'outline'}>
                    {version.status}
                  </Badge>
                  {version.is_latest_approved && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Final Report
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Edited by {version.editor_name} on {new Date(version.created_at).toLocaleDateString()} at {new Date(version.created_at).toLocaleTimeString()}
                </p>
                {version.approval_comments && (
                  <p className="text-sm text-blue-600 mt-1">
                    <strong>Comments:</strong> {version.approval_comments}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadVersion(version.version_id)}
                  disabled={version.version_number === form.watch('version_number')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {version.version_number === form.watch('version_number') ? 'Current' : 'Load'}
                </Button>
                {canApprove && version.status === 'submitted' && (
                  <div className="flex space-x-1">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => onApproveVersion(version.version_id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onRejectVersion(version.version_id)}
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

