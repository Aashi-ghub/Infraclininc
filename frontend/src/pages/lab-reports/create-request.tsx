import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import LabRequestForm from '@/components/LabRequestForm';
import { LabRequest } from '@/lib/types';
import { labReportApi } from '@/lib/api';

export default function CreateLabRequest() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (data: Omit<LabRequest, 'id' | 'requested_date' | 'status'>) => {
    setIsSubmitting(true);
    try {
      const response = await labReportApi.createRequest(data);
      
      if (response.data?.success) {
        toast({
          title: 'Success',
          description: 'Lab request created successfully',
        });
        navigate('/lab-reports');
      } else {
        throw new Error(response.data?.message || 'Failed to create lab request');
      }
    } catch (error: any) {
      console.error('Error creating lab request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to create lab request',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/lab-reports');
  };

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Lab Request</h1>
            <p className="text-gray-600 mt-2">Create a new laboratory test request</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <LabRequestForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}
