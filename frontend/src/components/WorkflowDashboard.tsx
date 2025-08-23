import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useAuth } from '../lib/auth';
import { workflowApi } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { format } from 'date-fns';
import { Loader } from './Loader';

interface PendingReview {
  borelog_id: string;
  version_no: number;
  status: string;
  submitted_by: string;
  submitted_at: string;
  created_at: string;
  submission_comments?: string;
  project_name: string;
  substructure_name?: string;
  submitted_by_name?: string;
}

interface LabAssignment {
  id: string;
  borelog_id: string;
  sample_id: string;
  test_type: string;
  priority: 'low' | 'medium' | 'high';
  expected_completion_date: string;
  status: string;
  assigned_at: string;
  project_name: string;
  borehole_number: string;
}

interface WorkflowStatistics {
  projects: Array<{
    project_id: string;
    project_name: string;
    total_borelogs: string;
    draft_count: string;
    submitted_count: string;
    approved_count: string;
    rejected_count: string;
    returned_count: string;
  }>;
  totals: {
    total_borelogs: number;
    draft_count: number;
    submitted_count: number;
    approved_count: number;
    rejected_count: number;
    returned_count: number;
  };
}

interface SubmittedBorelog {
  borelog_id: string;
  version_no: number;
  status: string;
  submitted_by: string;
  submitted_at: string;
  created_at: string;
  submission_comments?: string;
  review_comments?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  returned_by?: string;
  returned_at?: string;
  project_name: string;
  substructure_name?: string;
  submitted_by_name?: string;
  approved_by_name?: string;
  rejected_by_name?: string;
  returned_by_name?: string;
}

export function WorkflowDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [labAssignments, setLabAssignments] = useState<LabAssignment[]>([]);
  const [statistics, setStatistics] = useState<WorkflowStatistics | null>(null);
  const [submittedBorelogs, setSubmittedBorelogs] = useState<SubmittedBorelog[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user?.role]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      if (user?.role === 'Approval Engineer' || user?.role === 'Admin') {
        const reviewsResponse = await workflowApi.getPendingReviews();
        setPendingReviews(reviewsResponse.data.data || []);
      }

      if (user?.role === 'Lab Engineer' || user?.role === 'Admin') {
        const labResponse = await workflowApi.getLabAssignments();
        setLabAssignments(labResponse.data.data || []);
      }

      if (user?.role === 'Project Manager' || user?.role === 'Admin') {
        const statsResponse = await workflowApi.getWorkflowStatistics();
        setStatistics(statsResponse.data.data || null);
      }

      if (user?.role === 'Site Engineer' || user?.role === 'Admin') {
        const submittedResponse = await workflowApi.getSubmittedBorelogs();
        setSubmittedBorelogs(submittedResponse.data.data || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'default';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'returned_for_revision':
        return 'secondary';
      case 'assigned':
        return 'outline';
      case 'in_progress':
        return 'default';
      case 'completed':
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Workflow Dashboard</h1>
        <Button onClick={loadDashboardData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Pending Reviews - for Approval Engineers and Admins */}
      {(user?.role === 'Approval Engineer' || user?.role === 'Admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Reviews
              <Badge variant="outline">{pendingReviews.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingReviews.length === 0 ? (
              <p className="text-muted-foreground">No pending reviews</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Substructure</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReviews.map((review) => (
                    <TableRow key={`${review.borelog_id}-${review.version_no}`}>
                      <TableCell>{review.project_name}</TableCell>
                      <TableCell>{review.substructure_name || 'N/A'}</TableCell>
                      <TableCell>{review.submitted_by_name || review.submitted_by}</TableCell>
                      <TableCell>
                        {review.submitted_at ? 
                          format(new Date(review.submitted_at), 'MMM dd, yyyy HH:mm') :
                          review.created_at ? 
                            format(new Date(review.created_at), 'MMM dd, yyyy HH:mm') :
                            'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={review.submission_comments}>
                          {review.submission_comments || 'No comments'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Navigate to review page
                            window.location.href = `/borelog/${review.borelog_id}`;
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lab Assignments - for Lab Engineers and Admins */}
      {(user?.role === 'Lab Engineer' || user?.role === 'Admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Lab Assignments
              <Badge variant="outline">{labAssignments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {labAssignments.length === 0 ? (
              <p className="text-muted-foreground">No lab assignments</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Borehole</TableHead>
                    <TableHead>Sample ID</TableHead>
                    <TableHead>Test Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Expected Completion</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>{assignment.project_name}</TableCell>
                      <TableCell>{assignment.borehole_number}</TableCell>
                      <TableCell>{assignment.sample_id}</TableCell>
                      <TableCell>{assignment.test_type}</TableCell>
                      <TableCell>
                        <Badge variant={getPriorityVariant(assignment.priority)}>
                          {assignment.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(assignment.expected_completion_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(assignment.status)}>
                          {assignment.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Navigate to lab test page
                            window.location.href = `/lab-tests/${assignment.id}`;
                          }}
                        >
                          {assignment.status === 'completed' ? 'View Results' : 'Update Progress'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workflow Statistics - for Project Managers and Admins */}
      {(user?.role === 'Project Manager' || user?.role === 'Admin') && statistics && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{statistics.totals.total_borelogs}</div>
                <div className="text-sm text-muted-foreground">Total Borelogs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statistics.totals.draft_count}</div>
                <div className="text-sm text-muted-foreground">Draft</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{statistics.totals.submitted_count}</div>
                <div className="text-sm text-muted-foreground">Submitted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statistics.totals.approved_count}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{statistics.totals.rejected_count}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{statistics.totals.returned_count}</div>
                <div className="text-sm text-muted-foreground">Returned</div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Draft</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Returned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statistics.projects.map((project) => (
                  <TableRow key={project.project_id}>
                    <TableCell>{project.project_name}</TableCell>
                    <TableCell>{project.total_borelogs}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.draft_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{project.submitted_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{project.approved_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{project.rejected_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{project.returned_count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Submitted Borelogs - for Site Engineers and Admins */}
      {(user?.role === 'Site Engineer' || user?.role === 'Admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              My Submitted Borelogs
              <Badge variant="outline">{submittedBorelogs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submittedBorelogs.length === 0 ? (
              <p className="text-muted-foreground">No submitted borelogs</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Substructure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Review Comments</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submittedBorelogs.map((borelog) => (
                    <TableRow key={`${borelog.borelog_id}-${borelog.version_no}`}>
                      <TableCell>{borelog.project_name}</TableCell>
                      <TableCell>{borelog.substructure_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(borelog.status)}>
                          {borelog.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {borelog.submitted_at ? 
                          format(new Date(borelog.submitted_at), 'MMM dd, yyyy HH:mm') :
                          borelog.created_at ? 
                            format(new Date(borelog.created_at), 'MMM dd, yyyy HH:mm') :
                            'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={borelog.review_comments}>
                          {borelog.review_comments || 'No comments'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Navigate to borelog page
                            window.location.href = `/borelog/${borelog.borelog_id}`;
                          }}
                        >
                          {borelog.status === 'returned_for_revision' ? 'Edit' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

