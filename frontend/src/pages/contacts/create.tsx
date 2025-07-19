import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { contactApi } from '@/lib/api';
import { ContactRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProtectedRoute } from '@/lib/authComponents';
import { ArrowLeft, Save } from 'lucide-react';

// Form schema
const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  role: z.enum(['Admin', 'Project Manager', 'Site Engineer', 'Supervisor', 'QA/QC']),
  organisation_id: z.string().uuid({ message: 'Please select a valid organization' }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateContactPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mock organizations for demo (in real app, fetch from API)
  const organizations = [
    { id: '550e8400-e29b-41d4-a716-446655440000', name: 'ACME Corporation' },
    { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Stark Industries' },
    { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Wayne Enterprises' },
  ];

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      role: 'Site Engineer',
      organisation_id: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // Find the selected organization name
      const selectedOrg = organizations.find(org => org.id === data.organisation_id);
      
      // Add organization name to the request
      const requestData = {
        ...data,
        organisation_name: selectedOrg?.name || 'Unknown Organization'
      };
      
      const response = await contactApi.create(requestData);
      
      toast({
        title: 'Success',
        description: 'Contact created successfully',
      });
      
      navigate('/contacts');
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to create contact. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" className="mr-4" asChild>
            <Link to="/contacts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Create New Contact</h1>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter contact name" {...field} />
                      </FormControl>
                      <FormDescription>
                        Full name of the contact person
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Project Manager">Project Manager</SelectItem>
                          <SelectItem value="Site Engineer">Site Engineer</SelectItem>
                          <SelectItem value="Supervisor">Supervisor</SelectItem>
                          <SelectItem value="QA/QC">QA/QC</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Role of the contact in the project
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="organisation_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Organization the contact belongs to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-primary to-primary-glow"
                  >
                    {isSubmitting ? (
                      'Creating...'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Contact
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
} 