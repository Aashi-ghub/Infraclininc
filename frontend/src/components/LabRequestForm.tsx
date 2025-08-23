import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LabRequest } from '@/lib/types';
import { labReportApi } from '@/lib/api';

interface LabTestType {
  id: string;
  name: string;
  category: string;
}

interface Borelog {
  borelog_id: string;
  borehole_number: string;
  project_name: string;
  chainage?: string;
}

interface LabRequestFormProps {
  onSubmit: (data: Omit<LabRequest, 'id' | 'requested_date' | 'status'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function LabRequestForm({ onSubmit, onCancel, isLoading = false }: LabRequestFormProps) {
  const [formData, setFormData] = useState({
    borelog_id: '',
    sample_id: '',
    test_type: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [borelogs, setBorelogs] = useState<Borelog[]>([]);
  const [isLoadingBorelogs, setIsLoadingBorelogs] = useState(false);
  const { toast } = useToast();

  // Test types - these could also come from API in the future
  const testTypes: LabTestType[] = [
    { id: '1', name: 'Compressive Strength Test', category: 'Strength Tests' },
    { id: '2', name: 'Tensile Strength Test', category: 'Strength Tests' },
    { id: '3', name: 'Density Test', category: 'Soil Tests' },
    { id: '4', name: 'Moisture Content Test', category: 'Soil Tests' },
    { id: '5', name: 'Atterberg Limits Test', category: 'Soil Tests' },
    { id: '6', name: 'Permeability Test', category: 'Hydraulic Tests' },
    { id: '7', name: 'Consolidation Test', category: 'Soil Tests' },
    { id: '8', name: 'Shear Strength Test', category: 'Strength Tests' },
    { id: '9', name: 'Unconfined Compressive Strength', category: 'Rock Tests' },
    { id: '10', name: 'Point Load Test', category: 'Rock Tests' },
    { id: '11', name: 'Brazilian Test', category: 'Rock Tests' },
    { id: '12', name: 'Triaxial Test', category: 'Soil Tests' },
    { id: '13', name: 'Direct Shear Test', category: 'Soil Tests' },
    { id: '14', name: 'Grain Size Analysis', category: 'Soil Tests' },
    { id: '15', name: 'Specific Gravity Test', category: 'Soil Tests' }
  ];

  useEffect(() => {
    loadBorelogs();
  }, []);

  const loadBorelogs = async () => {
    setIsLoadingBorelogs(true);
    try {
      const response = await labReportApi.getFinalBorelogs();
      if (response.data?.success) {
        // Transform the final borelogs to match the expected format
        const transformedBorelogs = response.data.data.map((borelog: any) => ({
          borelog_id: borelog.borelog_id,
          borehole_number: borelog.borehole_number,
          project_name: borelog.project_name,
          chainage: borelog.project_location ? `${borelog.project_location}` : undefined
        }));
        setBorelogs(transformedBorelogs);
      } else {
        console.error('Failed to load borelogs:', response.data?.message);
        toast({
          title: 'Error',
          description: 'Failed to load borelogs',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading borelogs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load borelogs',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBorelogs(false);
    }
  };

  const filteredTestTypes = testTypes.filter(type => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredBorelogs = borelogs; // Show all borelogs since there's no search for borelogs

  const categories = Array.from(new Set(testTypes.map(type => type.category)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.borelog_id || !formData.sample_id || !formData.test_type) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const selectedBorelog = borelogs.find(b => b.borelog_id === formData.borelog_id);
    const selectedTestType = testTypes.find(t => t.id === formData.test_type);

    onSubmit({
      borelog_id: formData.borelog_id,
      sample_id: formData.sample_id,
      test_type: selectedTestType?.name || formData.test_type,
      priority: 'Medium', // Default priority
      due_date: undefined, // No due date
      notes: '', // No notes
      borelog: selectedBorelog ? {
        borehole_number: selectedBorelog.borehole_number,
        project_name: selectedBorelog.project_name,
        chainage: selectedBorelog.chainage || 'N/A'
      } : undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lab Test Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Borelog Selection */}
          <div className="space-y-2">
            <Label htmlFor="borelog">Borelog *</Label>
            <Select value={formData.borelog_id} onValueChange={(value) => setFormData(prev => ({ ...prev, borelog_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a borelog" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingBorelogs ? (
                  <SelectItem value="loading" disabled>Loading borelogs...</SelectItem>
                ) : filteredBorelogs.length === 0 ? (
                  <SelectItem value="no-borelogs" disabled>No borelogs found</SelectItem>
                ) : (
                  filteredBorelogs.map((borelog) => (
                    <SelectItem key={borelog.borelog_id} value={borelog.borelog_id}>
                      {borelog.borehole_number} - {borelog.project_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Sample ID */}
          <div className="space-y-2">
            <Label htmlFor="sample_id">Sample ID *</Label>
            <Input
              id="sample_id"
              value={formData.sample_id}
              onChange={(e) => setFormData(prev => ({ ...prev, sample_id: e.target.value }))}
              placeholder="Enter sample ID"
              required
            />
          </div>

          {/* Test Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="test_type">Test Type *</Label>
            <div className="space-y-2">
              <Input
                placeholder="Search test types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={formData.test_type} onValueChange={(value) => setFormData(prev => ({ ...prev, test_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select test type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTestTypes.length > 0 ? (
                    filteredTestTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-results" disabled>
                      No test types found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Request'}
        </Button>
      </div>
    </form>
  );
}
