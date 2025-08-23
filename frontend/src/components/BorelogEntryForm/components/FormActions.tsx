import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Send, History } from 'lucide-react';
import { WorkflowActions } from '../../WorkflowActions';

interface FormActionsProps {
  isSubmitting: boolean;
  isSaving: boolean;
  canEdit: boolean;
  canApprove: boolean;
  onSave: () => void;
  onShowVersionHistory: () => void;
  showVersionHistory: boolean;
  borelogId?: string;
  projectName?: string;
  boreholeNumber?: string;
  currentStatus?: string;
  versionNumber?: number;
  onActionComplete?: () => void;
}

export function FormActions({
  isSubmitting,
  isSaving,
  canEdit,
  canApprove,
  onSave,
  onShowVersionHistory,
  showVersionHistory,
  borelogId,
  projectName,
  boreholeNumber,
  currentStatus,
  versionNumber,
  onActionComplete
}: FormActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Badge variant={canEdit ? "default" : "secondary"}>
          {canEdit ? "Editable" : "Read Only"}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onShowVersionHistory}
          className="ml-2"
        >
          <History className="h-4 w-4 mr-2" />
          Version History
        </Button>
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
        
        {/* Workflow Actions */}
        {borelogId && projectName && boreholeNumber && currentStatus && versionNumber && (
          <WorkflowActions
            borelogId={borelogId}
            projectName={projectName}
            boreholeNumber={boreholeNumber}
            currentStatus={currentStatus}
            versionNumber={versionNumber}
            onActionComplete={onActionComplete}
          />
        )}
        
        {/* Regular submit button - only show if no workflow actions */}
        {(!borelogId || !projectName || !boreholeNumber || !currentStatus || !versionNumber) && (
          <Button
            type="submit"
            disabled={isSubmitting || !canEdit}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        )}
      </div>
    </div>
  );
}

