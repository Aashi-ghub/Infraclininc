import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FlaskConical, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LabRequest, LabTestType } from '@/lib/types';

interface LabRequestFormProps {
  onSubmit: (request: Omit<LabRequest, 'id' | 'requested_date' | 'status'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const testTypes: LabTestType[] = [
  { id: '1', name: 'Compressive Strength Test', category: 'Strength Tests', description: 'Determines the compressive strength of concrete or rock samples' },
  { id: '2', name: 'Tensile Strength Test', category: 'Strength Tests', description: 'Measures the tensile strength of materials' },
  { id: '3', name: 'Density Test', category: 'Soil Tests', description: 'Determines the bulk and dry density of soil samples' },
  { id: '4', name: 'Moisture Content Test', category: 'Soil Tests', description: 'Measures the water content in soil samples' },
  { id: '5', name: 'Atterberg Limits Test', category: 'Soil Tests', description: 'Determines liquid limit, plastic limit, and plasticity index' },
  { id: '6', name: 'Permeability Test', category: 'Hydraulic Tests', description: 'Measures the rate of water flow through soil' },
  { id: '7', name: 'Consolidation Test', category: 'Soil Tests', description: 'Determines the compressibility characteristics of soil' },
  { id: '8', name: 'Shear Strength Test', category: 'Strength Tests', description: 'Measures the shear strength parameters of soil' },
  { id: '9', name: 'California Bearing Ratio (CBR) Test', category: 'Strength Tests', description: 'Measures the strength of subgrade soil' },
  { id: '10', name: 'Proctor Compaction Test', category: 'Soil Tests', description: 'Determines the optimum moisture content and maximum dry density' }
];

// Mock borelog data - in real app, this would come from API
const mockBorelogs = [
  { id: 'bl-001', borehole_number: 'BH-001', project_name: 'Highway Bridge Project', chainage: '2.5 km' },
  { id: 'bl-002', borehole_number: 'BH-002', project_name: 'Highway Bridge Project', chainage: '3.2 km' },
  { id: 'bl-003', borehole_number: 'BH-003', project_name: 'Highway Bridge Project', chainage: '4.1 km' },
  { id: 'bl-004', borehole_number: 'BH-004', project_name: 'Residential Complex', chainage: '0.8 km' },
  { id: 'bl-005', borehole_number: 'BH-005', project_name: 'Residential Complex', chainage: '1.2 km' }
];

export default function LabRequestForm({ onSubmit, onCancel, isLoading = false }: LabRequestFormProps) {
  const [formData, setFormData] = useState({
    borelog_id: '',
    sample_id: '',
    test_type: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    due_date: null as Date | null,
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  const filteredTestTypes = testTypes.filter(type => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(testTypes.map(type => type.category)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.borelog_id || !formData.sample_id || !formData.test_type) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    const selectedBorelog = mockBorelogs.find(b => b.id === formData.borelog_id);
    if (!selectedBorelog) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Invalid borelog selected',
      });
      return;
    }

    const requestData = {
      borelog_id: formData.borelog_id,
      sample_id: formData.sample_id,
      test_type: formData.test_type,
      priority: formData.priority,
      due_date: formData.due_date?.toISOString(),
      notes: formData.notes,
      borelog: selectedBorelog
    };

    onSubmit(requestData);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-6 w-6" />
          Create Lab Test Request
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Borelog Selection */}
          <div className="space-y-2">
            <Label htmlFor="borelog">Borelog *</Label>
            <Select value={formData.borelog_id} onValueChange={(value) => setFormData(prev => ({ ...prev, borelog_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a borelog" />
              </SelectTrigger>
              <SelectContent>
                {mockBorelogs.map((borelog) => (
                  <SelectItem key={borelog.id} value={borelog.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{borelog.borehole_number}</span>
                      <span className="text-sm text-muted-foreground">
                        {borelog.project_name} - {borelog.chainage}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sample ID */}
          <div className="space-y-2">
            <Label htmlFor="sample_id">Sample ID *</Label>
            <Input
              id="sample_id"
              placeholder="Enter sample ID (e.g., SAMPLE-001)"
              value={formData.sample_id}
              onChange={(e) => setFormData(prev => ({ ...prev, sample_id: e.target.value }))}
            />
          </div>

          {/* Test Type Selection */}
          <div className="space-y-2">
            <Label>Test Type *</Label>
            <div className="space-y-3">
              {/* Category Filter */}
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

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search test types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Test Type Selection */}
              <Select value={formData.test_type} onValueChange={(value) => setFormData(prev => ({ ...prev, test_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select test type" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredTestTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      <div className="flex flex-col">
                        <span className="font-medium">{type.name}</span>
                        <span className="text-sm text-muted-foreground">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={formData.priority} onValueChange={(value: 'Low' | 'Medium' | 'High' | 'Urgent') => setFormData(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or special requirements..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              {isLoading ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
