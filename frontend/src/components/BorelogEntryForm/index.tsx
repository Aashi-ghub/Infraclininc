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
  borelogSubmissionApi
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

  // Watch borehole changes to auto-fill data
  const watchedBoreholeId = form.watch('borehole_id');
  useEffect(() => {
    if (watchedBoreholeId) {
      autoFillBoreholeData(watchedBoreholeId);
    }
  }, [watchedBoreholeId]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!canEdit || isSubmitting) return;
    
    const formData = form.getValues();
    if (!formData.project_id || !formData.structure_id || !formData.borehole_id) return;
    
    try {
      setIsSaving(true);
      await borelogSubmissionApi.saveDraft({
        ...formData,
        edited_by: typedUser?.user_id || '',
        editor_name: typedUser?.name || '',
        is_auto_save: true
      });
      
      form.setValue('last_saved', new Date().toISOString());
      form.setValue('is_auto_save', true);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, isSubmitting, form, typedUser]);

  // Set up auto-save interval
  useEffect(() => {
    if (!canEdit) return;
    
    const interval = setInterval(autoSave, 30000); // Auto-save every 30 seconds
    return () => clearInterval(interval);
  }, [autoSave, canEdit]);

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

  // Load projects
  const loadProjects = async () => {
    try {
      const response = await projectsApi.list();
      setProjects(response.data.data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Load structures for a project
  const loadStructures = async (projectId: string) => {
    try {
      const response = await structuresApi.getByProject(projectId);
      setStructures(response.data.data || []);
    } catch (error) {
      console.error('Error loading structures:', error);
    }
  };

  // Load boreholes for a structure
  const loadBoreholes = async (projectId: string, structureId: string) => {
    try {
      const response = await boreholesApi.getByProjectAndStructure(projectId, structureId);
      setBoreholes(response.data.data || []);
    } catch (error) {
      console.error('Error loading boreholes:', error);
    }
  };

  // Auto-fill borehole data
  const autoFillBoreholeData = async (boreholeId: string) => {
    try {
      const response = await boreholesApi.getById(boreholeId);
      const borehole = response.data.data;
      
      // Auto-fill form fields with borehole data (only available fields)
      form.setValue('location', borehole.location || '');
      form.setValue('msl', borehole.msl ? parseFloat(borehole.msl) : null);
      form.setValue('method_of_boring', borehole.boring_method || '');
      form.setValue('diameter_of_hole', borehole.hole_diameter?.toString() || '');
      form.setValue('chainage_km', borehole.chainage ? parseFloat(borehole.chainage) : null);
    } catch (error) {
      console.error('Error auto-filling borehole data:', error);
    }
  };

  // Load version history
  const loadVersionHistory = async () => {
    if (!boreholeId) return;
    
    try {
      const response = await borelogSubmissionApi.getVersionHistory(boreholeId);
      setVersions(response.data.versions || []);
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
      
      // Prepare submission data
      const submissionData = {
        project_id: data.project_id,
        structure_id: data.structure_id,
        borehole_id: data.borehole_id,
        version_number: data.version_number,
        edited_by: typedUser?.user_id || '',
        status: 'submitted' as const,
        form_data: {
          rows: data.stratum_rows.map(row => ({
            id: row.id,
            fields: [
              { id: 'description', name: 'Description', value: row.description, fieldType: 'manual' as const, isRequired: true },
              { id: 'depth_from', name: 'Depth From', value: row.depth_from, fieldType: 'manual' as const, isRequired: false },
              { id: 'depth_to', name: 'Depth To', value: row.depth_to, fieldType: 'manual' as const, isRequired: false },
              { id: 'sample_type', name: 'Sample Type', value: row.sample_type, fieldType: 'manual' as const, isRequired: true },
              // Add other fields as needed
            ],
            description: row.description,
            isSubdivision: row.is_subdivision,
            parentRowId: row.parent_id || undefined
          })),
          metadata: {
            project_name: data.section_name,
            borehole_number: data.borehole_id,
            commencement_date: data.commencement_date,
            completion_date: data.completion_date,
            standing_water_level: data.standing_water_level || 0,
            termination_depth: data.termination_depth || 0
          }
        }
      };
      
      // Submit the form
      await borelogSubmissionApi.submit(submissionData);
      
      toast({
        title: 'Success',
        description: 'Borelog submitted successfully for review.',
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

  // Handle save draft
  const handleSaveDraft = async () => {
    if (!canEdit) return;
    
    try {
      setIsSaving(true);
      
      const formData = form.getValues();
      const saveData = {
        ...formData,
        edited_by: typedUser?.user_id || '',
        editor_name: typedUser?.name || '',
        is_auto_save: false
      };
      
      await borelogSubmissionApi.saveDraft(saveData);
      
      form.setValue('last_saved', new Date().toISOString());
      form.setValue('is_auto_save', false);
      
      toast({
        title: 'Draft Saved',
        description: 'Your draft has been saved successfully.',
      });
      
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save draft.',
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
