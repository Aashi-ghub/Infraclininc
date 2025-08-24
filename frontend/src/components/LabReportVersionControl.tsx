import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Save, 
  Send, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  History, 
  Eye, 
  FileText,
  Clock,
  User,
  MessageSquare,
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { labReportVersionControlApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Helper function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

interface LabReportVersionControlProps {
  reportId: string;
  currentVersion?: number;
  currentStatus?: string;
  onVersionChange?: (versionNo: number) => void;
  onStatusChange?: (status: string) => void;
  isReadOnly?: boolean;
  formData?: any; // Current form data for saving drafts
}

interface VersionHistoryItem {
  version_no: number;
  status: string;
  created_at: string;
  created_by_name: string;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  returned_at?: string;
  review_comments?: string;
  rejection_reason?: string;
  comments: Array<{
    comment_id: string;
    comment_type: string;
    comment_text: string;
    commented_by: string;
    commented_at: string;
  }>;
}

export function LabReportVersionControl({
  reportId,
  currentVersion = 1,
  currentStatus = 'draft',
  onVersionChange,
  onStatusChange,
  isReadOnly = false,
  formData
}: LabReportVersionControlProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'return_for_revision'>('approve');
  const [reviewComments, setReviewComments] = useState('');
  const [submissionComments, setSubmissionComments] = useState('');

  const typedUser = user as any;

  // Load version history
  useEffect(() => {
    if (reportId) {
      loadVersionHistory();
    }
  }, [reportId]);

  const loadVersionHistory = async () => {
    // Don't try to load version history if reportId is not provided
    if (!reportId) {
      return;
    }
    
    // If reportId is not a valid UUID yet, don't try to load version history
    if (!isValidUUID(reportId)) {
      return;
    }
    
    try {
      const response = await labReportVersionControlApi.getVersionHistory(reportId);
      if (response.success) {
        setVersionHistory(response.data.versions || []);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version history',
        variant: 'destructive',
      });
    }
  };

  // Handle draft saving
  const handleSaveDraft = async () => {
    if (!formData) {
      toast({
        title: 'Error',
        description: 'No form data available to save',
        variant: 'destructive',
      });
      return;
    }

    // Don't try to save draft if reportId is not a valid UUID
    if (!reportId || !isValidUUID(reportId)) {
      toast({
        title: 'Error',
        description: 'Please save the report first before creating versions',
        variant: 'destructive',
      });
      return;
    }

    // Format data for API
    const apiData = {
      report_id: reportId,
      assignment_id: formData.lab_request_id || '',
      borelog_id: formData.lab_request_id || '', // This should be the actual borelog ID
      sample_id: formData.borehole_no || '',
      project_name: formData.project_name || '',
      borehole_no: formData.borehole_no || '',
      client: formData.client || '',
      test_date: formData.date || new Date(),
      tested_by: formData.tested_by || '',
      checked_by: formData.checked_by || '',
      approved_by: formData.approved_by || '',
      test_types: [
        ...(formData.soil_test_completed ? ['Soil'] : []),
        ...(formData.rock_test_completed ? ['Rock'] : [])
      ],
      soil_test_data: formData.soil_test_data || [],
      rock_test_data: formData.rock_test_data || [],
      remarks: ''
    };

    setIsLoading(true);
    try {
      const response = await labReportVersionControlApi.saveDraft(apiData);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: `Draft saved as version ${response.data.version_no}`,
        });
        
        await loadVersionHistory();
        if (onVersionChange) {
          onVersionChange(response.data.version_no);
        }
        if (onStatusChange) {
          onStatusChange('draft');
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save draft',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle submission for review
  const handleSubmitForReview = async () => {
    // Don't try to submit if reportId is not a valid UUID
    if (!reportId || !isValidUUID(reportId)) {
      toast({
        title: 'Error',
        description: 'Please save the report first before submitting for review',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await labReportVersionControlApi.submitForReview({
        report_id: reportId,
        version_no: currentVersion,
        submission_comments: submissionComments
      });
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Lab report submitted for review',
        });
        
        await loadVersionHistory();
        if (onStatusChange) {
          onStatusChange('submitted');
        }
        setSubmissionComments('');
      }
    } catch (error) {
      console.error('Error submitting for review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit for review',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle review actions
  const handleReview = async () => {
    // Don't try to review if reportId is not a valid UUID
    if (!reportId || !isValidUUID(reportId)) {
      toast({
        title: 'Error',
        description: 'Invalid report ID',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await labReportVersionControlApi.review(reportId, {
        action: reviewAction,
        version_no: currentVersion,
        review_comments: reviewComments
      });
      
      if (response.success) {
        toast({
          title: 'Success',
          description: `Lab report ${reviewAction} successfully`,
        });
        
        await loadVersionHistory();
        if (onStatusChange) {
          onStatusChange(response.data.status);
        }
        setShowReviewDialog(false);
        setReviewComments('');
      }
    } catch (error) {
      console.error('Error reviewing report:', error);
      toast({
        title: 'Error',
        description: 'Failed to review report',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load specific version
  const handleLoadVersion = async (versionNo: number) => {
    // Don't try to load version if reportId is not a valid UUID
    if (!reportId || !isValidUUID(reportId)) {
      toast({
        title: 'Error',
        description: 'Invalid report ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await labReportVersionControlApi.getVersion(reportId, versionNo);
      if (response.success) {
        if (onVersionChange) {
          onVersionChange(versionNo);
        }
        if (onStatusChange) {
          onStatusChange(response.data.status);
        }
        setShowVersionHistory(false);
        toast({
          title: 'Success',
          description: `Loaded version ${versionNo}`,
        });
      }
    } catch (error) {
      console.error('Error loading version:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: <Square className="h-3 w-3" /> },
      submitted: { color: 'bg-blue-100 text-blue-800', icon: <Send className="h-3 w-3" /> },
      approved: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> },
      returned_for_revision: { color: 'bg-orange-100 text-orange-800', icon: <RotateCcw className="h-3 w-3" /> }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const canReview = ['Approval Engineer', 'Admin'].includes(typedUser?.role);
  const canSubmit = currentStatus === 'draft' && !isReadOnly;
  const canSaveDraft = !isReadOnly;

  return (
    <div className="space-y-4">
      {/* Version Control Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reportId || !isValidUUID(reportId) ? (
            <div className="text-center py-4 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>Save a draft first to enable version control</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
            {/* Current Version Info */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              Version {currentVersion}
              {getStatusBadge(currentStatus)}
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Action Buttons */}
                         {canSaveDraft && (
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleSaveDraft}
                 disabled={isLoading}
               >
                 <Save className="h-4 w-4 mr-2" />
                 Save Draft
               </Button>
             )}

            {canSubmit && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isLoading}>
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Submit for Review</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="submission-comments">Comments (Optional)</Label>
                      <Textarea
                        id="submission-comments"
                        placeholder="Add any comments for the reviewer..."
                        value={submissionComments}
                        onChange={(e) => setSubmissionComments(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setSubmissionComments('')}>
                        Cancel
                      </Button>
                      <Button onClick={handleSubmitForReview}>
                        Submit
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {canReview && currentStatus === 'submitted' && (
              <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isLoading}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Review
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Review Lab Report</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Review Action</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={reviewAction === 'approve' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReviewAction('approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant={reviewAction === 'reject' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReviewAction('reject')}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          variant={reviewAction === 'return_for_revision' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReviewAction('return_for_revision')}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Return for Revision
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="review-comments">Comments</Label>
                      <Textarea
                        id="review-comments"
                        placeholder="Add review comments..."
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleReview} disabled={isLoading}>
                        {reviewAction === 'approve' ? 'Approve' : 
                         reviewAction === 'reject' ? 'Reject' : 'Return for Revision'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-2" />
                  Version History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Version History</DialogTitle>
                </DialogHeader>
                <div className="max-h-96 overflow-y-auto">
                  {versionHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No version history available</p>
                  ) : (
                    <div className="space-y-3">
                      {versionHistory.map((version) => (
                        <Card key={version.version_no} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Version {version.version_no}</Badge>
                              {getStatusBadge(version.status)}
                              {version.version_no === currentVersion && (
                                <Badge variant="secondary">Current</Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLoadVersion(version.version_no)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Load
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {version.created_by_name}
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {new Date(version.created_at).toLocaleString()}
                            </div>
                          </div>

                          {/* Status-specific timestamps */}
                          {version.submitted_at && (
                            <div className="text-sm text-blue-600 mt-1">
                              Submitted: {new Date(version.submitted_at).toLocaleString()}
                            </div>
                          )}
                          {version.approved_at && (
                            <div className="text-sm text-green-600 mt-1">
                              Approved: {new Date(version.approved_at).toLocaleString()}
                            </div>
                          )}
                          {version.rejected_at && (
                            <div className="text-sm text-red-600 mt-1">
                              Rejected: {new Date(version.rejected_at).toLocaleString()}
                            </div>
                          )}
                          {version.returned_at && (
                            <div className="text-sm text-orange-600 mt-1">
                              Returned: {new Date(version.returned_at).toLocaleString()}
                            </div>
                          )}

                          {/* Comments */}
                          {(version.review_comments || version.rejection_reason || version.comments?.length > 0) && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4" />
                                <span className="font-medium">Comments</span>
                              </div>
                              <div className="space-y-2">
                                {version.review_comments && (
                                  <div className="text-sm bg-gray-50 p-2 rounded">
                                    {version.review_comments}
                                  </div>
                                )}
                                {version.rejection_reason && (
                                  <div className="text-sm bg-red-50 p-2 rounded text-red-700">
                                    <strong>Rejection Reason:</strong> {version.rejection_reason}
                                  </div>
                                )}
                                {version.comments?.map((comment) => (
                                  <div key={comment.comment_id} className="text-sm bg-blue-50 p-2 rounded">
                                    <div className="font-medium">{comment.comment_type.replace('_', ' ').toUpperCase()}</div>
                                    <div>{comment.comment_text}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {comment.commented_by} - {new Date(comment.commented_at).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
