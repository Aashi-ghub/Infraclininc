import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../lib/auth';
import { labReportApi } from '../../lib/api';
import { useToast } from '../../hooks/use-toast';
import { format } from 'date-fns';
import { Loader } from '../../components/Loader';

interface LabTestDetail {
  id: string;
  borelog_id: string;
  sample_id: string;
  test_type: string;
  priority: string;
  due_date: string;
  notes: string;
  requested_by: string;
  requested_date: string;
  status: string;
  borelog: {
    borehole_number: string;
    project_name: string;
    chainage: string;
  };
}

export default function LabTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [labTest, setLabTest] = useState<LabTestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState<string>('assigned');
  const [progressNotes, setProgressNotes] = useState<string>('');
  const [testResults, setTestResults] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadLabTest();
    }
  }, [id]);

  const loadLabTest = async () => {
    try {
      setIsLoading(true);
      const response = await labReportApi.getRequestById(id!);
      const labTestData = response.data.data;
      setLabTest(labTestData);
      setStatus(labTestData.status || 'assigned');
      setProgressNotes(labTestData.notes || '');
    } catch (error) {
      console.error('Failed to load lab test:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lab test details',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!labTest) return;

    try {
      setIsUpdating(true);
      await labReportApi.updateRequest(id!, {
        status,
        notes: progressNotes,
        test_results: testResults ? JSON.parse(testResults) : null
      });

      toast({
        title: 'Success',
        description: 'Lab test updated successfully',
      });

      // Reload the data
      await loadLabTest();
    } catch (error) {
      console.error('Failed to update lab test:', error);
      toast({
        title: 'Error',
        description: 'Failed to update lab test',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lab test? This action cannot be undone.')) {
      return;
    }

    try {
      await labReportApi.deleteRequest(id!);
      toast({
        title: 'Success',
        description: 'Lab test deleted successfully',
      });
      navigate('/workflow/dashboard');
    } catch (error) {
      console.error('Failed to delete lab test:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lab test',
        variant: 'destructive',
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'outline';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'default';
      case 'reviewed':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (!labTest) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Lab test not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Lab Test Details</h1>
        <div className="flex gap-2">
          {user?.role === 'Admin' && (
            <Button variant="destructive" onClick={handleDelete}>
              Delete Lab Test
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/workflow/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lab Test Information */}
        <Card>
          <CardHeader>
            <CardTitle>Test Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Project</Label>
                <p className="text-sm">{labTest.borelog.project_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Borehole</Label>
                <p className="text-sm">{labTest.borelog.borehole_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Sample ID</Label>
                <p className="text-sm">{labTest.sample_id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Test Type</Label>
                <p className="text-sm">{labTest.test_type}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                <Badge variant={getPriorityVariant(labTest.priority)}>
                  {labTest.priority}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                <Badge variant={getStatusVariant(labTest.status)}>
                  {labTest.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Due Date</Label>
              <p className="text-sm">
                {labTest.due_date ? 
                  (() => {
                    try {
                      return format(new Date(labTest.due_date), 'MMM dd, yyyy');
                    } catch (error) {
                      return 'Invalid Date';
                    }
                  })() : 
                  'Not set'
                }
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Assigned By</Label>
              <p className="text-sm">{labTest.requested_by}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Assigned Date</Label>
              <p className="text-sm">
                {labTest.requested_date ? 
                  (() => {
                    try {
                      return format(new Date(labTest.requested_date), 'MMM dd, yyyy HH:mm');
                    } catch (error) {
                      return 'Invalid Date';
                    }
                  })() : 
                  'Not set'
                }
              </p>
            </div>

            {labTest.notes && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                <p className="text-sm">{labTest.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Update Progress */}
        {user?.role === 'Lab Engineer' && (
          <Card>
            <CardHeader>
              <CardTitle>Update Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="progressNotes">Progress Notes</Label>
                <Textarea
                  id="progressNotes"
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  placeholder="Add progress notes..."
                  rows={3}
                />
              </div>

              {status === 'completed' && (
                <div>
                  <Label htmlFor="testResults">Test Results (JSON)</Label>
                  <Textarea
                    id="testResults"
                    value={testResults}
                    onChange={(e) => setTestResults(e.target.value)}
                    placeholder='{"test_parameter": "value", "unit": "unit"}'
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter test results in JSON format
                  </p>
                </div>
              )}

              <Button 
                onClick={handleStatusUpdate} 
                disabled={isUpdating}
                className="w-full"
              >
                {isUpdating ? 'Updating...' : 'Update Progress'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
