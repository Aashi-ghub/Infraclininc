import { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { substructureApi, structureApi, projectApi } from '@/lib/api';
import { substructureSchema, SubstructureFormData } from '@/lib/zodSchemas';
import { Structure, Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { useEffect } from 'react';

export default function CreateSubstructurePage() {
  const { projectId, structureId } = useParams<{ projectId: string; structureId: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoadingStructure, setIsLoadingStructure] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<SubstructureFormData>({
    resolver: zodResolver(substructureSchema),
    defaultValues: {
      structure_id: structureId || '',
      project_id: projectId || '',
      type: undefined,
      remark: '',
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

  useEffect(() => {
    const loadStructure = async () => {
      if (!structureId) return;
      
      try {
        setIsLoadingStructure(true);
        const response = await structureApi.getById(structureId);
        
        if (response.data && response.data.data) {
          setStructure(response.data.data);
        } else if (response.data) {
          setStructure(response.data);
        }
      } catch (error) {
        console.error('Failed to load structure:', error);
        toast({
          title: 'Error',
          description: 'Failed to load structure details.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingStructure(false);
      }
    };

    loadStructure();
  }, [structureId, toast]);

  const onSubmit = async (data: SubstructureFormData) => {
    try {
      setIsSubmitting(true);
      
      const response = await substructureApi.create(data);
      
      toast({
        title: 'Success',
        description: 'Substructure created successfully!',
      });

      // Navigate to the substructures list
      navigate(`/projects/${projectId}/structures/${structureId}/substructures`);
    } catch (error: any) {
      console.error('Failed to create substructure:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create substructure. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const substructureTypes = [
    'P1',
    'P2',
    'M',
    'E',
    'Abutment1',
    'Abutment2',
    'LC',
    'Right side',
    'Left side'
  ];

  if (isLoadingProject || isLoadingStructure) {
    return <div>Loading...</div>;
  }

  if (!project || !structure) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-form">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project or Structure not found</h3>
              <p className="text-muted-foreground mb-4">
                The project or structure you're looking for doesn't exist or you don't have access to it.
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
            <Link to={`/projects/${projectId}/structures/${structureId}/substructures`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Substructures
            </Link>
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Add Substructure
          </h1>
          <p className="text-muted-foreground">
            {project.name} • {structure.type} • Add a new substructure component
          </p>
        </div>

        <Card className="shadow-form">
          <CardHeader>
            <CardTitle>Substructure Information</CardTitle>
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
                        <FormLabel>Substructure Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select substructure type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {substructureTypes.map((type) => (
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
                    name="structure_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Structure ID</FormLabel>
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

                <FormField
                  control={form.control}
                  name="remark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remark</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Optional remark or description..."
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
                        Create Substructure
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/projects/${projectId}/structures/${structureId}/substructures`)}
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
            <h3 className="font-semibold mb-2">Substructure Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <strong>P1, P2</strong> - Pier foundations
                <br />
                <strong>M</strong> - Main structure component
                <br />
                <strong>E</strong> - Extension or expansion
                <br />
                <strong>Abutment1, Abutment2</strong> - Bridge abutments
              </div>
              <div>
                <strong>LC</strong> - Level crossing
                <br />
                <strong>Right side</strong> - Right side component
                <br />
                <strong>Left side</strong> - Left side component
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 