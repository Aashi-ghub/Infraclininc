import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  projectsApi, 
  structuresApi, 
  boreholesApi,
  borelogSubmissionApi,
  borelogApiV2
} from '@/lib/api';

// Import components
import { ProjectInfoSection } from './components/ProjectInfoSection';
import { StratumTable } from './components/StratumTable';
import { VersionHistory } from './components/VersionHistory';
import { ColorLegend } from './components/ColorLegend';
import { FormActions } from './components/FormActions';

// Import types and styles
import { 
  BorelogEntryFormProps, 
  BorelogFormData, 
  User, 
  Structure, 
  Project, 
  Borehole,
  borelogFormSchema 
} from './components/types';
import { excelTableStyles } from './components/styles';

export function BorelogEntryForm({
  projectId,
  structureId,
  boreholeId,
  borelogId
}: BorelogEntryFormProps) {
  const { user } = useAuth();
  const typedUser = user as User;
  const { toast } = useToast();
  
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [boreholes, setBoreholes] = useState<Borehole[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Check if user has editing permissions (Admin, Project Manager, or Site Engineer)
  const canEdit = typedUser?.role === 'Admin' || typedUser?.role === 'Project Manager' || typedUser?.role === 'Site Engineer';
  const canApprove = typedUser?.role === 'Admin' || typedUser?.role === 'Approval Engineer';

  // Form setup
  const form = useForm<BorelogFormData, any, BorelogFormData>({
    resolver: zodResolver(borelogFormSchema),
    defaultValues: {
      project_id: projectId || '',
      structure_id: structureId || '',
      substructure_id: '', // Added for new API
      borehole_id: boreholeId || '',
      job_code: '',
      section_name: '',
      coordinate_e: '',
      coordinate_l: '',
      chainage_km: null,
      location: '',
      msl: null,
      method_of_boring: '',
      diameter_of_hole: '',
      commencement_date: '',
      completion_date: '',
      standing_water_level: null,
      termination_depth: null,
      permeability_tests_count: 0,
      spt_tests_count: 0,
      vs_tests_count: 0,
      undisturbed_samples_count: 0,
      disturbed_samples_count: 0,
      water_samples_count: 0,
      stratum_rows: [],
      version_number: 1,
      status: 'draft',
      edited_by: '',
      editor_name: '',
      submission_timestamp: '',
      previous_version_id: '',
      last_saved: '',
      is_auto_save: false
    } as BorelogFormData
  });

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Watch project changes
  const watchedProjectId = form.watch('project_id');
  useEffect(() => {
    if (watchedProjectId) {
      loadStructures(watchedProjectId);
      form.setValue('structure_id', '');
      form.setValue('borehole_id', '');
    }
  }, [watchedProjectId]);

  // Watch structure changes
  const watchedStructureId = form.watch('structure_id');
  useEffect(() => {
    if (watchedStructureId && watchedProjectId) {
      loadBoreholes(watchedProjectId, watchedStructureId);
      form.setValue('borehole_id', '');
    }
  }, [watchedStructureId, watchedProjectId]);

  // Watch borehole changes to auto-fill data and sync substructure_id
  const watchedBoreholeId = form.watch('borehole_id');
  useEffect(() => {
    if (watchedBoreholeId) {
      autoFillBoreholeData(watchedBoreholeId);
      // Sync substructure_id with borehole_id since they represent the same thing
      form.setValue('substructure_id', watchedBoreholeId);
    }
  }, [watchedBoreholeId]);

  // Watch stratum rows to auto-calculate termination depth
  const watchedStratumRows = form.watch('stratum_rows');
  useEffect(() => {
    if (watchedStratumRows && watchedStratumRows.length > 0) {
      // Calculate termination depth from maximum depth_to value
      const maxDepth = Math.max(...watchedStratumRows
        .map(row => row.depth_to || 0)
        .filter(depth => depth > 0)
      );
      form.setValue('termination_depth', maxDepth > 0 ? maxDepth : null);
    } else {
      form.setValue('termination_depth', null);
    }
  }, [watchedStratumRows, form]);

  // Auto-save functionality - disabled for now since new API creates actual versions
  const autoSave = useCallback(async () => {
    // Auto-save is disabled in the new API system since it creates actual borelog versions
    // Users should manually submit when ready
    return;
  }, []);

  // Auto-save interval disabled since new API creates actual versions
  // useEffect(() => {
  //   if (!canEdit) return;
  //   
  //   const interval = setInterval(autoSave, 30000); // Auto-save every 30 seconds
  //   return () => clearInterval(interval);
  // }, [autoSave, canEdit]);

  // Load initial data
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadProjects(),
        loadVersionHistory()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load projects and form data
  const loadProjects = async () => {
    try {
      // Use the new API to get projects with role-based access
      const response = await borelogApiV2.getFormData();
      const formData = response.data.data;
      setProjects(formData.projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Load structures for a project
  const loadStructures = async (projectId: string) => {
    try {
      // Use the new API to get structures for the project
      const response = await borelogApiV2.getFormData({ project_id: projectId });
      const formData = response.data.data;
      const projectStructures = formData.structures_by_project[projectId] || [];
      setStructures(projectStructures);
    } catch (error) {
      console.error('Error loading structures:', error);
    }
  };

  // Load boreholes for a structure
  const loadBoreholes = async (projectId: string, structureId: string) => {
    try {
      // Use the new API to get substructures for the structure
      const response = await borelogApiV2.getFormData({ structure_id: structureId });
      const formData = response.data.data;
      const structureSubstructures = formData.substructures_by_structure[structureId] || [];
      // Map substructures to boreholes for compatibility
      const boreholeData = structureSubstructures.map((substructure: any) => ({
        borehole_id: substructure.substructure_id,
        borehole_number: substructure.type,
        location: substructure.remark || '',
        chainage: '',
        msl: '',
        boring_method: '',
        hole_diameter: null,
        status: 'active'
      }));
      setBoreholes(boreholeData);
    } catch (error) {
      console.error('Error loading boreholes:', error);
    }
  };

  // Auto-fill borehole data
  const autoFillBoreholeData = async (boreholeId: string) => {
    try {
      // Since boreholeId is actually substructure_id in the new system,
      // we need to find the substructure data from the already loaded boreholes
      const borehole = boreholes.find(b => b.borehole_id === boreholeId);
      
      if (borehole) {
        // Auto-fill form fields with borehole data
        form.setValue('location', borehole.location || '');
        form.setValue('method_of_boring', borehole.boring_method || '');
        form.setValue('diameter_of_hole', borehole.hole_diameter?.toString() || '');
        form.setValue('msl', borehole.msl ? parseFloat(borehole.msl) : null);
        form.setValue('chainage_km', borehole.chainage ? parseFloat(borehole.chainage) : null);
      }
    } catch (error) {
      console.error('Error auto-filling borehole data:', error);
      // Don't show error toast for auto-fill failures as they're not critical
    }
  };

  // Load version history
  const loadVersionHistory = async () => {
    if (!boreholeId) return;
    
    try {
      // Use the new API to get version history
      const response = await borelogApiV2.getDetailsByBorelogId(boreholeId);
      const versionData = response.data.data;
      setVersions(versionData.version_history || []);
    } catch (error) {
      console.error('Error loading version history:', error);
    }
  };

  // Load specific version
  const loadVersion = async (versionId: string) => {
    try {
      const response = await borelogSubmissionApi.getVersion(versionId);
      const versionData = response.data;
      
      // Populate form with version data
      Object.keys(versionData).forEach(key => {
        if (key in form.getValues()) {
          form.setValue(key as any, versionData[key]);
        }
      });
      
      toast({
        title: 'Version Loaded',
        description: `Loaded Version ${versionData.version_number} from ${new Date(versionData.created_at).toLocaleDateString()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load version.',
        variant: 'destructive',
      });
    }
  };

  // Handle version approval
  const handleApproveVersion = async (versionId: string) => {
    try {
      await borelogSubmissionApi.approveVersion(versionId, {
        approved_by: typedUser?.user_id || '',
        approval_comments: 'Approved via form interface'
      });
      
      toast({
        title: 'Version Approved',
        description: 'The version has been approved and marked as the final report.',
      });
      
      // Reload version history
      loadVersionHistory();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve version.',
        variant: 'destructive',
      });
    }
  };

  // Handle version rejection
  const handleRejectVersion = async (versionId: string) => {
    try {
      const comments = prompt('Enter rejection comments (optional):');
      
      await borelogSubmissionApi.rejectVersion(versionId, {
        rejected_by: typedUser?.user_id || '',
        rejection_comments: comments || 'Rejected via form interface'
      });
      
      toast({
        title: 'Version Rejected',
        description: 'The version has been rejected.',
      });
      
      // Reload version history
      loadVersionHistory();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject version.',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission - Create new version instead of overwriting
  const onSubmit = async (data: BorelogFormData) => {
    if (!canEdit) return;
    
    try {
      setIsSubmitting(true);
      
      // Find the selected substructure from boreholes (which are actually substructures)
      const selectedBorehole = boreholes.find(b => b.borehole_id === data.borehole_id);
      if (!selectedBorehole) {
        throw new Error('No substructure selected');
      }
      
      // Prepare submission data for the new API
      const submissionData = {
        substructure_id: data.borehole_id, // This is actually the substructure_id
        project_id: data.project_id,
        type: 'Geotechnical' as const, // Default type, can be made configurable
        number: data.borehole_id,
        msl: data.msl?.toString() || '',
        boring_method: data.method_of_boring,
        hole_diameter: data.diameter_of_hole ? parseFloat(data.diameter_of_hole) : undefined,
        commencement_date: data.commencement_date,
        completion_date: data.completion_date,
        standing_water_level: data.standing_water_level,
        termination_depth: (() => {
          const stratumRows = data.stratum_rows || [];
          if (stratumRows.length === 0) return 0;
          // Find the maximum depth_to value from all stratum rows
          const maxDepth = Math.max(...stratumRows
            .map(row => row.depth_to || 0)
            .filter(depth => depth > 0)
          );
          return maxDepth > 0 ? maxDepth : 0;
        })(),
        coordinate: undefined, // Can be added if coordinates are available
        permeability_test_count: data.permeability_tests_count?.toString() || '',
        spt_vs_test_count: data.spt_tests_count?.toString() || '',
        undisturbed_sample_count: data.undisturbed_samples_count?.toString() || '',
        disturbed_sample_count: data.disturbed_samples_count?.toString() || '',
        water_sample_count: data.water_samples_count?.toString() || '',
        stratum_description: data.stratum_rows.map(row => row.description).join('; '),
        stratum_depth_from: data.stratum_rows[0]?.depth_from,
        stratum_depth_to: data.stratum_rows[data.stratum_rows.length - 1]?.depth_to,
        stratum_thickness_m: data.stratum_rows.reduce((sum, row) => {
          const from = row.depth_from || 0;
          const to = row.depth_to || 0;
          return sum + (to - from);
        }, 0),
        sample_event_type: '',
        sample_event_depth_m: undefined,
        run_length_m: undefined,
        spt_blows_per_15cm: undefined,
        n_value_is_2131: '',
        total_core_length_cm: undefined,
        tcr_percent: undefined,
        rqd_length_cm: undefined,
        rqd_percent: undefined,
        return_water_colour: '',
        water_loss: '',
        borehole_diameter: data.diameter_of_hole ? parseFloat(data.diameter_of_hole) : undefined,
        remarks: data.stratum_rows.map(row => `${row.description}: ${row.sample_type}`).join('; '),
        images: ''
      };
      
      // Submit the form using the new borelog API
      const response = await borelogApiV2.create(submissionData);
      
      toast({
        title: 'Success',
        description: `Borelog created successfully! Version ${response.data.data.version_no}`,
      });
      
      // Reload version history
      loadVersionHistory();
      
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to submit borelog.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle save draft - now creates a new version
  const handleSaveDraft = async () => {
    if (!canEdit) return;
    
    try {
      setIsSaving(true);
      const formData = form.getValues();
      
      // Calculate termination depth from stratum data
      const terminationDepth = (() => {
        const stratumRows = formData.stratum_rows || [];
        if (stratumRows.length === 0) return 0;
        const maxDepth = Math.max(...stratumRows
          .map(row => row.depth_to || 0)
          .filter(depth => depth > 0)
        );
        return maxDepth > 0 ? maxDepth : 0;
      })();
      
      // Validate required fields before sending
      if (!formData.substructure_id || !formData.project_id) {
        toast({
          title: 'Validation Error',
          description: 'Please select a project and borehole before saving.',
          variant: 'destructive',
        });
        return;
      }

      // Debug: Log the form data to see what we're working with
      console.log('Form data for validation:', {
        substructure_id: formData.substructure_id,
        project_id: formData.project_id,
        borehole_id: formData.borehole_id
      });

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(formData.substructure_id)) {
        toast({
          title: 'Validation Error',
          description: 'Invalid substructure ID format. Please select a valid borehole.',
          variant: 'destructive',
        });
        return;
      }
      
      if (!uuidRegex.test(formData.project_id)) {
        toast({
          title: 'Validation Error',
          description: 'Invalid project ID format. Please select a valid project.',
          variant: 'destructive',
        });
        return;
      }

      // Map form data to borelog creation structure
      const borelogData = {
        substructure_id: formData.substructure_id,
        project_id: formData.project_id,
        type: 'Geotechnical' as const,
        // Additional fields for borelog_details
        number: formData.job_code || '',
        msl: formData.msl?.toString() || '',
        boring_method: formData.method_of_boring || '',
        hole_diameter: formData.diameter_of_hole && !isNaN(parseFloat(formData.diameter_of_hole)) ? parseFloat(formData.diameter_of_hole) : undefined,
        commencement_date: formData.commencement_date || '',
        completion_date: formData.completion_date || '',
        standing_water_level: formData.standing_water_level && !isNaN(Number(formData.standing_water_level)) ? Number(formData.standing_water_level) : undefined,
        termination_depth: terminationDepth,
        coordinate: formData.coordinate_e && formData.coordinate_l && !isNaN(parseFloat(formData.coordinate_l)) && !isNaN(parseFloat(formData.coordinate_e)) ? {
          type: 'Point' as const,
          coordinates: [parseFloat(formData.coordinate_e), parseFloat(formData.coordinate_l)] as [number, number] // [longitude, latitude]
        } : undefined,
        stratum_description: formData.stratum_rows?.[0]?.description || '',
        stratum_depth_from: formData.stratum_rows?.[0]?.depth_from && !isNaN(Number(formData.stratum_rows[0].depth_from)) ? Number(formData.stratum_rows[0].depth_from) : undefined,
        stratum_depth_to: formData.stratum_rows?.[0]?.depth_to && !isNaN(Number(formData.stratum_rows[0].depth_to)) ? Number(formData.stratum_rows[0].depth_to) : undefined,
        stratum_thickness_m: formData.stratum_rows?.[0]?.thickness && !isNaN(Number(formData.stratum_rows[0].thickness)) ? Number(formData.stratum_rows[0].thickness) : undefined,
        remarks: formData.stratum_rows?.[0]?.remarks || ''
      };

      // Debug: Log the data being sent
      console.log('Sending borelog data:', borelogData);
      
      // Use the new borelog API to create a new borelog
      const response = await borelogApiV2.create(borelogData);
      
      form.setValue('last_saved', new Date().toISOString());
      
      toast({
        title: 'Borelog Created',
        description: `A new borelog has been created successfully. Version ${response.data.data.version_no}`,
      });
      
    } catch (error: any) {
      console.error('Save error:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Failed to create version.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle show version history
  const handleShowVersionHistory = () => {
    setShowVersionHistory(!showVersionHistory);
    if (!showVersionHistory) {
      loadVersionHistory();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading borelog form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto p-2 space-y-4">
      {/* Inject Excel-like table styles */}
      <style dangerouslySetInnerHTML={{ __html: excelTableStyles }} />
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">BORE LOG & CORE LOG DATA SHEET</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Specimen Field Log Format
                  </p>
                </div>
                <FormActions
                  isSubmitting={isSubmitting}
                  isSaving={isSaving}
                  canEdit={canEdit}
                  canApprove={canApprove}
                  onSave={handleSaveDraft}
                  onShowVersionHistory={handleShowVersionHistory}
                  showVersionHistory={showVersionHistory}
                />
              </div>
            </CardHeader>
          </Card>

          {/* Version History Panel */}
          {showVersionHistory && (
            <VersionHistory
              versions={versions}
              canApprove={canApprove}
              form={form}
              onLoadVersion={loadVersion}
              onApproveVersion={handleApproveVersion}
              onRejectVersion={handleRejectVersion}
            />
          )}

          {/* Project Information Section */}
          <ProjectInfoSection
            form={form}
            projects={projects}
            structures={structures}
            boreholes={boreholes}
            canEdit={canEdit}
          />

          {/* Stratum Table */}
          <StratumTable
            form={form}
            canEdit={canEdit}
          />

          {/* Color Legend */}
          <ColorLegend />
        </form>
      </FormProvider>
    </div>
  );
}
