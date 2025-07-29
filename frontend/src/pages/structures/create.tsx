import { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { structureApi, projectApi } from '@/lib/api';
import { structureSchema, StructureFormData } from '@/lib/zodSchemas';
import { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { useEffect } from 'react';

export default function CreateStructurePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<StructureFormData>({
    resolver: zodResolver(structureSchema),
    defaultValues: {
      project_id: projectId || '',
      type: undefined,
      description: '',
    }
  });

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;
      
      try {
        setIsLoadingProject(true);
        const response = await projectApi.getById(projectId);
        
        if (response.data && response.data.data) {
          setProject(response.data.data);
        } else if (response.data) {
          setProject(response.data);
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        toast({
          title: 'Error',
          description: 'Failed to load project details.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadProject();
  }, [projectId, toast]);

  const onSubmit = async (data: StructureFormData) => {
    try {
      setIsSubmitting(true);
      
      const response = await structureApi.create(data);
      
      toast({
        title: 'Success',
        description: 'Structure created successfully!',
      });

      // Navigate to the structures list
      navigate(`/projects/${projectId}/structures`);
    } catch (error: any) {
      console.error('Failed to create structure:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create structure. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const structureTypes = [
    'Tunnel',
    'Bridge',
    'LevelCrossing',
    'Viaduct',
    'Embankment',
    'Alignment',
    'Yeard',
    'StationBuilding',
    'Building',
    'SlopeStability'
  ];

  if (isLoadingProject) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project not found</h3>
              <p className="text-muted-foreground mb-4">
                The project you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button asChild>
                <Link to="/projects">
                  Back to Projects
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/projects/${projectId}/structures`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Structures
            </Link>
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Add Structure
          </h1>
          <p className="text-muted-foreground">
            {project.name} • Add a new structure to this project
          </p>
        </div>

        <Card className="shadow-form">
          <CardHeader>
            <CardTitle>Structure Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Structure Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select structure type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {structureTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project ID</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Optional description of the structure..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-elegant transition-all duration-300"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Structure
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/projects/${projectId}/structures`)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <Card className="mt-6 shadow-form">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Structure Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <strong>Tunnel</strong> - Underground passage for transportation
                <br />
                <strong>Bridge</strong> - Structure spanning physical obstacles
                <br />
                <strong>Viaduct</strong> - Elevated bridge carrying road or railway
                <br />
                <strong>Embankment</strong> - Raised structure for road or railway
              </div>
              <div>
                <strong>Building</strong> - Permanent structure for occupancy
                <br />
                <strong>StationBuilding</strong> - Transportation station facility
                <br />
                <strong>Alignment</strong> - Linear infrastructure route
                <br />
                <strong>SlopeStability</strong> - Slope reinforcement structure
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 