import React, { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  projectsApi, 
  structuresApi, 
  substructureApi,
  borelogSubmissionApi,
  borelogApiV2
} from '@/lib/api';

// Import components
import { CompanyHeader } from './components/CompanyHeader';
import { SimplifiedProjectInfo } from './components/SimplifiedProjectInfo';
import { SimplifiedStratumTable } from './components/SimplifiedStratumTable';
import { VersionHistory } from './components/VersionHistory';
import { FormActions } from './components/FormActions';

// Import types and styles
import { 
  BorelogEntryFormProps, 
  BorelogFormData, 
  User, 
  Structure, 
  Project, 
  Substructure,
  borelogFormSchema 
} from './components/types';

export function BorelogEntryForm({
  projectId,
  structureId,
  substructureId,
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
  const [substructures, setSubstructures] = useState<Substructure[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [borelogType, setBorelogType] = useState<'Geotechnical' | 'Geological' | undefined>(undefined);
  const [activeVersionNo, setActiveVersionNo] = useState<number | null>(null);
  const [originalValues, setOriginalValues] = useState<any>(null);
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const isApplyingRef = useRef(false);

  // Check if user has editing permissions
  const canEdit = typedUser?.role === 'Admin' || typedUser?.role === 'Project Manager' || typedUser?.role === 'Site Engineer';
  const canApprove = typedUser?.role === 'Admin' || typedUser?.role === 'Approval Engineer';

  // Form setup
  const form = useForm<BorelogFormData>({
    resolver: zodResolver(borelogFormSchema),
    defaultValues: {
      // Project Information
      borelog_id: '',
      project_id: projectId || '',
      job_code: '',
      section_name: 'CNE-AGTL',
      location: 'BR-365 (STEEL GIDER)',
      
      // Borehole Information
      chainage_km: null,
      msl: null,
      method_of_boring: 'Rotary Drilling',
      diameter_of_hole: '150 mm',
      commencement_date: '',
      completion_date: '',
      standing_water_level: null,
      termination_depth: null,
      coordinate_e: '',
      coordinate_l: '',
      
      // Test Counts
      permeability_tests_count: 0,
      spt_tests_count: 0,
      vs_tests_count: 0,
      undisturbed_samples_count: 0,
      disturbed_samples_count: 0,
      water_samples_count: 0,
      
      // Stratum Information
      stratum_rows: [],
      
      // Metadata
      version_number: 1,
      status: 'draft',
      edited_by: '',
      editor_name: '',
      submission_timestamp: '',
      previous_version_id: '',
      last_saved: '',
      is_auto_save: false,
      
      // Legacy fields
      structure_id: structureId || '',
      substructure_id: substructureId || '',
      borehole_id: substructureId || '',
      borehole_number: ''
    }
  });

  // Track form changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name && originalValues && type === 'change') {
        const newValue = form.getValues(name as any);
        const oldValue = originalValues[name];
        
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          setModifiedFields(prev => {
            const next = new Set(prev);
            next.add(name);
            return next;
          });
        } else {
          setModifiedFields(prev => {
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, originalValues]);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Watch project changes
  const watchedProjectId = form.watch('project_id');
  useEffect(() => {
    if (isApplyingRef.current) return;
    if (watchedProjectId) {
      loadStructures(watchedProjectId);
      form.setValue('structure_id', '');
      form.setValue('substructure_id', '');
      form.setValue('borehole_id', '');
    }
  }, [watchedProjectId]);

  // Watch structure changes
  const watchedStructureId = form.watch('structure_id');
  useEffect(() => {
    if (isApplyingRef.current) return;
    if (watchedStructureId && watchedProjectId) {
      loadSubstructures(watchedProjectId, watchedStructureId);
      form.setValue('substructure_id', '');
      form.setValue('borehole_id', '');
    }
  }, [watchedStructureId, watchedProjectId]);

  // Watch substructure changes
  const watchedSubstructureId = form.watch('substructure_id');
  useEffect(() => {
    if (watchedSubstructureId) {
      loadExistingBorelogData(watchedSubstructureId);
    }
  }, [watchedSubstructureId]);

  // Load version history
  const loadVersionHistory = async () => {
    const currentSubstructureId = form.watch('substructure_id');
    if (!currentSubstructureId) return;
    
    try {
      const response = await borelogApiV2.getBySubstructureId(currentSubstructureId);
      console.log('Version history response:', response.data);
      
      const versionHistory = response.data.data.version_history || [];
      console.log('Setting versions:', versionHistory);
      
      setVersions(versionHistory);
    } catch (error) {
      console.error('Error loading version history:', error);
    }
  };

  // Load projects
  const loadProjects = async () => {
    try {
      const response = await borelogApiV2.getFormData();
      setProjects(response.data.data.projects || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Load structures
  const loadStructures = async (projectId: string) => {
    try {
      const response = await borelogApiV2.getFormData({ project_id: projectId });
      const formData = response.data.data;
      setStructures(formData.structures_by_project[projectId] || []);
    } catch (error) {
      console.error('Error loading structures:', error);
    }
  };

  // Load substructures
  const loadSubstructures = async (projectId: string, structureId: string) => {
    try {
      const response = await substructureApi.list(projectId, structureId);
      setSubstructures(response.data.data || []);
    } catch (error) {
      console.error('Error loading substructures:', error);
    }
  };

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

  // Helper: map backend details object into our form fields
  const applyDetailsToForm = async (details: any) => {
    console.log('Applying details to form:', details);
    
    // If details is null or undefined, don't proceed
    if (!details) {
      console.error('Details object is null or undefined');
      return;
    }
    
    isApplyingRef.current = true;
    try {
    const current = form.getValues();
    const next: any = { ...current };

    // Helper to safely convert to number
    const toNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') return null;
      if (value === '-') return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };
    
    // Dates
    const setDate = (field: keyof BorelogFormData, value: any) => {
      if (!value) {
        next[field] = '' as any;
        return;
      }
      try {
        if (value === '-') {
          next[field] = '' as any;
          return;
        }
        const ymd = new Date(value).toISOString().slice(0, 10);
        next[field] = ymd as any;
      } catch (e) {
        console.error(`Error parsing date for ${field}:`, e);
        next[field] = '' as any;
      }
    };

    // Simple mappings (string/number)
    if (details.number !== undefined) next.borehole_number = String(details.number || '');
    if (details.job_code !== undefined) next.job_code = String(details.job_code || '');
    if (details.location !== undefined) next.location = String(details.location || '');
    if (details.chainage_km !== undefined) next.chainage_km = toNumber(details.chainage_km);
    if (details.msl !== undefined) next.msl = toNumber(details.msl);
    if (details.boring_method !== undefined) next.method_of_boring = String(details.boring_method || '');
    if (details.hole_diameter !== undefined) next.diameter_of_hole = String(details.hole_diameter || '');
    if (details.commencement_date !== undefined) setDate('commencement_date', details.commencement_date);
    if (details.completion_date !== undefined) setDate('completion_date', details.completion_date);
    if (details.standing_water_level !== undefined) next.standing_water_level = toNumber(details.standing_water_level);
    if (details.termination_depth !== undefined) next.termination_depth = toNumber(details.termination_depth);

    // Log all details for debugging
    console.log('Details being mapped:', {
      details,
      hasStratumData: !!(
        details.stratum_description ||
        details.stratum_depth_from ||
        details.stratum_depth_to ||
        details.stratum_thickness_m ||
        details.sample_event_type ||
        details.sample_event_depth_m
      ),
      job_code: details.job_code,
      location: details.location,
      chainage_km: details.chainage_km
    });

    // Coordinates mapping
    if (details.coordinate !== undefined && details.coordinate !== null) {
      let easting: string | null = null;
      let northing: string | null = null;
      const coord = details.coordinate;
      
      console.log('Processing coordinate:', coord);
      
      if (Array.isArray(coord) && coord.length >= 2) {
        easting = String(coord[0] ?? '');
        northing = String(coord[1] ?? '');
      } else if (typeof coord === 'object' && coord !== null) {
        // Handle GeoJSON format and other object formats
        if (coord.type === 'Point' && Array.isArray(coord.coordinates)) {
          easting = String(coord.coordinates[0] ?? '');
          northing = String(coord.coordinates[1] ?? '');
        } else {
          easting = coord.e ?? coord.E ?? coord.easting ?? coord.coordinates?.[0] ?? null;
          northing = coord.l ?? coord.L ?? coord.northing ?? coord.coordinates?.[1] ?? null;
          if (easting !== null) easting = String(easting);
          if (northing !== null) northing = String(northing);
        }
      } else if (typeof coord === 'string') {
        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(coord);
          if (parsed.type === 'Point' && Array.isArray(parsed.coordinates)) {
            easting = String(parsed.coordinates[0] ?? '');
            northing = String(parsed.coordinates[1] ?? '');
          } else {
            easting = parsed.e ?? parsed.E ?? parsed.coordinates?.[0] ?? parsed[0] ?? null;
            northing = parsed.l ?? parsed.L ?? parsed.coordinates?.[1] ?? parsed[1] ?? null;
          }
        } catch (e) {
          // Try to parse as string format "POINT(x y)" or "x,y" or "x y"
          if (coord.startsWith('POINT')) {
            const match = coord.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
            if (match) {
              easting = match[1];
              northing = match[2];
            }
          } else {
            const parts = coord.split(/[;,\s]+/).filter(Boolean);
            if (parts.length >= 2) {
              easting = parts[0];
              northing = parts[1];
            }
          }
        }
      }
      
      if (easting !== null) next.coordinate_e = easting;
      if (northing !== null) next.coordinate_l = northing;
      
      console.log('Extracted coordinates:', { easting, northing });
    }
    
    // Apply all the collected values to the form, but avoid changing selection fields here
    Object.entries(next).forEach(([field, value]) => {
      if (field === 'project_id' || field === 'structure_id' || field === 'substructure_id') return;
      form.setValue(field as any, value);
    });

    // Counts mapping (backend singular -> frontend plural fields)
    if (details.permeability_test_count !== undefined) {
      const v = toNumber(details.permeability_test_count);
      next.permeability_tests_count = (v ?? 0) as any;
    }
    if (details.spt_vs_test_count !== undefined) {
      const v = details.spt_vs_test_count;
      if (typeof v === 'string') {
        const [sptStr, vsStr] = v.split('/');
        const spt = toNumber(sptStr?.trim());
        const vs = toNumber(vsStr?.trim());
        next.spt_tests_count = (spt ?? 0) as any;
        next.vs_tests_count = (vs ?? 0) as any;
      } else if (typeof v === 'number') {
        next.spt_tests_count = v as any;
        next.vs_tests_count = 0 as any;
      } else {
        next.spt_tests_count = 0 as any;
        next.vs_tests_count = 0 as any;
      }
    }
    if (details.undisturbed_sample_count !== undefined) {
      const v = toNumber(details.undisturbed_sample_count);
      next.undisturbed_samples_count = (v ?? 0) as any;
    }
    if (details.disturbed_sample_count !== undefined) {
      const v = toNumber(details.disturbed_sample_count);
      next.disturbed_samples_count = (v ?? 0) as any;
    }
    if (details.water_sample_count !== undefined) {
      const v = toNumber(details.water_sample_count);
      next.water_samples_count = (v ?? 0) as any;
    }

    // First check for scalar stratum data
    const hasScalarStratum = !!(
      details.stratum_description ||
      details.stratum_depth_from !== undefined ||
      details.stratum_depth_to !== undefined ||
      details.stratum_thickness_m !== undefined ||
      details.sample_event_type ||
      details.sample_event_depth_m !== undefined ||
      details.run_length_m !== undefined ||
      details.spt_blows_per_15cm !== undefined ||
      details.n_value_is_2131 ||
      details.total_core_length_cm !== undefined ||
      details.tcr_percent !== undefined ||
      details.rqd_length_cm !== undefined ||
      details.rqd_percent !== undefined ||
      details.return_water_colour ||
      details.water_loss ||
      details.borehole_diameter !== undefined
    );
    
    console.log('Checking scalar stratum data:', {
      stratum_description: details.stratum_description,
      stratum_depth_to: details.stratum_depth_to,
      stratum_thickness_m: details.stratum_thickness_m,
      sample_event_type: details.sample_event_type,
      hasScalarStratum
    });
    
    if (hasScalarStratum) {
      console.log('Found scalar stratum data, creating row');
      const singleRow = {
        id: `0-${Date.now()}`,
        description: String(details.stratum_description || ''),
        depth_from: toNumber(details.stratum_depth_from),
        depth_to: toNumber(details.stratum_depth_to),
        thickness: toNumber(details.stratum_thickness_m),
        return_water_color: String(details.return_water_colour || ''),
        water_loss: String(details.water_loss || ''),
        borehole_diameter: details.borehole_diameter != null ? String(details.borehole_diameter) : '',
        remarks: String(details.remarks || ''),
        samples: []
      };

      // Add sample if sample data exists
      if (details.sample_event_type || details.sample_event_depth_m) {
        singleRow.samples.push({
          id: `sample-0-${Date.now()}`,
          sample_type: String(details.sample_event_type || ''),
          depth_mode: 'single' as const,
          depth_single: toNumber(details.sample_event_depth_m),
          depth_from: null,
          depth_to: null,
          run_length: toNumber(details.run_length_m),
          spt_15cm_1: toNumber(details.spt_blows_per_15cm),
          spt_15cm_2: null,
          spt_15cm_3: null,
          n_value: toNumber(details.n_value_is_2131),
          total_core_length: toNumber(details.total_core_length_cm),
          tcr_percent: toNumber(details.tcr_percent),
          rqd_length: toNumber(details.rqd_length_cm),
          rqd_percent: toNumber(details.rqd_percent),
        });
      }

      console.log('Created stratum row from scalar data:', singleRow);
      next.stratum_rows = [singleRow];
    }
    
    // Then try to load from relational tables if available
    if (details.borelog_id && details.version_no) {
      console.log('Attempting to load stratum data for:', details.borelog_id, 'version:', details.version_no);
      try {
        const stratumResponse = await borelogApiV2.getStratumData(details.borelog_id, details.version_no);
        console.log('Stratum response:', stratumResponse.data);
        if (stratumResponse.data?.data?.layers?.length > 0) {
          console.log('Found stratum data from relational tables:', stratumResponse.data.data.layers);
          
          // Ensure each layer has samples array initialized
          const layers = stratumResponse.data.data.layers.map((layer: any) => {
            const samples = Array.isArray(layer.samples) ? layer.samples : [];
            
            return {
              id: layer.id,
              description: layer.description || '',
              depth_from: toNumber(layer.depth_from_m),
              depth_to: toNumber(layer.depth_to_m),
              thickness: toNumber(layer.thickness_m),
              return_water_color: layer.return_water_colour || '',
              water_loss: layer.water_loss || '',
              borehole_diameter: layer.borehole_diameter != null ? String(layer.borehole_diameter) : '',
              remarks: layer.remarks || '',
              samples: samples.map((sample: any) => ({
                id: sample.id,
                sample_type: sample.sample_type || '',
                depth_mode: sample.depth_mode || 'single',
                depth_single: toNumber(sample.depth_single_m),
                depth_from: toNumber(sample.depth_from_m),
                depth_to: toNumber(sample.depth_to_m),
                run_length: toNumber(sample.run_length_m),
                spt_15cm_1: toNumber(sample.spt_15cm_1),
                spt_15cm_2: toNumber(sample.spt_15cm_2),
                spt_15cm_3: toNumber(sample.spt_15cm_3),
                n_value: toNumber(sample.n_value),
                total_core_length_cm: toNumber(sample.total_core_length_cm),
                tcr_percent: toNumber(sample.tcr_percent),
                rqd_length: toNumber(sample.rqd_length_cm),
                rqd_percent: toNumber(sample.rqd_percent),
              }))
            };
          });
          
          console.log('Processed stratum layers:', layers);
          next.stratum_rows = layers;
        }
      } catch (error) {
        console.warn('Failed to load stratum data from relational tables:', error);
      }
    }

    // Store current selections before reset
    const currentProjectId = form.getValues('project_id');
    const currentStructureId = form.getValues('structure_id');
    const currentSubstructureId = form.getValues('substructure_id');
    
    // Apply all changes at once for reliability
    console.log('Applying form values:', next);
    console.log('Stratum rows being applied:', next.stratum_rows);
    form.reset(next);
    
    // Explicitly set stratum_rows as form.reset might not handle nested arrays properly
    if (next.stratum_rows && Array.isArray(next.stratum_rows)) {
      form.setValue('stratum_rows', next.stratum_rows);
    }
    
    // Restore structure and substructure selections
    form.setValue('project_id', currentProjectId, { shouldDirty: false, shouldTouch: false, shouldValidate: false } as any);
    form.setValue('structure_id', currentStructureId, { shouldDirty: false, shouldTouch: false, shouldValidate: false } as any);
    form.setValue('substructure_id', currentSubstructureId, { shouldDirty: false, shouldTouch: false, shouldValidate: false } as any);
    } finally {
      // Allow effects to resume after a tick
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    }
  };

  // Create new borelog
  const createNewBorelog = async (substructureId: string): Promise<boolean> => {
    try {
      const createResponse = await borelogApiV2.create({
        substructure_id: substructureId,
        project_id: form.getValues('project_id'),
        type: 'Geological',
        status: 'draft'
      });
      
      const newBorelog = createResponse.data.data;
      form.setValue('borelog_id', newBorelog.borelog_id);
      form.setValue('version_number', 1);
      setActiveVersionNo(null);
      setBorelogType('Geological');
      setVersions([]);
      
      toast({
        title: 'New Borelog Created',
        description: 'Start entering borelog details',
      });
      
      return true;
    } catch (error) {
      console.error('Error creating new borelog:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new borelog',
        variant: 'destructive'
      });
      return false;
    }
  };

  // Load or create borelog data
  const loadExistingBorelogData = async (substructureId: string) => {
    try {
      const response = await borelogApiV2.getBySubstructureId(substructureId);
      console.log('Backend response:', response.data);
      const borelogData = response.data.data;
      
      if (!borelogData) {
        // No existing borelog - create new one
        console.log('No borelog found, creating new');
        await createNewBorelog(substructureId);
        return;
      }

      // Existing borelog found
      console.log('Found existing borelog');
      
      // Map borehole data
      if (borelogData.structure) {
        const borehole = borelogData.structure;
        form.setValue('borehole_number', borehole.borehole_number || '');
        form.setValue('chainage_km', borehole.chainage || null);
        form.setValue('msl', borehole.borehole_msl || null);
        form.setValue('method_of_boring', borehole.borehole_boring_method || '');
        form.setValue('diameter_of_hole', borehole.borehole_hole_diameter || '');
        
        // Handle coordinates
        if (borehole.borehole_coordinate) {
          try {
            const coord = typeof borehole.borehole_coordinate === 'string'
              ? JSON.parse(borehole.borehole_coordinate)
              : borehole.borehole_coordinate;

            if (coord && typeof coord === 'object' && coord.type === 'Point' && Array.isArray((coord as any).coordinates)) {
              const coords = (coord as any).coordinates;
              form.setValue('coordinate_e', coords[0] != null ? String(coords[0]) : '');
              form.setValue('coordinate_l', coords[1] != null ? String(coords[1]) : '');
            } else if (Array.isArray(coord) && coord.length >= 2) {
              form.setValue('coordinate_e', coord[0] != null ? String(coord[0]) : '');
              form.setValue('coordinate_l', coord[1] != null ? String(coord[1]) : '');
            } else if (coord && typeof coord === 'object') {
              form.setValue('coordinate_e', (coord as any).e ?? (coord as any).E ?? '');
              form.setValue('coordinate_l', (coord as any).l ?? (coord as any).L ?? '');
            }
          } catch (e) {
            console.warn('Failed to parse coordinates:', e);
          }
        }
      }

      // Map latest version data
      if (borelogData.latest_version) {
        const latestVersion = borelogData.latest_version;
        console.log('Latest version:', latestVersion);
        
        // Set version number and IDs
        form.setValue('version_number', latestVersion.version_no + 1);
        setActiveVersionNo(latestVersion.version_no);
        form.setValue('borelog_id', borelogData.borelog_id as any);
        setBorelogType(borelogData.borelog_type);

        // Map version details - combine nested details with structure data
        const details = {
          ...latestVersion.details,
          // Include structure data in details for consistent mapping
          borehole_number: borelogData.structure?.borehole_number,
          chainage: borelogData.structure?.chainage,
          msl: (borelogData.structure?.borehole_msl ?? latestVersion.details?.msl),
          boring_method: (borelogData.structure?.borehole_boring_method ?? latestVersion.details?.boring_method),
          hole_diameter: (borelogData.structure?.borehole_hole_diameter ?? latestVersion.details?.hole_diameter),
          coordinate: (borelogData.structure?.borehole_coordinate ?? latestVersion.details?.coordinate),
          // Include latest version fields that might not be in structure
          job_code: latestVersion.job_code || latestVersion.details?.job_code,
          location: latestVersion.location || latestVersion.details?.location,
          chainage_km: latestVersion.chainage_km || latestVersion.details?.chainage_km,
          // Critical fields for loading stratum data
          borelog_id: borelogData.borelog_id,
          version_no: latestVersion.version_no,
        };
        console.log('Details to map:', details);
        applyDetailsToForm(details);
        
        // Store original values for change tracking
        setOriginalValues(form.getValues());
        setModifiedFields(new Set());
        
        console.log('Form values after mapping:', form.getValues());
        
        toast({
          title: 'Data Loaded',
          description: `Loaded existing data from Version ${latestVersion.version_no}`,
        });
      } else {
        console.log('No latest version found in response');
      }
      
      // Load version history
      setVersions(borelogData.version_history || []);
      
    } catch (error) {
      if (error.response?.status === 404) {
        // 404 means no borelog exists - handle creation
        console.log('404 response, creating new borelog');
        await createNewBorelog(substructureId);
      } else {
      console.error('Error loading existing borelog data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load borelog data',
          variant: 'destructive'
        });
      }
    }
  };

  // Load specific version
  const loadVersion = async (version: any) => {
    try {
      console.log('Loading version:', version);
      
      // Add the job_code, location, and chainage_km from the version object itself
      const details = {
        ...version.details,
        job_code: version.job_code || version.details?.job_code,
        location: version.location || version.details?.location,
        chainage_km: version.chainage_km || version.details?.chainage_km,
        boring_method: version.boring_method || version.details?.boring_method,
        hole_diameter: version.hole_diameter || version.details?.hole_diameter,
        coordinate: version.coordinate || version.details?.coordinate,
        // Critical identifiers for loading relational stratum data
        borelog_id: form.getValues('borelog_id'),
        version_no: version.version_no
      };
      
      console.log('Enhanced version details:', details);
      
      // Store original values before applying new ones
      const originalFormValues = form.getValues();
      
      // Apply the details to the form
      applyDetailsToForm(details);
      console.log('Form values after loading version:', form.getValues());
      setActiveVersionNo(version.version_no);
      
      // Set version number
      form.setValue('version_number', version.version_no + 1);
      
      // Update original values for change tracking
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
      
      toast({
        title: 'Version Loaded',
        description: `Loaded Version ${version.version_no}`,
      });
    } catch (error) {
      console.error('Error loading version:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version.',
        variant: 'destructive',
      });
    }
  };

  // Handle version approval - copies version to main borelog_details table
  const handleApproveVersion = async (versionNo: number) => {
    try {
      const id = form.watch('borelog_id');
      if (!id) throw new Error('Missing borelog_id');
      
      // First approve the version
      await borelogApiV2.approve(id, {
        version_no: versionNo,
        approved_by: typedUser.user_id,
        approval_comments: 'Approved for final version'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} approved and copied to final borelog.`,
      });
      
      // Reload data to get updated status
      loadVersionHistory();
      loadExistingBorelogData(form.getValues('substructure_id'));
      
    } catch (error) {
      console.error('Error approving version:', error);
      const err: any = error;
      const serverMsg = err?.response?.data?.message;
      const serverErr = err?.response?.data?.error;
      const httpStatus = err?.response?.status;
      const description = serverMsg || serverErr || err?.message || 'Failed to approve version.';
      toast({
        title: 'Error',
        description: `${description}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`,
        variant: 'destructive',
      });
    }
  };

  // Handle version rejection
  const handleRejectVersion = async (versionNo: number) => {
    try {
      const id = form.watch('borelog_id');
      if (!id) throw new Error('Missing borelog_id');
      
      await borelogApiV2.reject(id, {
        version_no: versionNo,
        rejected_by: typedUser.user_id,
        rejection_comments: 'Changes needed before approval'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} rejected. Please create a new version with requested changes.`,
      });
      
      // Reload data to get updated status
      loadVersionHistory();
      loadExistingBorelogData(form.getValues('substructure_id'));
      
    } catch (error) {
      console.error('Error rejecting version:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject version.',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission
  const onSubmit: SubmitHandler<BorelogFormData> = async (data) => {
    if (!canEdit) return;
    
    try {
      setIsSubmitting(true);
      if (!data.borelog_id) {
        throw new Error('No borelog found for selected substructure. Load an existing borelog before submitting.');
      }
      
      // Check if substructure_id is set
      if (!data.substructure_id || data.substructure_id === '') {
        throw new Error('Please select a substructure before submitting.');
      }
      const payload: any = {
        borelog_id: data.borelog_id,
        substructure_id: data.substructure_id,
        project_id: data.project_id,
        type: borelogType || 'Geological',
        status: 'submitted',
        version_no: data.version_number,
      };

      console.log('All form values for submission:', data);

      // Map form fields to API fields (only include modified ones)
      const fieldMappings: { [key: string]: string } = {
        msl: 'msl',
        method_of_boring: 'boring_method',
        diameter_of_hole: 'hole_diameter',
        commencement_date: 'commencement_date',
        completion_date: 'completion_date',
        standing_water_level: 'standing_water_level',
        termination_depth: 'termination_depth',
        permeability_tests_count: 'permeability_test_count',
        spt_tests_count: 'spt_vs_test_count',
        vs_tests_count: 'spt_vs_test_count',
        undisturbed_samples_count: 'undisturbed_sample_count',
        disturbed_samples_count: 'disturbed_sample_count',
        water_samples_count: 'water_sample_count',
        // stratum_rows handled separately
        job_code: 'job_code',
        borehole_number: 'number', // Borehole number maps to number field
        location: 'location',
        chainage_km: 'chainage_km',
      };

      const modifiedList = Array.from(modifiedFields);
      modifiedList.forEach((formField) => {
        const apiField = fieldMappings[formField];
        if (!apiField) return;
        let value: any = (data as any)[formField];
          
          // Special handling for certain fields
        if (formField === 'diameter_of_hole' && typeof value === 'string') {
            value = parseFloat(value.replace(/[^0-9.]/g, ''));
        } else if (formField === 'msl' && (value !== null && value !== undefined)) {
          // Backend expects string for msl
          value = String(value);
        } else if (formField === 'standing_water_level' && typeof value === 'string') {
          value = parseFloat(value);
        } else if (formField === 'termination_depth' && typeof value === 'string') {
          value = parseFloat(value);
        } else if (
          formField === 'permeability_tests_count' ||
          formField === 'undisturbed_samples_count' ||
          formField === 'disturbed_samples_count' ||
          formField === 'water_samples_count'
        ) {
          // Backend expects strings for these counts
          value = String(value ?? 0);
        } else if (formField === 'spt_tests_count' || formField === 'vs_tests_count') {
          // Handle SPT/VS count special case
          if (formField === 'spt_tests_count') {
              payload['spt_vs_test_count'] = `${data.spt_tests_count ?? 0}/${data.vs_tests_count ?? 0}`;
            }
            return; // Skip individual field
        } else if (formField === 'stratum_rows') {
          return; // handled separately
        }
        
        // Only include non-empty values; omit null/empty to keep previous version values
        if (value === '' || value === null || value === undefined) return;
        if (typeof value === 'number' && Number.isNaN(value)) return;
        payload[apiField] = value;
      });

      // Handle stratum data in version only if modified
      if (modifiedList.includes('stratum_rows')) {
        const stratumRows = data.stratum_rows;
        if (Array.isArray(stratumRows) && stratumRows.length > 0) {
          payload.stratum_data = JSON.stringify(stratumRows);
        }
      }

      // Handle coordinates only if changed
      if ((modifiedList.includes('coordinate_e') || modifiedList.includes('coordinate_l')) && data.coordinate_e && data.coordinate_l) {
        try {
          const e = parseFloat(data.coordinate_e);
          const l = parseFloat(data.coordinate_l);
          if (!isNaN(e) && !isNaN(l)) {
            payload.coordinate = {
              type: 'Point',
              coordinates: [e, l]
            };
          }
        } catch (error) {
          console.error('Error parsing coordinates:', error);
        }
      }

      console.log('Submitting version with payload:', payload);
      const response = await borelogApiV2.createVersion(payload);
      const newVersion = response.data.data;
      console.log('New version created:', newVersion);
      
      // Update tracking after successful submission
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
      
      // Update version number in the form
      form.setValue('version_number', newVersion.version_no + 1);
      setActiveVersionNo(newVersion.version_no);
      
      toast({
        title: 'Success',
        description: `Borelog submitted successfully! Version ${newVersion.version_no}`,
      });
      
      // Store current selections before reloading
      const currentProjectId = form.getValues('project_id');
      const currentStructureId = form.getValues('structure_id');
      const currentSubstructureId = form.getValues('substructure_id');
      
      // Reload version history and form data to show the new version
      await loadVersionHistory();
      await loadExistingBorelogData(currentSubstructureId);
      
      // Restore structure and substructure selections
      form.setValue('project_id', currentProjectId);
      form.setValue('structure_id', currentStructureId);
      form.setValue('substructure_id', currentSubstructureId);
      
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
      const v = form.getValues();
      if (!v.borelog_id) {
        throw new Error('No borelog found for selected substructure. Load an existing borelog before saving.');
      }
      
      // Check if substructure_id is set
      if (!v.substructure_id || v.substructure_id === '') {
        throw new Error('Please select a substructure before saving.');
      }

      // Base payload with required fields
      const payload: any = {
        borelog_id: v.borelog_id,
        substructure_id: v.substructure_id,
        project_id: v.project_id,
        type: borelogType || 'Geological',
        status: 'draft',
        version_no: v.version_number,
        boring_method: 'Rotary Drilling', // Default value
        hole_diameter: 150, // Default value
      };

      console.log('All form values:', v);

      // Map form fields to API fields
      const fieldMappings: { [key: string]: string } = {
        msl: 'msl',
        method_of_boring: 'boring_method',
        diameter_of_hole: 'hole_diameter',
        commencement_date: 'commencement_date',
        completion_date: 'completion_date',
        standing_water_level: 'standing_water_level',
        termination_depth: 'termination_depth',
        permeability_tests_count: 'permeability_test_count',
        spt_tests_count: 'spt_vs_test_count',
        vs_tests_count: 'spt_vs_test_count',
        undisturbed_samples_count: 'undisturbed_sample_count',
        disturbed_samples_count: 'disturbed_sample_count',
        water_samples_count: 'water_sample_count',
        stratum_rows: 'stratum_data',
        job_code: 'job_code', // Job code maps to job_code field
        borehole_number: 'number', // Borehole number maps to number field
        location: 'location',
        chainage_km: 'chainage_km',
      };

      // Add ALL fields to payload, not just modified ones
      Object.entries(fieldMappings).forEach(([formField, apiField]) => {
        let value = v[formField as keyof BorelogFormData];
          
          // Special handling for certain fields
        if (formField === 'diameter_of_hole' && typeof value === 'string') {
            // If diameter is empty, set to null instead of NaN
            if (value.trim() === '') {
              value = null;
            } else {
              value = parseFloat(value.replace(/[^0-9.]/g, ''));
              if (isNaN(value)) value = null;
            }
        } else if (formField === 'chainage_km') {
            // Keep chainage_km as string to avoid validation errors
            if (value !== null && value !== undefined && value !== '') {
              value = String(value);
            }
        } else if (formField === 'msl' && (value !== null && value !== undefined)) {
          // Backend expects string for msl
          value = String(value);
        } else if (formField === 'standing_water_level' && typeof value === 'string') {
          value = parseFloat(value);
        } else if (formField === 'termination_depth' && typeof value === 'string') {
          value = parseFloat(value);
        } else if (
          formField === 'permeability_tests_count' ||
          formField === 'undisturbed_samples_count' ||
          formField === 'disturbed_samples_count' ||
          formField === 'water_samples_count'
        ) {
          // Backend expects strings for these counts
          value = String(value ?? 0);
        } else if (formField === 'spt_tests_count' || formField === 'vs_tests_count') {
          // Handle SPT/VS count special case
          if (formField === 'spt_tests_count') {
              payload['spt_vs_test_count'] = `${v.spt_tests_count ?? 0}/${v.vs_tests_count ?? 0}`;
            }
            return; // Skip individual field
        } else if (formField === 'stratum_rows') {
          // Skip stratum rows - will handle separately
          return;
          } else if (typeof value === 'number') {
            // Skip NaN numeric values
            if (Number.isNaN(value)) {
              return;
            }
          } else if (typeof value === 'string') {
            // Leave empty strings as-is; we'll skip sending them below
          }
        
        // Handle null/empty values and required field defaults
        if (formField === 'boring_method' && (value === null || value === undefined || value === '')) {
          payload[apiField] = 'Rotary Drilling'; // Default value
        } else if (formField === 'hole_diameter' && (value === null || value === undefined || value === '')) {
          payload[apiField] = 150; // Default value
        } else if (formField === 'msl' && (value === null || value === undefined || value === '')) {
          payload[apiField] = '0'; // Default value for MSL
        } else if (formField === 'substructure_id' && (value === null || value === undefined || value === '')) {
          // Skip empty substructure_id - it's required by backend
          return;
        } else if (
          // Do not send empty strings/nulls for optional string fields (e.g., 'number', 'job_code', 'location', dates)
          (typeof value === 'string' && value.trim() === '') || value === null || value === undefined
        ) {
          return;
        } else {
            payload[apiField] = value;
        }
      });

      // Handle stratum data separately
      const stratumRows = v.stratum_rows;
      if (Array.isArray(stratumRows) && stratumRows.length > 0) {
        // Transform stratum data to match backend schema
        const transformedLayers = stratumRows.map(layer => ({
          ...layer,
          // Convert string fields to numbers where needed
          depth_from_m: layer.depth_from !== undefined ? Number(layer.depth_from) : null,
          depth_to_m: layer.depth_to !== undefined ? Number(layer.depth_to) : null,
          thickness_m: layer.thickness !== undefined ? Number(layer.thickness) : null,
          borehole_diameter: layer.borehole_diameter ? parseFloat(layer.borehole_diameter) : null,
          return_water_colour: layer.return_water_color,
          // Transform samples
          samples: layer.samples?.map(sample => ({
            ...sample,
            depth_single_m: sample.depth_single !== undefined ? Number(sample.depth_single) : null,
            depth_from_m: sample.depth_from !== undefined ? Number(sample.depth_from) : null,
            depth_to_m: sample.depth_to !== undefined ? Number(sample.depth_to) : null,
            run_length_m: sample.run_length !== undefined ? Number(sample.run_length) : null,
            spt_15cm_1: sample.spt_15cm_1 !== undefined ? Number(sample.spt_15cm_1) : null,
            spt_15cm_2: sample.spt_15cm_2 !== undefined ? Number(sample.spt_15cm_2) : null,
            spt_15cm_3: sample.spt_15cm_3 !== undefined ? Number(sample.spt_15cm_3) : null,
            n_value: sample.n_value !== undefined ? Number(sample.n_value) : null,
            total_core_length_cm: sample.total_core_length_cm !== undefined ? Number(sample.total_core_length_cm) : null,
            tcr_percent: sample.tcr_percent !== undefined ? Number(sample.tcr_percent) : null,
            rqd_length_cm: sample.rqd_length !== undefined ? Number(sample.rqd_length) : null,
            rqd_percent: sample.rqd_percent !== undefined ? Number(sample.rqd_percent) : null,
          })) || []
        }));

        // Save stratum data to new tables
        try {
          console.log('Saving stratum data with layers:', transformedLayers);
          console.log('Stratum data details:', {
            layerCount: transformedLayers.length,
            sampleCount: transformedLayers.reduce((acc, layer) => acc + (layer.samples?.length || 0), 0),
            layerSizes: transformedLayers.map(layer => ({
              id: layer.id,
              sampleCount: layer.samples?.length || 0,
              hasDescription: !!layer.description,
              hasDepths: layer.depth_from_m !== null || layer.depth_to_m !== null
            }))
          });
          await borelogApiV2.saveStratumData({
            borelog_id: v.borelog_id,
            version_no: v.version_number,
            layers: transformedLayers,
            user_id: typedUser.user_id
          });
        } catch (error) {
          console.error('Failed to save stratum data:', error);
          throw new Error('Failed to save stratum data');
        }
      }

      // Handle coordinates
      if (v.coordinate_e && v.coordinate_l) {
        try {
          const e = parseFloat(v.coordinate_e);
          const l = parseFloat(v.coordinate_l);
          if (!isNaN(e) && !isNaN(l)) {
            payload.coordinate = {
              type: 'Point',
              coordinates: [e, l]
            };
          }
        } catch (error) {
          console.error('Error parsing coordinates:', error);
        }
      }

      console.log('Saving version with payload:', payload);
      console.log('Payload JSON:', JSON.stringify(payload, null, 2));
      const response = await borelogApiV2.createVersion(payload);
      const newVersion = response.data.data;
      console.log('New version created:', newVersion);
      
      // Update tracking after successful save
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
      
      // Update version number in the form
      form.setValue('version_number', newVersion.version_no + 1);
      setActiveVersionNo(newVersion.version_no);
      
      toast({
        title: 'Success',
        description: `Draft saved successfully! Version ${newVersion.version_no}`,
      });
      
      // Store current selections before reloading
      const currentProjectId = form.getValues('project_id');
      const currentStructureId = form.getValues('structure_id');
      const currentSubstructureId = form.getValues('substructure_id');
      
      // Reload version history and form data to show the new version
      await loadVersionHistory();
      await loadExistingBorelogData(currentSubstructureId);
      
      // Restore structure and substructure selections
      form.setValue('project_id', currentProjectId);
      form.setValue('structure_id', currentStructureId);
      form.setValue('substructure_id', currentSubstructureId);
      
    } catch (error: any) {
      console.error('Save error:', error);
      console.error('Error response:', error.response?.data);
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.response?.data?.error || 'Failed to save draft.',
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
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Header (in a card) */}
          <Card>
            <CardContent className="p-6">
              <CompanyHeader />
            </CardContent>
          </Card>

          {/* Actions Bar (outside the card) */}
          <div className="flex justify-end">
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

          {/* Version History Panel */}
          {showVersionHistory && (
            <VersionHistory
              versions={versions}
              canApprove={canApprove}
              form={form}
              onLoadVersion={loadVersion}
              onApproveVersion={handleApproveVersion}
              onRejectVersion={handleRejectVersion}
              activeVersionNo={activeVersionNo}
            />
          )}

          {/* Main Form Content */}
          <Card>
            <CardContent className="p-6">
              <SimplifiedProjectInfo
                form={form}
                projects={projects}
                structures={structures}
                substructures={substructures}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>

          {/* Stratum Table */}
          <SimplifiedStratumTable
            form={form}
            canEdit={canEdit}
          />
        </form>
      </FormProvider>
    </div>
  );
}