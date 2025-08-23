import React, { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { borelogApiV2 } from '@/lib/api';

// Import components
import { CompanyHeader } from '../BorelogEntryForm/components/CompanyHeader';
import { SimplifiedStratumTable } from '../BorelogEntryForm/components/SimplifiedStratumTable';
import { VersionHistory } from '../BorelogEntryForm/components/VersionHistory';
import { FormActions } from '../BorelogEntryForm/components/FormActions';

// Import types and styles
import { 
  BorelogFormData, 
  User, 
  borelogFormSchema 
} from '../BorelogEntryForm/components/types';

interface BorelogEditFormProps {
  borelogId: string;
  onClose?: () => void;
}

export function BorelogEditForm({
  borelogId,
  onClose
}: BorelogEditFormProps) {
  const { user } = useAuth();
  const typedUser = user as User;
  const { toast } = useToast();
  
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [borelogType, setBorelogType] = useState<'Geotechnical' | 'Geological' | undefined>(undefined);
  const [activeVersionNo, setActiveVersionNo] = useState<number | null>(null);
  const [originalValues, setOriginalValues] = useState<any>(null);
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [borelogData, setBorelogData] = useState<any>(null);
  const isApplyingRef = useRef(false);

  // Check if user has editing permissions
  const canEdit = typedUser?.role === 'Admin' || typedUser?.role === 'Project Manager' || typedUser?.role === 'Site Engineer';
  const canApprove = typedUser?.role === 'Admin' || typedUser?.role === 'Approval Engineer';

  // Form setup
  const form = useForm<BorelogFormData>({
    resolver: zodResolver(borelogFormSchema),
    defaultValues: {
      // Project Information
      borelog_id: borelogId,
      project_id: '',
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
      structure_id: '',
      substructure_id: '',
      borehole_id: '',
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
    loadBorelogData();
  }, [borelogId]);

  // Load borelog data
  const loadBorelogData = async () => {
    try {
      setIsLoading(true);
      
      // Get borelog details by ID (this includes scalar stratum fields)
      let borelogData = null;
      let dataSource = '';
      
      // Get borelog details by ID (this includes scalar stratum fields)
      try {
        const response = await borelogApiV2.getDetailsByBorelogId(borelogId);
        console.log('Borelog details response:', response.data);
        console.log('Borelog data structure:', {
          hasData: !!response.data.data,
          dataType: typeof response.data.data,
          isArray: Array.isArray(response.data.data),
          keys: response.data.data ? Object.keys(response.data.data) : []
        });
        borelogData = response.data.data;
        dataSource = 'borelogApiV2';
      } catch (error) {
        console.error('Failed to get borelog details by ID:', error);
        throw new Error('Failed to load borelog data');
      }
      
      console.log('Data source used:', dataSource);
      console.log('Final borelogData:', borelogData);
      console.log('User role:', typedUser?.role);
      
      if (!borelogData) {
        throw new Error('Borelog not found');
      }
      
      setBorelogData(borelogData);
      
      // Set basic borelog info from the first version
      if (Array.isArray(borelogData) && borelogData.length > 0) {
        // Handle borelog details array structure
        const firstVersion = borelogData[0];
        console.log('Setting form values from borelog details array:', {
          project_id: firstVersion.project_id,
          structure_type: firstVersion.structure_type,
          substructure_id: firstVersion.substructure_id,
          substructure_type: firstVersion.substructure_type,
          borelog_type: firstVersion.borelog_type
        });
        form.setValue('project_id', firstVersion.project_id || '');
        form.setValue('structure_id', firstVersion.structure_type || '');
        form.setValue('substructure_id', firstVersion.substructure_id || '');
        form.setValue('borehole_id', firstVersion.substructure_type || '');
        setBorelogType(firstVersion.borelog_type || 'Geological');
        
        console.log('Form values after setting (array case):', {
          project_id: form.getValues('project_id'),
          substructure_id: form.getValues('substructure_id'),
          structure_id: form.getValues('structure_id'),
          borehole_id: form.getValues('borehole_id')
        });
      } else if (borelogData.version_history && Array.isArray(borelogData.version_history) && borelogData.version_history.length > 0) {
        // Handle case where data is an object with version_history array
        const firstVersion = borelogData.version_history[0];
        console.log('Setting form values from version history:', {
          project_id: borelogData.project?.project_id,
          structure_type: borelogData.structure?.structure_type,
          substructure_id: borelogData.structure?.substructure_id,
          substructure_type: borelogData.structure?.substructure_type,
          borelog_type: borelogData.borelog_type
        });
        form.setValue('project_id', borelogData.project?.project_id || '');
        form.setValue('structure_id', borelogData.structure?.structure_type || '');
        form.setValue('substructure_id', borelogData.structure?.substructure_id || '');
        form.setValue('borehole_id', borelogData.structure?.substructure_type || '');
        setBorelogType(borelogData.borelog_type || 'Geological');
        
        console.log('Form values after setting:', {
          project_id: form.getValues('project_id'),
          substructure_id: form.getValues('substructure_id'),
          structure_id: form.getValues('structure_id'),
          borehole_id: form.getValues('borehole_id')
        });
      }
      
      // If substructure_id is still empty, try to get it from the borelog table
      if (!form.getValues('substructure_id') || form.getValues('substructure_id') === '') {
        console.log('Substructure ID is empty, trying to get it from borelog table...');
        try {
          // For now, let's try to get it from the borelog table directly
          // This is a temporary workaround until the backend changes are deployed
          const borelogResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/dev'}/borelog/${borelogId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (borelogResponse.ok) {
            const borelogData = await borelogResponse.json();
            if (borelogData.data && borelogData.data.substructure_id) {
              console.log('Found substructure_id from borelog endpoint:', borelogData.data.substructure_id);
              form.setValue('substructure_id', borelogData.data.substructure_id);
              form.setValue('project_id', borelogData.data.project_id);
            }
          }
        } catch (error) {
          console.error('Error getting substructure_id:', error);
        }
      }
      
      // Load version history
      await loadVersionHistory();
      
      // Load latest version data
      if (Array.isArray(borelogData) && borelogData.length > 0) {
        const latestVersion = borelogData[0];
        await loadVersionData(latestVersion);
      } else if (borelogData.version_history && Array.isArray(borelogData.version_history) && borelogData.version_history.length > 0) {
        const latestVersion = borelogData.version_history[0];
        await loadVersionData(latestVersion);
      }
      
    } catch (error) {
      console.error('Error loading borelog data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load borelog data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load version history
  const loadVersionHistory = async () => {
    try {
      const response = await borelogApiV2.getDetailsByBorelogId(borelogId);
      const borelogData = response.data.data;
      
      console.log('Version history data structure:', {
        hasData: !!borelogData,
        dataType: typeof borelogData,
        isArray: Array.isArray(borelogData),
        keys: borelogData ? Object.keys(borelogData) : []
      });
      
      let versionHistory = [];
      
      if (Array.isArray(borelogData)) {
        // Data is an array of borelog details
        versionHistory = borelogData.map((detail: any) => ({
          version_no: detail.version_no,
          created_at: detail.created_at,
          created_by: {
            user_id: detail.created_by_user_id,
            name: detail.created_by_name,
            email: detail.created_by_email
          },
          details: detail
        }));
      } else if (borelogData && borelogData.version_history && Array.isArray(borelogData.version_history)) {
        // Data is an object with version_history array
        versionHistory = borelogData.version_history;
      } else if (borelogData && borelogData.versions && Array.isArray(borelogData.versions)) {
        // Data is an object with versions array
        versionHistory = borelogData.versions;
      }
      
      console.log('Processed version history:', versionHistory);
      setVersions(versionHistory);
    } catch (error) {
      console.warn('Error loading version history, setting empty array:', error);
      setVersions([]);
    }
  };

  // Load specific version data
  const loadVersionData = async (version: any) => {
    try {
      console.log('Loading version data:', version);
      
      // Extract the details object from the version
      const details = version.details || version;
      console.log('Extracted details:', details);
      
      // Ensure details has the necessary fields for stratum data loading
      const detailsWithIds = {
        ...details,
        borelog_id: borelogId,
        version_no: version.version_no || 1
      };
      
      console.log('Details with IDs for stratum loading:', detailsWithIds);
      
      // Apply version details to form
      await applyDetailsToForm(detailsWithIds);
      
      setActiveVersionNo(version.version_no || 1);
      form.setValue('version_number', (version.version_no || 1) + 1);
      
      // Store original values for change tracking
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
      
      toast({
        title: 'Data Loaded',
        description: `Loaded Version ${version.version_no || 1}`,
      });
    } catch (error) {
      console.error('Error loading version data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load version data',
        variant: 'destructive'
      });
    }
  };

  // Helper: map backend details object into our form fields
  const applyDetailsToForm = async (details: any) => {
    console.log('Applying details to form:', details);
    console.log('Details keys:', Object.keys(details));
    
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
      
             // Also check for alternative field names that might be used
       if (details.borehole_number !== undefined) next.borehole_number = String(details.borehole_number || '');
       if (details.method_of_boring !== undefined) next.method_of_boring = String(details.method_of_boring || '');
       if (details.diameter_of_hole !== undefined) next.diameter_of_hole = String(details.diameter_of_hole || '');
       
       // Additional field mappings for the actual data structure
       if (details.job_code === undefined && details.number !== undefined) {
         next.job_code = String(details.number || '');
       }

       

      // Coordinates mapping
      if (details.coordinate !== undefined && details.coordinate !== null) {
        let easting: string | null = null;
        let northing: string | null = null;
        const coord = details.coordinate;
        
        if (Array.isArray(coord) && coord.length >= 2) {
          easting = String(coord[0] ?? '');
          northing = String(coord[1] ?? '');
        } else if (typeof coord === 'object' && coord !== null) {
          if (coord.type === 'Point' && Array.isArray(coord.coordinates)) {
            easting = String(coord.coordinates[0] ?? '');
            northing = String(coord.coordinates[1] ?? '');
          } else if (coord.coordinates && Array.isArray(coord.coordinates)) {
            // Handle case where coordinates array exists but no type
            easting = String(coord.coordinates[0] ?? '');
            northing = String(coord.coordinates[1] ?? '');
          } else {
            easting = coord.e ?? coord.E ?? coord.easting ?? coord.coordinates?.[0] ?? null;
            northing = coord.l ?? coord.L ?? coord.northing ?? coord.coordinates?.[1] ?? null;
            if (easting !== null) easting = String(easting);
            if (northing !== null) northing = String(northing);
          }
                 } else if (typeof coord === 'string') {
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
             if (coord.startsWith('POINT')) {
               const match = coord.match(/POINT\s*\(\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s*\)/i);
               if (match) {
                 easting = match[1];
                 northing = match[2];
               }
             } else if (coord.startsWith('0101000020')) {
               // Handle WKB (Well-Known Binary) format
               // WKB format: 0101000020E61000000000000000C050400000000000805540
               // This is a Point with SRID 4326 (WGS84)
               try {
                 // Extract the coordinates from the hex string
                 // Skip the header (0101000020E61000) and extract the coordinates
                 const coordHex = coord.substring(18); // Skip the header
                 if (coordHex.length >= 32) {
                   const xHex = coordHex.substring(0, 16);
                   const yHex = coordHex.substring(16, 32);
                   
                   // Convert hex to double (little-endian)
                   const xBuffer = Buffer.from(xHex, 'hex');
                   const yBuffer = Buffer.from(yHex, 'hex');
                   
                   // Reverse the bytes for little-endian
                   xBuffer.reverse();
                   yBuffer.reverse();
                   
                   const x = xBuffer.readDoubleLE(0);
                   const y = yBuffer.readDoubleLE(0);
                   
                   easting = String(x);
                   northing = String(y);
                 }
               } catch (wbkError) {
                 console.warn('Failed to parse WKB coordinate:', wbkError);
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
      }
      
      // Counts mapping
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

            // First check for scalar stratum data (from the details object itself)
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
          console.log('Stratum response structure:', {
            hasData: !!stratumResponse.data?.data,
            hasLayers: !!stratumResponse.data?.data?.layers,
            layerCount: stratumResponse.data?.data?.layers?.length || 0
          });
          
          if (stratumResponse.data?.data?.layers?.length > 0) {
            console.log('Found stratum data from relational tables:', stratumResponse.data.data.layers);
            
            // Ensure each layer has samples array initialized
            const layers = stratumResponse.data.data.layers.map((layer: any) => {
              const samples = Array.isArray(layer.samples) ? layer.samples : [];
              console.log(`Processing layer ${layer.id}:`, { description: layer.description, sampleCount: samples.length });
              
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
                  total_core_length: toNumber(sample.total_core_length_cm),
                  tcr_percent: toNumber(sample.tcr_percent),
                  rqd_length: toNumber(sample.rqd_length_cm),
                  rqd_percent: toNumber(sample.rqd_percent),
                }))
              };
            });
            
            console.log('Processed stratum layers:', layers);
            next.stratum_rows = layers;
          } else {
            console.log('No stratum data found in relational tables');
          }
        } catch (error) {
          console.warn('Failed to load stratum data from relational tables:', error);
          console.error('Error details:', error.response?.data || error.message);
        }
      } else {
        console.log('Missing borelog_id or version_no for stratum data loading:', { 
          borelog_id: details.borelog_id, 
          version_no: details.version_no 
        });
      }
      
            // Apply all changes at once for reliability
      console.log('Applying form values:', next);
      console.log('Stratum rows being applied:', next.stratum_rows);
      
      // Store current selections before reset
      const currentProjectId = form.getValues('project_id');
      const currentStructureId = form.getValues('structure_id');
      const currentSubstructureId = form.getValues('substructure_id');
      
      form.reset(next);
      
      // Explicitly set stratum_rows as form.reset might not handle nested arrays properly
      if (next.stratum_rows && Array.isArray(next.stratum_rows)) {
        console.log('Setting stratum_rows explicitly:', next.stratum_rows);
        form.setValue('stratum_rows', next.stratum_rows);
      }
      
      // Restore structure and substructure selections
      form.setValue('project_id', currentProjectId, { shouldDirty: false, shouldTouch: false, shouldValidate: false } as any);
      form.setValue('structure_id', currentStructureId, { shouldDirty: false, shouldTouch: false, shouldValidate: false } as any);
      form.setValue('substructure_id', currentSubstructureId, { shouldDirty: false, shouldTouch: false, shouldValidate: false } as any);
      
      console.log('Form values after reset:', form.getValues());
      console.log('Stratum rows after reset:', form.getValues('stratum_rows'));
      console.log('Key form values after reset:', {
        job_code: form.getValues('job_code'),
        section_name: form.getValues('section_name'),
        location: form.getValues('location'),
        borehole_number: form.getValues('borehole_number'),
        project_id: form.getValues('project_id'),
        structure_id: form.getValues('structure_id'),
        substructure_id: form.getValues('substructure_id')
      });
      
      // Test setting a simple value to see if the form is working
      setTimeout(() => {
        console.log('Form values after timeout:', form.getValues());
        console.log('Borehole number:', form.getValues('borehole_number'));
        console.log('Method of boring:', form.getValues('method_of_boring'));
        console.log('Stratum rows after timeout:', form.getValues('stratum_rows'));
        console.log('Key form values after timeout:', {
          job_code: form.getValues('job_code'),
          section_name: form.getValues('section_name'),
          location: form.getValues('location'),
          borehole_number: form.getValues('borehole_number'),
          project_id: form.getValues('project_id'),
          structure_id: form.getValues('structure_id'),
          substructure_id: form.getValues('substructure_id')
        });
      }, 100);
      
    } finally {
      setTimeout(() => {
        isApplyingRef.current = false;
      }, 0);
    }
  };

  // Load specific version
  const loadVersion = async (version: any) => {
    try {
      console.log('Loading version:', version);
      
      const details = {
        ...version,
        borelog_id: borelogId,
        version_no: version.version_no
      };
      
      await applyDetailsToForm(details);
      setActiveVersionNo(version.version_no);
      form.setValue('version_number', version.version_no + 1);
      
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

  // Handle version approval
  const handleApproveVersion = async (versionNo: number) => {
    try {
      await borelogApiV2.approve(borelogId, {
        version_no: versionNo,
        approved_by: typedUser.user_id,
        approval_comments: 'Approved for final version'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} approved and copied to final borelog.`,
      });
      
      loadVersionHistory();
      loadBorelogData();
      
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
      await borelogApiV2.reject(borelogId, {
        version_no: versionNo,
        rejected_by: typedUser.user_id,
        rejection_comments: 'Changes needed before approval'
      });
      
      toast({
        title: 'Success',
        description: `Version ${versionNo} rejected. Please create a new version with requested changes.`,
      });
      
      loadVersionHistory();
      loadBorelogData();
      
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
      
      const payload: any = {
        borelog_id: borelogId,
        substructure_id: data.substructure_id,
        project_id: data.project_id,
        type: borelogType || 'Geological',
        status: 'submitted',
        version_no: data.version_number,
      };

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
        job_code: 'job_code',
        borehole_number: 'number',
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
          value = String(value ?? 0);
        } else if (formField === 'spt_tests_count' || formField === 'vs_tests_count') {
          if (formField === 'spt_tests_count') {
              payload['spt_vs_test_count'] = `${data.spt_tests_count ?? 0}/${data.vs_tests_count ?? 0}`;
            }
            return;
        } else if (formField === 'stratum_rows') {
          return;
        }
        
        if (value === '' || value === null || value === undefined) return;
        if (typeof value === 'number' && Number.isNaN(value)) return;
        payload[apiField] = value;
      });

      // Handle stratum data
      if (modifiedList.includes('stratum_rows')) {
        const stratumRows = data.stratum_rows;
        if (Array.isArray(stratumRows) && stratumRows.length > 0) {
          payload.stratum_data = JSON.stringify(stratumRows);
        }
      }

      // Handle coordinates
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
      
      // Update tracking after successful submission
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
      
      form.setValue('version_number', newVersion.version_no + 1);
      setActiveVersionNo(newVersion.version_no);
      
      toast({
        title: 'Success',
        description: `Borelog submitted successfully! Version ${newVersion.version_no}`,
      });
      
      // Reload data
      await loadVersionHistory();
      await loadBorelogData();
      
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
      
      const payload: any = {
        borelog_id: borelogId,
        substructure_id: v.substructure_id,
        project_id: v.project_id,
        type: borelogType || 'Geological',
        status: 'draft',
        version_no: v.version_number,
        boring_method: 'Rotary Drilling',
        hole_diameter: 150,
      };

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
        job_code: 'job_code',
        borehole_number: 'number',
        location: 'location',
        chainage_km: 'chainage_km',
      };

      // Add ALL fields to payload
      Object.entries(fieldMappings).forEach(([formField, apiField]) => {
        let value = v[formField as keyof BorelogFormData];
          
        if (formField === 'diameter_of_hole' && typeof value === 'string') {
            if (value.trim() === '') {
              value = null;
            } else {
              value = parseFloat(value.replace(/[^0-9.]/g, ''));
              if (isNaN(value)) value = null;
            }
        } else if (formField === 'chainage_km') {
            if (value !== null && value !== undefined && value !== '') {
              value = String(value);
            }
        } else if (formField === 'msl' && (value !== null && value !== undefined)) {
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
          value = String(value ?? 0);
        } else if (formField === 'spt_tests_count' || formField === 'vs_tests_count') {
          if (formField === 'spt_tests_count') {
              payload['spt_vs_test_count'] = `${v.spt_tests_count ?? 0}/${v.vs_tests_count ?? 0}`;
            }
            return;
        } else if (formField === 'stratum_rows') {
          return;
        } else if (typeof value === 'number') {
          if (Number.isNaN(value)) {
            return;
          }
        }
        
        if (formField === 'boring_method' && (value === null || value === undefined || value === '')) {
          payload[apiField] = 'Rotary Drilling';
        } else if (formField === 'hole_diameter' && (value === null || value === undefined || value === '')) {
          payload[apiField] = 150;
        } else if (formField === 'msl' && (value === null || value === undefined || value === '')) {
          payload[apiField] = '0';
        } else if (formField === 'substructure_id' && (value === null || value === undefined || value === '')) {
          return;
        } else if (
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
        const transformedLayers = stratumRows.map(layer => ({
          ...layer,
          depth_from_m: layer.depth_from !== undefined ? Number(layer.depth_from) : null,
          depth_to_m: layer.depth_to !== undefined ? Number(layer.depth_to) : null,
          thickness_m: layer.thickness !== undefined ? Number(layer.thickness) : null,
          borehole_diameter: layer.borehole_diameter ? parseFloat(layer.borehole_diameter) : null,
          return_water_colour: layer.return_water_color,
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
            total_core_length: sample.total_core_length !== undefined ? Number(sample.total_core_length) : null,
            tcr_percent: sample.tcr_percent !== undefined ? Number(sample.tcr_percent) : null,
            rqd_length_cm: sample.rqd_length !== undefined ? Number(sample.rqd_length) : null,
            rqd_percent: sample.rqd_percent !== undefined ? Number(sample.rqd_percent) : null,
          })) || []
        }));

        try {
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
      console.log('Payload validation check:', {
        hasBorelogId: !!payload.borelog_id,
        hasSubstructureId: !!payload.substructure_id,
        hasProjectId: !!payload.project_id,
        borelogId: payload.borelog_id,
        substructureId: payload.substructure_id,
        projectId: payload.project_id,
        type: payload.type
      });
      console.log('Form values being used:', {
        borelog_id: v.borelog_id,
        substructure_id: v.substructure_id,
        project_id: v.project_id,
        version_number: v.version_number
      });
      const response = await borelogApiV2.createVersion(payload);
      const newVersion = response.data.data;
      
      // Update tracking after successful save
      setOriginalValues(form.getValues());
      setModifiedFields(new Set());
      
      form.setValue('version_number', newVersion.version_no + 1);
      setActiveVersionNo(newVersion.version_no);
      
      toast({
        title: 'Success',
        description: `Draft saved successfully! Version ${newVersion.version_no}`,
      });
      
      // Reload data
      await loadVersionHistory();
      await loadBorelogData();
      
    } catch (error: any) {
      console.error('Save error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.response?.data?.message);
      console.error('Error details:', error.response?.data?.error);
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
          <p className="mt-4 text-gray-600">Loading borelog data...</p>
          <p className="mt-2 text-sm text-gray-500">Borelog ID: {borelogId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Header */}
          <Card>
            <CardContent className="p-6">
              <CompanyHeader />
            </CardContent>
          </Card>

          {/* Actions Bar */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">Edit Borelog</h1>
              {borelogData && (
                <div className="text-sm text-gray-600">
                  Borelog ID: {borelogId} | Type: {borelogType}
                </div>
              )}
            </div>
            <FormActions
              isSubmitting={isSubmitting}
              isSaving={isSaving}
              canEdit={canEdit}
              canApprove={canApprove}
              onSave={handleSaveDraft}
              onShowVersionHistory={handleShowVersionHistory}
              showVersionHistory={showVersionHistory}
              borelogId={borelogId}
              projectName={borelogData?.project?.name || borelogData?.project_id}
              boreholeNumber={form.getValues('borehole_number') || 'Unknown'}
              currentStatus={activeVersionNo ? (versions.find(v => v.version_no === activeVersionNo)?.status || 'draft') : 'draft'}
              versionNumber={form.getValues('version_number')}
              onActionComplete={() => {
                loadVersionHistory();
                loadBorelogData();
              }}
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

          {/* Project Info Display (Read-only) */}
          {borelogData && (
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Project</label>
                    <p className="mt-1 text-sm text-gray-900">{borelogData.project?.name || borelogData.project_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Structure</label>
                    <p className="mt-1 text-sm text-gray-900">{borelogData.structure?.structure_type || borelogData.structure_id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Substructure</label>
                    <p className="mt-1 text-sm text-gray-900">{borelogData.structure?.substructure_type || borelogData.substructure_id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Borelog Details Form */}
          <Card>
            <CardHeader>
              <CardTitle>Borelog Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Main Form Grid */}
                <div className="grid grid-cols-3 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="job_code">Job Code</Label>
                      <Input
                        {...form.register('job_code')}
                        disabled={!canEdit}
                        className="bg-yellow-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="chainage_km">Chainage (Km)</Label>
                      <Input
                        {...form.register('chainage_km')}
                        disabled={!canEdit}
                        className="bg-yellow-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="borehole_number">Borehole No.</Label>
                      <Input
                        {...form.register('borehole_number')}
                        disabled={!canEdit}
                        className="bg-yellow-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="msl">Mean Sea Level (MSL)</Label>
                      <Input
                        {...form.register('msl')}
                        disabled={!canEdit}
                        className="bg-yellow-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="method_of_boring">Method of Boring / Drilling</Label>
                      <Input
                        {...form.register('method_of_boring')}
                        disabled={!canEdit}
                        defaultValue="Rotary Drilling"
                        className="bg-gray-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="diameter_of_hole">Diameter of Hole</Label>
                      <Input
                        {...form.register('diameter_of_hole')}
                        disabled={!canEdit}
                        defaultValue="150 mm"
                        className="bg-gray-100"
                      />
                    </div>
                  </div>

                  {/* Middle Column */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="section_name">Section Name</Label>
                      <Input
                        {...form.register('section_name')}
                        disabled={!canEdit}
                        defaultValue="CNE-AGTL"
                        className="bg-gray-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        {...form.register('location')}
                        disabled={!canEdit}
                        defaultValue="BR-365 (STEEL GIDER)"
                        className="bg-gray-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="commencement_date">Commencement Date</Label>
                      <Input
                        type="date"
                        {...form.register('commencement_date')}
                        disabled={!canEdit}
                        className="bg-gray-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="completion_date">Completion Date</Label>
                      <Input
                        type="date"
                        {...form.register('completion_date')}
                        disabled={!canEdit}
                        className="bg-gray-100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="standing_water_level">Standing Water Level (m BGL)</Label>
                      <Input
                        {...form.register('standing_water_level')}
                        disabled={!canEdit}
                        className="bg-orange-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="termination_depth">Termination Depth (m BGL)</Label>
                      <Input
                        {...form.register('termination_depth')}
                        disabled={!canEdit}
                        className="bg-orange-50"
                      />
                    </div>
                  </div>

                  {/* Right Column - Test Counts */}
                  <div className="space-y-4">
                    {/* Coordinates: E and L side by side under a single label */}
                    <div>
                      <Label>Co-ordinates</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">E</span>
                          <Input
                            {...form.register('coordinate_e')}
                            disabled={!canEdit}
                            className="bg-gray-100 pl-6"
                            placeholder="e.g., 123456.789"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">L</span>
                          <Input
                            {...form.register('coordinate_l')}
                            disabled={!canEdit}
                            className="bg-gray-100 pl-6"
                            placeholder="e.g., 987654.321"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>No. of Permeability test (PT)</Label>
                      <Input
                        {...form.register('permeability_tests_count')}
                        disabled={!canEdit}
                        className="bg-green-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>No. of SP test (S)</Label>
                        <Input
                          {...form.register('spt_tests_count')}
                          disabled={!canEdit}
                          className="bg-green-50"
                        />
                      </div>
                      <div>
                        <Label>VS test (VS)</Label>
                        <Input
                          {...form.register('vs_tests_count')}
                          disabled={!canEdit}
                          className="bg-green-50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>No. of Undisturbed Sample (U)</Label>
                      <Input
                        {...form.register('undisturbed_samples_count')}
                        disabled={!canEdit}
                        className="bg-green-50"
                      />
                    </div>
                    <div>
                      <Label>No. of Disturbed Sample (D)</Label>
                      <Input
                        {...form.register('disturbed_samples_count')}
                        disabled={!canEdit}
                        className="bg-green-50"
                      />
                    </div>
                    <div>
                      <Label>No. of Water Sample (W)</Label>
                      <Input
                        {...form.register('water_samples_count')}
                        disabled={!canEdit}
                        className="bg-green-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stratum Table */}
          <SimplifiedStratumTable
            form={form}
            canEdit={canEdit}
          />
          
          {/* Debug stratum data */}
          <Card>
            <CardHeader>
              <CardTitle>Debug: Stratum Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <p>Form stratum_rows length: {form.watch('stratum_rows')?.length || 0}</p>
                <p>Form stratum_rows value:</p>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-40">
                  {JSON.stringify(form.watch('stratum_rows'), null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </form>
      </FormProvider>
    </div>
  );
}
