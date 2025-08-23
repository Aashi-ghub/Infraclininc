import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../lib/auth';
import { workflowApi } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { LabTestAssignment } from './LabTestAssignment';

interface WorkflowActionsProps {
  borelogId: string;
  projectName: string;
  boreholeNumber: string;
  currentStatus: string;
  versionNumber: number;
  onActionComplete?: () => void;
}

export function WorkflowActions({
  borelogId,
  projectName,
  boreholeNumber,
  currentStatus,
  versionNumber,
  onActionComplete
}: WorkflowActionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitComments, setSubmitComments] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'return_for_revision'>('approve');
  const [reviewComments, setReviewComments] = useState('');

  const handleSubmitForReview = async () => {
    console.log('handleSubmitForReview called with:', {
      borelogId,
      versionNumber,
      submitComments
    });
    
    if (!submitComments.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide submission comments',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('Submitting for review...');
      await workflowApi.submitForReview(borelogId, {
        comments: submitComments,
        version_number: versionNumber
      });

      toast({
        title: 'Success',
        description: 'Borelog submitted for review successfully',
      });

      setIsSubmitDialogOpen(false);
      setSubmitComments('');
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error('Failed to submit for review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit for review',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewComments.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide review comments',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await workflowApi.reviewBorelog(borelogId, {
        action: reviewAction,
        comments: reviewComments,
        version_number: versionNumber
      });

      toast({
        title: 'Success',
        description: `Borelog ${reviewAction} successfully`,
      });

      setIsReviewDialogOpen(false);
      setReviewComments('');
      setReviewAction('approve');
      if (onActionComplete) {
        onActionComplete();
      }
    } catch (error) {
      console.error('Failed to review borelog:', error);
      toast({
        title: 'Error',
        description: 'Failed to review borelog',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmitForReview = () => {
    const canSubmit = (user?.role === 'Site Engineer' || user?.role === 'Admin') && 
           (currentStatus === 'draft' || currentStatus === 'returned_for_revision');
    console.log('canSubmitForReview check:', {
      userRole: user?.role,
      currentStatus,
      canSubmit
    });
    return canSubmit;
  };

  const canReview = () => {
    return (user?.role === 'Approval Engineer' || user?.role === 'Admin') && 
           currentStatus === 'submitted';
  };

  const canAssignLabTests = () => {
    return (user?.role === 'Project Manager' || user?.role === 'Admin') && 
           currentStatus === 'approved';
  };

  console.log('WorkflowActions render check:', {
    canSubmitForReview: canSubmitForReview(),
    canReview: canReview(),
    canAssignLabTests: canAssignLabTests(),
    userRole: user?.role,
    currentStatus
  });
  
  if (!canSubmitForReview() && !canReview() && !canAssignLabTests()) {
    console.log('WorkflowActions returning null - no actions available');
    return null;
  }

  return (
    <div className="flex gap-2">
      {/* Submit for Review Button */}
      {canSubmitForReview() && (
        <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              Submit for Review
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit for Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="submit-comments">Comments</Label>
                <Textarea
                  id="submit-comments"
                  value={submitComments}
                  onChange={(e) => setSubmitComments(e.target.value)}
                  placeholder="Add any comments about this submission..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsSubmitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitForReview}
                  disabled={isLoading}
                >
                  {isLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Review Actions */}
      {canReview() && (
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              Review
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Borelog</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="review-action">Action</Label>
                <Select
                  value={reviewAction}
                  onValueChange={(value: 'approve' | 'reject' | 'return_for_revision') => 
                    setReviewAction(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="return_for_revision">Return for Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="review-comments">Comments *</Label>
                <Textarea
                  id="review-comments"
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="Provide detailed feedback..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsReviewDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReview}
                  disabled={isLoading}
                  variant={reviewAction === 'reject' ? 'destructive' : 'default'}
                >
                  {isLoading ? 'Processing...' : reviewAction}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Lab Tests */}
      {canAssignLabTests() && (
        <LabTestAssignment
          borelogId={borelogId}
          projectName={projectName}
          boreholeNumber={boreholeNumber}
          onAssignmentComplete={onActionComplete}
        />
      )}
    </div>
  );
}

