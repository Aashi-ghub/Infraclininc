import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Eye, CheckCircle, XCircle, History, FileText, Clock, User, Calendar, FlaskConical, MapPin, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LabReport, getLabReportStatusVariant } from '@/lib/types';

interface LabReportViewProps {
  report: LabReport;
  onClose: () => void;
  onReview?: (reportId: string, status: 'Approved' | 'Rejected', comments?: string) => void;
  userRole?: string;
}

export default function LabReportView({ report, onClose, onReview, userRole }: LabReportViewProps) {
  const [reviewComments, setReviewComments] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const { toast } = useToast();

  const handleReview = async (status: 'Approved' | 'Rejected') => {
    if (status === 'Rejected' && !reviewComments.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide rejection comments',
      });
      return;
    }

    setIsReviewing(true);
    
    try {
      if (onReview) {
        await onReview(report.id, status, reviewComments);
      }
      
      setReviewComments('');
      toast({
        title: 'Success',
        description: `Report ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to review report',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const getStatusColor = (status: LabReport['status']) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Submitted': return 'bg-blue-100 text-blue-800';
      case 'Under Review': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Lab Report Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{report.test_type}</CardTitle>
                  <p className="text-muted-foreground">Report ID: {report.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getLabReportStatusVariant(report.status)}>
                    {report.status}
                  </Badge>
                  <Badge variant="outline">v{report.version}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Sample ID</p>
                    <p className="text-sm text-muted-foreground">{report.sample_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Borehole</p>
                    <p className="text-sm text-muted-foreground">{report.borelog.borehole_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Submitted By</p>
                    <p className="text-sm text-muted-foreground">{report.submitted_by}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Submitted Date</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(report.submitted_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium">Project Name</p>
                  <p className="text-sm text-muted-foreground">{report.borelog.project_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Borehole Number</p>
                  <p className="text-sm text-muted-foreground">{report.borelog.borehole_number}</p>
                </div>
                {report.borelog.chainage && (
                  <div>
                    <p className="text-sm font-medium">Chainage</p>
                    <p className="text-sm text-muted-foreground">{report.borelog.chainage}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm font-mono">{report.results}</pre>
              </div>
            </CardContent>
          </Card>

          {/* File Attachment */}
          {report.file_url && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Attached Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      PDF Report Document
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval Information */}
          {report.status === 'Approved' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Approval Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Approved By</p>
                    <p className="text-sm text-muted-foreground">{report.approved_by}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Approved Date</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(report.approved_at!), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejection Information */}
          {report.status === 'Rejected' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Rejection Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Rejected By</p>
                      <p className="text-sm text-muted-foreground">{report.rejected_by}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Rejected Date</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.rejected_at!), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  {report.rejection_comments && (
                    <div>
                      <p className="text-sm font-medium">Rejection Comments</p>
                      <div className="bg-red-50 p-3 rounded-lg mt-2">
                        <p className="text-sm text-red-800">{report.rejection_comments}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{report.version}</Badge>
                    <span className="text-sm font-medium">Current Version</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Submitted on {format(new Date(report.submitted_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <Badge variant={getLabReportStatusVariant(report.status)}>
                    {report.status}
                  </Badge>
                </div>
                {/* Add more version history items here when implementing versioning */}
              </div>
            </CardContent>
          </Card>

          {/* Approval Actions (for Approval Engineers) */}
          {userRole === 'Approval Engineer' && report.status === 'Submitted' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Review Comments (for rejection)</label>
                    <Textarea
                      placeholder="Enter comments if rejecting the report..."
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="default" 
                          className="bg-green-600 hover:bg-green-700"
                          disabled={isReviewing}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {isReviewing ? 'Approving...' : 'Approve Report'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Approve Report</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to approve this lab report? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleReview('Approved')}>
                            Approve
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive"
                          disabled={isReviewing || !reviewComments.trim()}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {isReviewing ? 'Rejecting...' : 'Reject Report'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reject Report</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to reject this lab report? Please ensure you have provided rejection comments.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleReview('Rejected')}>
                            Reject
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
