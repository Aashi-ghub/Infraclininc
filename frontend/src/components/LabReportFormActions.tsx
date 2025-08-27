import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Send, History, Eye } from 'lucide-react';

interface LabReportFormActionsProps {
  isSubmitting: boolean;
  isSaving: boolean;
  canEdit: boolean;
  canApprove: boolean;
  onSave: () => void;
  onShowVersionHistory: () => void;
  showVersionHistory: boolean;
  reportId?: string;
  projectName?: string;
  boreholeNumber?: string;
  currentStatus?: string;
  versionNumber?: number;
  onActionComplete?: () => void;
  onLoadLatestVersion?: () => void;
  hasUnsavedChanges?: boolean;
}

export function LabReportFormActions({
  isSubmitting,
  isSaving,
  canEdit,
  canApprove,
  onSave,
  onShowVersionHistory,
  showVersionHistory,
  reportId,
  projectName,
  boreholeNumber,
  currentStatus,
  versionNumber,
  onActionComplete,
  onLoadLatestVersion,
  hasUnsavedChanges = false
}: LabReportFormActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Badge variant={canEdit ? "default" : "secondary"}>
          {canEdit ? "Editable" : "Read Only"}
        </Badge>
        
        {reportId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onShowVersionHistory}
          >
            <History className="h-4 w-4 mr-2" />
            Version History
          </Button>
        )}
        
        {onLoadLatestVersion && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadLatestVersion}
          >
            <Eye className="h-4 w-4 mr-2" />
            Load Latest
          </Button>
        )}
        
        {hasUnsavedChanges && (
          <Badge variant="destructive" className="animate-pulse">
            Unsaved Changes
          </Badge>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
        )}
        
        {canEdit && currentStatus === 'draft' && (
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        )}
        
        {canApprove && currentStatus === 'submitted' && (
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                // This would trigger the approval dialog
                if (onActionComplete) onActionComplete();
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Review
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}






