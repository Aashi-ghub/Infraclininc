import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';
import { workflowApi } from '../lib/api';
import { format } from 'date-fns';
import { FileText, CheckCircle, XCircle, RotateCcw, Eye, Download } from 'lucide-react';

interface PendingCSVUpload {
  upload_id: string;
  project_name: string;
  structure_type: string;
  substructure_type: string;
  uploaded_by_name: string;
  uploaded_at: string;
  file_type: string;
  total_records: number;
  status: 'pending' | 'approved' | 'rejected' | 'returned_for_revision';
  approval_comments?: string;
  rejection_reason?: string;
  revision_notes?: string;
  borelog_header: any;
  stratum_preview: any[];
  total_stratum_layers: number;
}

export function PendingCSVUploadsManager() {
  const { toast } = useToast();
  const [uploads, setUploads] = useState<PendingCSVUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<PendingCSVUpload | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'return_for_revision'>('approve');
  const [comments, setComments] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPendingUploads();
  }, []);

  const loadPendingUploads = async () => {
    try {
      setIsLoading(true);
      const response = await workflowApi.getPendingCSVUploads({ status: 'pending' });
      setUploads(response.data.data?.uploads || []);
    } catch (error) {
      console.error('Error loading pending CSV uploads:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending CSV uploads',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedUpload) return;

    try {
      setIsProcessing(true);
      
      const data: any = { action };
      if (comments.trim()) {
        if (action === 'approve') {
          data.comments = comments;
        } else if (action === 'reject') {
          data.comments = comments;
        } else if (action === 'return_for_revision') {
          data.revision_notes = revisionNotes.trim() || comments;
        }
      }

      await workflowApi.approvePendingCSVUpload(selectedUpload.upload_id, data);
      
      toast({
        title: 'Success',
        description: `CSV upload ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned for revision'} successfully`,
      });

      // Refresh the list
      await loadPendingUploads();
      
      // Close dialog and reset form
      setIsActionDialogOpen(false);
      setSelectedUpload(null);
      setAction('approve');
      setComments('');
      setRevisionNotes('');
      
    } catch (error) {
      console.error('Error processing CSV upload:', error);
      toast({
        title: 'Error',
        description: 'Failed to process CSV upload',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'returned_for_revision':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'returned_for_revision':
        return <RotateCcw className="h-4 w-4 text-orange-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending CSV Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading pending CSV uploads...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending CSV Uploads
            <Badge variant="outline">{uploads.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending CSV uploads</h3>
              <p className="text-muted-foreground">
                All CSV uploads have been processed or there are no new uploads awaiting approval.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Structure</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.upload_id}>
                    <TableCell>
                      <div className="font-medium">{upload.project_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {upload.structure_type} / {upload.substructure_type}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(upload.status)}
                        <Badge variant={getStatusVariant(upload.status)}>
                          {upload.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{upload.uploaded_by_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(upload.uploaded_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{upload.total_records}</div>
                      <div className="text-xs text-muted-foreground">
                        {upload.total_stratum_layers} layers
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(upload.uploaded_at), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {upload.file_type.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>CSV Upload Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2">Project Information</h4>
                                  <div className="space-y-2 text-sm">
                                    <div><span className="font-medium">Project:</span> {upload.project_name}</div>
                                    <div><span className="font-medium">Structure:</span> {upload.structure_type}</div>
                                    <div><span className="font-medium">Substructure:</span> {upload.substructure_type}</div>
                                    <div><span className="font-medium">Uploaded by:</span> {upload.uploaded_by_name}</div>
                                    <div><span className="font-medium">Total records:</span> {upload.total_records}</div>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Header Data</h4>
                                  <div className="space-y-2 text-sm">
                                    {upload.borelog_header && Object.entries(upload.borelog_header).map(([key, value]) => (
                                      <div key={key}>
                                        <span className="font-medium">{key}:</span> {String(value)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="font-semibold mb-2">Stratum Layers Preview</h4>
                                <div className="max-h-60 overflow-y-auto border rounded p-2">
                                  {upload.stratum_preview?.map((layer, index) => (
                                    <div key={index} className="text-sm p-2 border-b last:border-b-0">
                                      <div className="font-medium">Layer {index + 1}</div>
                                      {Object.entries(layer).map(([key, value]) => (
                                        <div key={key} className="text-xs text-muted-foreground">
                                          {key}: {String(value)}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUpload(upload);
                            setAction('approve');
                            setComments('');
                            setRevisionNotes('');
                            setIsActionDialogOpen(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUpload(upload);
                            setAction('reject');
                            setComments('');
                            setRevisionNotes('');
                            setIsActionDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUpload(upload);
                            setAction('return_for_revision');
                            setComments('');
                            setRevisionNotes('');
                            setIsActionDialogOpen(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Return
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' && 'Approve CSV Upload'}
              {action === 'reject' && 'Reject CSV Upload'}
              {action === 'return_for_revision' && 'Return CSV Upload for Revision'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedUpload && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Upload Details</h4>
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Project:</span> {selectedUpload.project_name}</div>
                  <div><span className="font-medium">Records:</span> {selectedUpload.total_records}</div>
                  <div><span className="font-medium">Uploaded by:</span> {selectedUpload.uploaded_by_name}</div>
                </div>
              </div>
            )}

            {action === 'approve' && (
              <div>
                <label className="text-sm font-medium">Approval Comments (Optional)</label>
                <Textarea
                  placeholder="Add any comments about this approval..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {action === 'reject' && (
              <div>
                <label className="text-sm font-medium">Rejection Reason (Required)</label>
                <Textarea
                  placeholder="Please provide a reason for rejection..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            )}

            {action === 'return_for_revision' && (
              <div>
                <label className="text-sm font-medium">Revision Notes (Required)</label>
                <Textarea
                  placeholder="Please provide specific notes about what needs to be revised..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsActionDialogOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={isProcessing || (action === 'reject' && !comments.trim()) || (action === 'return_for_revision' && !revisionNotes.trim())}
                className={
                  action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }
              >
                {isProcessing ? 'Processing...' : 
                  action === 'approve' ? 'Approve' :
                  action === 'reject' ? 'Reject' :
                  'Return for Revision'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
