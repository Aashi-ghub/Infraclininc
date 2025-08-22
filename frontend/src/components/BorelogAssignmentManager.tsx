import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { borelogAssignmentApi, userApi } from '@/lib/api';
import { BorelogAssignment, CreateBorelogAssignmentInput, User } from '@/lib/types';
import { format } from 'date-fns';

interface BorelogAssignmentManagerProps {
  borelogId?: string;
  structureId?: string;
  substructureId?: string;
  projectId?: string;
  onAssignmentComplete?: () => void;
}

export function BorelogAssignmentManager({
  borelogId,
  structureId,
  substructureId,
  projectId,
  onAssignmentComplete
}: BorelogAssignmentManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [siteEngineers, setSiteEngineers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<BorelogAssignment[]>([]);
  const [selectedSiteEngineer, setSelectedSiteEngineer] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<string>('');
  const { toast } = useToast();

  // Load site engineers and existing assignments
  useEffect(() => {
    if (isOpen) {
      loadSiteEngineers();
      loadAssignments();
    }
  }, [isOpen, borelogId, structureId, substructureId]);

  const loadSiteEngineers = async () => {
    try {
      const response = await userApi.list();
      const siteEngineers = response.data.data.filter((user: User) => user.role === 'Site Engineer');
      setSiteEngineers(siteEngineers);
    } catch (error) {
      console.error('Failed to load site engineers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load site engineers.',
        variant: 'destructive',
      });
    }
  };

  const loadAssignments = async () => {
    try {
      let response;
      if (borelogId) {
        response = await borelogAssignmentApi.getByBorelogId(borelogId);
      } else if (structureId) {
        response = await borelogAssignmentApi.getByStructureId(structureId);
      } else if (substructureId) {
        // For substructure, we'll need to get assignments by structure ID
        // since the API doesn't have a direct substructure endpoint
        response = await borelogAssignmentApi.getByStructureId(structureId || '');
      } else {
        setAssignments([]);
        return;
      }
      setAssignments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assignments.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedSiteEngineer) {
      toast({
        title: 'Error',
        description: 'Please select a site engineer.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const assignmentData: CreateBorelogAssignmentInput = {
        assigned_site_engineer: selectedSiteEngineer,
        notes: notes || undefined,
        expected_completion_date: expectedCompletionDate || undefined,
      };

      if (borelogId) {
        assignmentData.borelog_id = borelogId;
      } else if (structureId) {
        assignmentData.structure_id = structureId;
      } else if (substructureId) {
        assignmentData.substructure_id = substructureId;
      }

      await borelogAssignmentApi.create(assignmentData);

      toast({
        title: 'Success',
        description: 'Site engineer assigned successfully.',
      });

      setIsOpen(false);
      setSelectedSiteEngineer('');
      setNotes('');
      setExpectedCompletionDate('');
      
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (error: any) {
      console.error('Failed to create assignment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to assign site engineer.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId: string, status: 'active' | 'inactive' | 'completed') => {
    try {
      await borelogAssignmentApi.update(assignmentId, { status });
      toast({
        title: 'Success',
        description: 'Assignment status updated successfully.',
      });
      loadAssignments();
    } catch (error: any) {
      console.error('Failed to update assignment status:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update assignment status.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    try {
      await borelogAssignmentApi.delete(assignmentId);
      toast({
        title: 'Success',
        description: 'Assignment deleted successfully.',
      });
      loadAssignments();
    } catch (error: any) {
      console.error('Failed to delete assignment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete assignment.',
        variant: 'destructive',
      });
    }
  };

  const getAssignmentTarget = () => {
    if (borelogId) return 'Borelog';
    if (structureId) return 'Structure';
    if (substructureId) return 'Substructure';
    return 'Target';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'completed':
        return 'success';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Site Engineer Assignments</h3>
          <p className="text-sm text-muted-foreground">
            Manage site engineer assignments for this {getAssignmentTarget().toLowerCase()}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Assign Site Engineer</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assign Site Engineer</DialogTitle>
              <DialogDescription>
                Assign a site engineer to this {getAssignmentTarget().toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="site-engineer">Site Engineer</Label>
                <Select value={selectedSiteEngineer} onValueChange={setSelectedSiteEngineer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a site engineer" />
                  </SelectTrigger>
                  <SelectContent>
                    {siteEngineers.map((engineer) => (
                      <SelectItem key={engineer.user_id} value={engineer.user_id}>
                        {engineer.name} ({engineer.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this assignment..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="completion-date">Expected Completion Date (Optional)</Label>
                <Input
                  id="completion-date"
                  type="date"
                  value={expectedCompletionDate}
                  onChange={(e) => setExpectedCompletionDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment} disabled={isLoading}>
                {isLoading ? 'Assigning...' : 'Assign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>Current Assignments</CardTitle>
          <CardDescription>
            View and manage existing site engineer assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No assignments found for this {getAssignmentTarget().toLowerCase()}
            </p>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.assignment_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">
                        {assignment.assigned_site_engineer_name || 'Unknown Engineer'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {assignment.assigned_site_engineer_email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(assignment.status)}>
                        {assignment.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAssignment(assignment.assignment_id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Assigned:</span>
                      <p className="text-muted-foreground">
                        {format(new Date(assignment.assigned_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {assignment.expected_completion_date && (
                      <div>
                        <span className="font-medium">Expected Completion:</span>
                        <p className="text-muted-foreground">
                          {format(new Date(assignment.expected_completion_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {assignment.notes && (
                    <div className="mt-2">
                      <span className="font-medium text-sm">Notes:</span>
                      <p className="text-sm text-muted-foreground mt-1">{assignment.notes}</p>
                    </div>
                  )}
                  
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'active')}
                      disabled={assignment.status === 'active'}
                    >
                      Activate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'inactive')}
                      disabled={assignment.status === 'inactive'}
                    >
                      Deactivate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateAssignmentStatus(assignment.assignment_id, 'completed')}
                      disabled={assignment.status === 'completed'}
                    >
                      Mark Complete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
