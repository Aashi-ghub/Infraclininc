import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useAuth } from '../lib/auth';
import { workflowApi, userApi } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { format } from 'date-fns';

interface LabTestAssignmentProps {
  borelogId: string;
  projectName: string;
  boreholeNumber: string;
  onAssignmentComplete?: () => void;
}

interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export function LabTestAssignment({ 
  borelogId, 
  projectName, 
  boreholeNumber, 
  onAssignmentComplete 
}: LabTestAssignmentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [labEngineers, setLabEngineers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    sample_ids: [''],
    test_types: [''],
    assigned_lab_engineer: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    expected_completion_date: '',
    remarks: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadLabEngineers();
    }
  }, [isOpen]);

  const loadLabEngineers = async () => {
    try {
      const response = await userApi.getLabEngineers();
      setLabEngineers(response.data.data || []);
    } catch (error) {
      console.error('Failed to load lab engineers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lab engineers',
        variant: 'destructive',
      });
    }
  };

  const handleAddSample = () => {
    setFormData(prev => ({
      ...prev,
      sample_ids: [...prev.sample_ids, ''],
      test_types: [...prev.test_types, '']
    }));
  };

  const handleRemoveSample = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sample_ids: prev.sample_ids.filter((_, i) => i !== index),
      test_types: prev.test_types.filter((_, i) => i !== index)
    }));
  };

  const handleSampleChange = (index: number, field: 'sample_ids' | 'test_types', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.assigned_lab_engineer) {
      toast({
        title: 'Error',
        description: 'Please select a lab engineer',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.expected_completion_date) {
      toast({
        title: 'Error',
        description: 'Please select an expected completion date',
        variant: 'destructive',
      });
      return;
    }

    if (formData.sample_ids.some(id => !id.trim()) || formData.test_types.some(type => !type.trim())) {
      toast({
        title: 'Error',
        description: 'Please fill in all sample IDs and test types',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await workflowApi.assignLabTests({
        borelog_id: borelogId,
        sample_ids: formData.sample_ids,
        test_types: formData.test_types,
        assigned_lab_engineer: formData.assigned_lab_engineer,
        priority: formData.priority,
        expected_completion_date: formData.expected_completion_date
      });

      toast({
        title: 'Success',
        description: 'Lab tests assigned successfully',
      });

      setIsOpen(false);
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }
    } catch (error) {
      console.error('Failed to assign lab tests:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign lab tests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sample_ids: [''],
      test_types: [''],
      assigned_lab_engineer: '',
      priority: 'medium',
      expected_completion_date: '',
      remarks: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          Assign Lab Tests
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Lab Tests</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Project Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Project</Label>
              <Input value={projectName} disabled />
            </div>
            <div>
              <Label>Borehole</Label>
              <Input value={boreholeNumber} disabled />
            </div>
          </div>

          {/* Lab Engineer Assignment */}
          <div>
            <Label htmlFor="lab-engineer">Lab Engineer *</Label>
            <Select
              value={formData.assigned_lab_engineer}
              onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_lab_engineer: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a lab engineer" />
              </SelectTrigger>
              <SelectContent>
                {labEngineers.map((engineer) => (
                  <SelectItem key={engineer.user_id} value={engineer.user_id}>
                    {engineer.name} ({engineer.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority and Completion Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="completion-date">Expected Completion Date *</Label>
              <Input
                id="completion-date"
                type="date"
                value={formData.expected_completion_date}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  expected_completion_date: e.target.value 
                }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Sample and Test Type Assignments */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Samples and Test Types</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddSample}>
                Add Sample
              </Button>
            </div>
            
            <div className="space-y-4">
              {formData.sample_ids.map((sampleId, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Sample ID</Label>
                    <Input
                      value={sampleId}
                      onChange={(e) => handleSampleChange(index, 'sample_ids', e.target.value)}
                      placeholder="e.g., SAMPLE-001"
                    />
                  </div>
                  <div className="flex-1">
                    <Label>Test Type</Label>
                    <Input
                      value={formData.test_types[index]}
                      onChange={(e) => handleSampleChange(index, 'test_types', e.target.value)}
                      placeholder="e.g., Compression Test"
                    />
                  </div>
                  {formData.sample_ids.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveSample(index)}
                      className="mt-6"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Any additional notes or special instructions..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Assigning...' : 'Assign Lab Tests'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

