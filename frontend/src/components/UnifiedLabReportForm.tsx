import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Send, Download, Eye, FlaskConical, Mountain, FileText, CheckCircle, AlertCircle, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LabRequest, UserRole } from '@/lib/types';
import SoilLabReportForm from './SoilLabReportForm';
import RockLabReportForm from './RockLabReportForm';
import { exportUnifiedLabReportToExcel, UnifiedLabReportData } from '@/lib/labReportExporter';
import { labReportVersionControlApi } from '@/lib/api';

// Helper function to validate UUID format
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

interface UnifiedLabReportFormProps {
  labRequest?: LabRequest;
  existingReport?: any;
  onSubmit: (reportData: any) => void;
  onCancel: () => void;
  onSaveDraft?: (reportData: any) => void;
  isLoading?: boolean;
  userRole?: UserRole;
  isReadOnly?: boolean;
  requestId?: string; // Add requestId prop for version history
}

interface UnifiedFormData {
  // General Info
  lab_report_id?: string;
  lab_request_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  location?: string;
  section_name?: string;
  chainage_km?: number;
  coordinates_e?: number;
  coordinates_n?: number;
  date: Date;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  report_status: string;
  
  // Soil Test Data
  soil_test_data: any[];
  soil_test_completed: boolean;
  
  // Rock Test Data
  rock_test_data: any[];
  rock_test_completed: boolean;
  
  // Review Section
  reviewed_by?: string;
  review_comments?: string;
  approval_status?: 'Approved' | 'Rejected';
  approval_date?: Date;
}

export default function UnifiedLabReportForm({ 
  labRequest, 
  existingReport, 
  onSubmit, 
  onCancel, 
  onSaveDraft,
  isLoading = false,
  userRole = 'Lab Engineer',
  isReadOnly = false,
  requestId
}: UnifiedLabReportFormProps) {
  const { toast } = useToast();
  // Prevent child forms from temporarily overriding key General Info (avoids flicker)
  const sanitizeMeta = React.useCallback((meta: any) => {
    if (!meta || typeof meta !== 'object') return {};
    const { project_name, borehole_no, ...rest } = meta;
    return rest;
  }, []);
  const [formData, setFormData] = useState<UnifiedFormData>({
    lab_report_id: existingReport?.report_id || existingReport?.id || '',
    lab_request_id: labRequest?.id || existingReport?.request_id || requestId || '',
    project_name: labRequest?.borelog?.project_name || existingReport?.borelog?.project_name || '',
    borehole_no: labRequest?.sample_id || existingReport?.sample_id || '',
    client: '',
    location: '',
    section_name: '',
    chainage_km: undefined as any,
    coordinates_e: undefined as any,
    coordinates_n: undefined as any,
    date: existingReport?.submitted_at ? new Date(existingReport.submitted_at) : new Date(),
    tested_by: 'Dr. Michael Chen',
    checked_by: 'Prof. Sarah Johnson',
    approved_by: 'Prof. David Wilson',
    report_status: existingReport?.status || 'Draft',
    soil_test_data: existingReport?.soil_test_data || [],
    soil_test_completed: false,
    rock_test_data: existingReport?.rock_test_data || [],
    rock_test_completed: false,
    reviewed_by: existingReport?.approved_by || '',
    review_comments: existingReport?.rejection_comments || '',
    approval_status: existingReport?.status === 'Approved' ? 'Approved' : 
                    existingReport?.status === 'Rejected' ? 'Rejected' : undefined,
    approval_date: existingReport?.approved_at ? new Date(existingReport.approved_at) : undefined
  });

  const [activeTab, setActiveTab] = useState('general');
  const [currentVersion, setCurrentVersion] = useState(1);
  const [currentStatus, setCurrentStatus] = useState('draft');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [isApplyingVersion, setIsApplyingVersion] = useState(false);
  // Hold incoming test data snapshots to pass to child forms after version loads
  const [incomingSoilDataRef, setIncomingSoilDataRef] = useState<any[] | undefined>(undefined);
  const [incomingRockDataRef, setIncomingRockDataRef] = useState<any[] | undefined>(undefined);

  // Update form data when existingReport changes (e.g., after creation)
  useEffect(() => {
    console.log('UnifiedLabReportForm: existingReport changed:', existingReport);
    if (existingReport) {
      // Parse test data and extract metadata if embedded
      let soilData = existingReport?.soil_test_data || [];
      let rockData = existingReport?.rock_test_data || [];
      
      // Parse JSON strings if needed
      if (typeof soilData === 'string') {
        try { soilData = JSON.parse(soilData); } catch (e) { soilData = []; }
      }
      if (typeof rockData === 'string') {
        try { rockData = JSON.parse(rockData); } catch (e) { rockData = []; }
      }
      
             // Function to segregate data into general info and test data
       const segregateData = (dataArray: any[]) => {
         if (!Array.isArray(dataArray)) return { generalInfo: {}, testData: [] };
         
         const generalInfo: any = {};
         const testData: any[] = [];
         
         console.log('UnifiedLabReportForm: Raw data array:', dataArray);
         
         // First, let's identify the actual structure by looking at the data
         for (const item of dataArray) {
           if (typeof item === 'object' && item !== null) {
             console.log('UnifiedLabReportForm: Processing item:', item);
             
             // Check if this item is purely metadata (contains only metadata fields)
             const keys = Object.keys(item);
             const hasOnlyMetadata = keys.every(key => {
               const lowerKey = key.toLowerCase();
               return lowerKey.includes('project') || 
                      lowerKey.includes('client') || 
                      lowerKey.includes('borehole') || 
                      lowerKey.includes('location') || 
                      lowerKey.includes('section') || 
                      lowerKey.includes('chainage') || 
                      lowerKey.includes('coordinate') || 
                      lowerKey.includes('tested by') || 
                      lowerKey.includes('checked by') || 
                      lowerKey.includes('approved by') ||
                      lowerKey.includes('date') ||
                      key.includes('Project Name:') ||
                      key.includes('Client Name:') ||
                      key.includes('Borehole No:') ||
                      key.includes('Location:') ||
                      key.includes('Section:') ||
                      key.includes('Chainage:') ||
                      key.includes('Coordinates E:') ||
                      key.includes('Coordinates N:') ||
                      key.includes('Tested By:') ||
                      key.includes('Checked By:') ||
                      key.includes('Approved By:');
             });
             
             if (hasOnlyMetadata) {
               // This is a metadata item - extract general info
               for (const [key, value] of Object.entries(item)) {
                 if (value !== null && value !== undefined && value !== '') {
                   let cleanKey = key.replace(':', '').trim();
                   if (cleanKey === 'Project Name') cleanKey = 'project_name';
                   if (cleanKey === 'Client Name') cleanKey = 'client';
                   if (cleanKey === 'Borehole No') cleanKey = 'borehole_no';
                   if (cleanKey === 'Coordinates E') cleanKey = 'coordinates_e';
                   if (cleanKey === 'Coordinates N') cleanKey = 'coordinates_n';
                   if (cleanKey === 'Tested By') cleanKey = 'tested_by';
                   if (cleanKey === 'Checked By') cleanKey = 'checked_by';
                   if (cleanKey === 'Approved By') cleanKey = 'approved_by';
                   
                   generalInfo[cleanKey] = value;
                 }
               }
             } else {
               // This is test data - check if it contains actual test values
               const hasTestValues = Object.entries(item).some(([key, value]) => {
                 if (typeof value === 'number') return true;
                 if (typeof value === 'string') {
                   // Check if it's a numerical value or test-related
                   return /^-?\d+(\.\d+)?$/.test(value) || 
                          key.toLowerCase().includes('result') ||
                          key.toLowerCase().includes('test') ||
                          key.toLowerCase().includes('load') ||
                          key.toLowerCase().includes('strength') ||
                          key.toLowerCase().includes('density') ||
                          key.toLowerCase().includes('ucs') ||
                          key.toLowerCase().includes('mpa') ||
                          key.toLowerCase().includes('kn');
                 }
                 return false;
               });
               
               if (hasTestValues) {
                 testData.push(item);
               }
             }
           }
         }
         
         return { generalInfo, testData };
       };
      
      // Segregate soil data
      const soilSegregation = segregateData(soilData);
      soilData = soilSegregation.testData;
      let extractedMeta = soilSegregation.generalInfo;
      
      // Segregate rock data and merge with existing metadata
      const rockSegregation = segregateData(rockData);
      rockData = rockSegregation.testData;
      extractedMeta = { ...extractedMeta, ...rockSegregation.generalInfo };
      
      console.log('UnifiedLabReportForm: Segregated data:', {
        soilDataCount: soilData.length,
        rockDataCount: rockData.length,
        extractedMeta,
        firstSoilSample: soilData[0],
        firstRockSample: rockData[0]
      });
      
      const updatedFormData = {
        ...formData,
        lab_report_id: existingReport?.report_id || existingReport?.id || formData.lab_report_id,
        lab_request_id: existingReport?.request_id || existingReport?.assignment_id || requestId || formData.lab_request_id,
        project_name: extractedMeta.project_name || existingReport?.project_name || formData.project_name,
        borehole_no: extractedMeta.borehole_no || existingReport?.borehole_no || existingReport?.sample_id || formData.borehole_no,
        client: extractedMeta.client || existingReport?.client || formData.client,
        location: extractedMeta.location || existingReport?.location || formData.location,
        section_name: extractedMeta.section_name || existingReport?.section_name || formData.section_name,
        chainage_km: extractedMeta.chainage_km || existingReport?.chainage_km || formData.chainage_km,
        coordinates_e: extractedMeta.coordinates_e || existingReport?.coordinates_e || formData.coordinates_e,
        coordinates_n: extractedMeta.coordinates_n || existingReport?.coordinates_n || formData.coordinates_n,
        date: existingReport?.test_date ? new Date(existingReport.test_date) : formData.date,
        tested_by: extractedMeta.tested_by || existingReport?.tested_by || formData.tested_by,
        checked_by: extractedMeta.checked_by || existingReport?.checked_by || formData.checked_by,
        approved_by: extractedMeta.approved_by || existingReport?.approved_by || formData.approved_by,
        report_status: existingReport?.status || formData.report_status,
        soil_test_data: Array.isArray(soilData) ? soilData : formData.soil_test_data,
        rock_test_data: Array.isArray(rockData) ? rockData : formData.rock_test_data,
        soil_test_completed: Array.isArray(soilData) && soilData.length > 0,
        rock_test_completed: Array.isArray(rockData) && rockData.length > 0
      };
      console.log('UnifiedLabReportForm: Updated form data:', updatedFormData);
      console.log('UnifiedLabReportForm: Soil data count:', soilData.length);
      console.log('UnifiedLabReportForm: Rock data count:', rockData.length);
      setFormData(updatedFormData);
    }
  }, [existingReport]);

  // Auto-load latest version when we have a report id
  useEffect(() => {
    if (formData.lab_report_id) {
      loadVersionHistory(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.lab_report_id]);

  const handleSoilFormSubmit = (soilData: any) => {
    setFormData(prev => ({ ...prev, soil_test_data: soilData.soil_test_data || [], soil_test_completed: true }));
    toast({ title: 'Soil Test Data Saved', description: 'Soil test data has been saved successfully.' });
  };

  const handleRockFormSubmit = (rockData: any) => {
    setFormData(prev => ({ ...prev, rock_test_data: rockData.rock_test_data || [], rock_test_completed: true }));
    toast({ title: 'Rock Test Data Saved', description: 'Rock test data has been saved successfully.' });
  };

  const handleExportToExcel = () => {
    if (!formData.soil_test_completed && !formData.rock_test_completed) {
      toast({ variant: 'destructive', title: 'Export Error', description: 'Please complete at least one test type before exporting.' });
      return;
    }

    const exportData: UnifiedLabReportData = {
      lab_report_id: formData.lab_report_id || '',
      project_name: formData.project_name,
      borehole_no: formData.borehole_no,
      client: formData.client,
      date: formData.date,
      tested_by: formData.tested_by,
      checked_by: formData.checked_by,
      approved_by: formData.approved_by,
      test_types: [ ...(formData.soil_test_completed ? ['Soil'] : []), ...(formData.rock_test_completed ? ['Rock'] : []) ],
      combined_data: { soil: formData.soil_test_data, rock: formData.rock_test_data }
    };

    try {
      const filename = exportUnifiedLabReportToExcel(exportData);
      toast({ title: 'Export Successful', description: `Lab report exported to ${filename}` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Export Error', description: 'Failed to export lab report. Please try again.' });
    }
  };

  // Completion status for progress indicator
  const getCompletionStatus = () => {
    const total = 2;
    const completed = [formData.soil_test_completed, formData.rock_test_completed].filter(Boolean).length;
    return { completed, total, percentage: (completed / total) * 100 };
  };
  const completionStatus = getCompletionStatus();

  const toReportStatus = (status?: string): string => {
    if (!status) return formData.report_status;
    const s = status.toLowerCase();
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'submitted') return 'Submitted';
    return 'Draft';
  };

  const applyVersionToForm = (version: any) => {
    const details = version?.details || version;
    // Extract potential meta embedded in first soil/rock element
    let soilData: any[] | undefined = Array.isArray(details.soil_test_data) ? details.soil_test_data : undefined;
    let rockData: any[] | undefined = Array.isArray(details.rock_test_data) ? details.rock_test_data : undefined;
    const meta = soilData && soilData[0] && soilData[0].__meta ? soilData[0].__meta : undefined;
    if (meta) {
      soilData = soilData?.slice(1);
    }
    setFormData(prev => ({
      ...prev,
      project_name: meta?.project_name ?? details.project_name ?? prev.project_name,
      borehole_no: meta?.borehole_no ?? details.borehole_no ?? details.sample_id ?? prev.borehole_no,
      client: meta?.client ?? details.client ?? prev.client,
      location: meta?.location ?? details.location ?? prev.location,
      section_name: meta?.section_name ?? details.section_name ?? prev.section_name,
      chainage_km: meta?.chainage_km ?? details.chainage_km ?? prev.chainage_km,
      coordinates_e: meta?.coordinates_e ?? details.coordinates_e ?? prev.coordinates_e,
      coordinates_n: meta?.coordinates_n ?? details.coordinates_n ?? prev.coordinates_n,
      date: details.test_date ? new Date(details.test_date) : prev.date,
      tested_by: meta?.tested_by ?? details.tested_by ?? prev.tested_by,
      checked_by: meta?.checked_by ?? details.checked_by ?? prev.checked_by,
      approved_by: meta?.approved_by ?? details.approved_by ?? prev.approved_by,
      soil_test_data: Array.isArray(soilData) ? soilData : prev.soil_test_data,
      rock_test_data: Array.isArray(rockData) ? rockData : prev.rock_test_data,
      soil_test_completed: Array.isArray(soilData) ? soilData.length > 0 : prev.soil_test_completed,
      rock_test_completed: Array.isArray(rockData) ? rockData.length > 0 : prev.rock_test_completed,
      report_status: toReportStatus(version.status)
    }));
    // Provide snapshots to child forms so they can sync when their tab mounts later
    if (Array.isArray(soilData)) setIncomingSoilDataRef(soilData);
    if (Array.isArray(rockData)) setIncomingRockDataRef(rockData);
    if (typeof version.version_no === 'number') setCurrentVersion(version.version_no);
    if (version.status) setCurrentStatus(version.status);
  };

  const extractVersionPayload = (res: any) => {
    // Accept multiple shapes
    return res?.data?.data || res?.data?.version || res?.data || res;
  };

  const fetchAndApplyVersion = async (reportId: string, versionNo: number, fallback: any) => {
    try {
      const res = await labReportVersionControlApi.getVersion(reportId, versionNo);
      const data = extractVersionPayload(res);
      if (!data) throw new Error('Empty version payload');
      applyVersionToForm({ ...data, version_no: versionNo, status: fallback?.status });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Load Failed', description: e?.message || 'Could not fetch version data.' });
      // Fallback to apply what we have, even if partial
      if (fallback) applyVersionToForm(fallback);
    }
  };

  const loadSpecificVersion = async (version: any) => {
    try {
      setIsApplyingVersion(true);
      if (version?.details) {
        applyVersionToForm(version);
      } else if (formData.lab_report_id) {
        await fetchAndApplyVersion(formData.lab_report_id, version.version_no, version);
      } else {
        toast({ variant: 'destructive', title: 'Missing Report ID', description: 'Cannot load version without a report ID.' });
        return;
      }
      toast({ title: 'Version Loaded', description: `Loaded Version ${version.version_no}` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load version.' });
    } finally {
      // Defer turning off so child forms can sync incoming data first
      setTimeout(() => setIsApplyingVersion(false), 0);
    }
  };

  const loadVersionHistory = async (autoApplyLatest?: boolean) => {
    if (!formData.lab_report_id) {
      toast({ variant: 'destructive', title: 'No Report ID', description: 'Save a draft first to create a report ID.' });
      return;
    }

    setLoadingVersions(true);
    try {
      const response = await labReportVersionControlApi.getVersionHistory(formData.lab_report_id);
      const ok = response?.data?.success ?? false;
      const listRaw = response?.data?.data?.versions ?? [];
      if (ok && Array.isArray(listRaw)) {
        const list = listRaw.slice().sort((a: any, b: any) => b.version_no - a.version_no);
        setVersions(list);
        // Only open the panel when explicitly requested (not during auto-apply or Load Latest)
        if (!autoApplyLatest) {
          setShowVersionHistory(true);
        }
        if (list.length > 0) {
          setCurrentVersion(list[0].version_no);
          if (list[0].status) setCurrentStatus(list[0].status);
          if (autoApplyLatest) {
            setIsApplyingVersion(true);
            if (list[0].details) {
              applyVersionToForm(list[0]);
            } else {
              await fetchAndApplyVersion(formData.lab_report_id, list[0].version_no, list[0]);
            }
            // Defer turning off so child forms can sync incoming data first
            setTimeout(() => setIsApplyingVersion(false), 0);
            toast({ title: 'Latest Loaded', description: `Applied Version ${list[0].version_no}` });
          }
        }
      } else {
        toast({ variant: 'destructive', title: 'Version History Error', description: response?.data?.message || 'Failed to load version history.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Version History Error', description: error?.response?.data?.message || error?.message || 'Failed to load version history.' });
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleVersionHistoryClick = () => {
    if (showVersionHistory) {
      setShowVersionHistory(false);
    } else {
      loadVersionHistory();
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons - Moved to Top */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              {formData.lab_report_id && (
                <Badge variant={formData.report_status === 'Approved' ? 'default' : 'secondary'}>
                  {formData.report_status}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {!isReadOnly && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (onSaveDraft) {
                        toast({ title: 'Saving Draft', description: `Soil rows: ${Array.isArray(formData.soil_test_data) ? formData.soil_test_data.length : 0}, Rock rows: ${Array.isArray(formData.rock_test_data) ? formData.rock_test_data.length : 0}` });
                        onSaveDraft(formData);
                      } else {
                        onSubmit({ ...formData, status: 'draft' });
                      }
                    }}
                    disabled={isLoading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => onSubmit({ ...formData, status: 'submitted' })}
                    disabled={isLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                </>
              )}
              {formData.lab_report_id && (
                <>
                  <Button variant="outline" onClick={handleVersionHistoryClick} disabled={loadingVersions}>
                  <History className="h-4 w-4 mr-2" />
                  {loadingVersions ? 'Loading...' : showVersionHistory ? 'Hide History' : 'Version History'}
                </Button>
                </>
              )}
              <Button variant="outline" onClick={handleExportToExcel} disabled={!formData.soil_test_completed && !formData.rock_test_completed}>
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
              <Button variant="outline" onClick={() => toast({ title: 'Preview', description: 'Preview functionality will be implemented here.' })}>
                <Eye className="h-4 w-4 mr-2" />
                Preview Report
              </Button>
            </div>
          </div>
        </CardContent>
             </Card>

       {/* Version History Section */}
       {showVersionHistory && (
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <History className="h-5 w-5" />
               Version History
             </CardTitle>
           </CardHeader>
           <CardContent>
             {versions.length === 0 ? (
               <div className="text-center py-8 text-gray-500">
                 <FileText className="h-12 w-12 mx-auto mb-4" />
                 <p>No versions found</p>
                 <p className="text-sm">Save a draft to create your first version</p>
               </div>
             ) : (
               <div className="space-y-4">
                 {versions.map((version) => (
                   <div key={version.version_no} className="border rounded-lg p-4">
                     <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <Badge variant="outline">Version {version.version_no}</Badge>
                         <Badge 
                           variant={
                             version.status === 'approved' ? 'default' : 
                             version.status === 'rejected' ? 'destructive' : 
                             version.status === 'submitted' ? 'secondary' : 'outline'
                           }
                         >
                           {version.status}
                         </Badge>
                        {version.version_no === currentVersion && (<Badge variant="secondary">Current</Badge>)}
                        {version.version_no === (versions[0]?.version_no ?? version.version_no) && (<Badge variant="default">Latest</Badge>)}
                       </div>
                      <div className="text-sm text-gray-500">{new Date(version.created_at).toLocaleString()}</div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-2"><span className="font-medium">Created by:</span>{version.created_by_name || 'Unknown'}</div>
                      <div className="flex items-center gap-2"><span className="font-medium">Test Types:</span>{version.test_types?.join(', ') || 'None'}</div>
                     </div>

                    <div className="flex items-center gap-2 mt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => loadSpecificVersion(version)} disabled={version.version_no === currentVersion}>
                        <Eye className="h-4 w-4 mr-1" />
                        {version.version_no === currentVersion ? 'Current' : 'Load'}
                      </Button>
                               </div>
                   </div>
                 ))}
               </div>
             )}
           </CardContent>
         </Card>
       )}

       {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Test Completion Progress</h3>
            <Badge variant={completionStatus.percentage === 100 ? 'default' : 'secondary'}>
              {completionStatus.completed}/{completionStatus.total} Tests Complete
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${formData.soil_test_completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {formData.soil_test_completed ? (<CheckCircle className="h-5 w-5" />) : (<FlaskConical className="h-5 w-5" />)}
              </div>
              <div className="flex-1">
                <p className="font-medium">Soil Tests</p>
                <p className="text-sm text-muted-foreground">{formData.soil_test_completed ? 'Completed' : 'Pending'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${formData.rock_test_completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {formData.rock_test_completed ? (<CheckCircle className="h-5 w-5" />) : (<Mountain className="h-5 w-5" />)}
              </div>
              <div className="flex-1">
                <p className="font-medium">Rock Tests</p>
                <p className="text-sm text-muted-foreground">{formData.rock_test_completed ? 'Completed' : 'Pending'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Form Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General Info</TabsTrigger>
              <TabsTrigger value="soil">Soil Tests</TabsTrigger>
              <TabsTrigger value="rock">Rock Tests</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Report Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">Project Name</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2 bg-gray-50" value={formData.project_name} onChange={(e) => {}} disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Client</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.client} onChange={(e) => setFormData(prev => ({...prev, client: e.target.value}))} disabled={isReadOnly} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Report ID</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2 bg-gray-50" value={formData.lab_report_id || ''} disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2 bg-gray-50" value={formData.report_status} disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <input type="date" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.date ? new Date(formData.date).toISOString().slice(0,10) : ''} onChange={(e) => setFormData(prev => ({...prev, date: e.target.value ? new Date(e.target.value) : prev.date}))} disabled={isReadOnly} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">Borehole No.</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2 bg-gray-50" value={formData.borehole_no} onChange={(e) => {}} disabled />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Coordinates E</label>
                        <input type="number" step="0.001" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.coordinates_e ?? ''} onChange={(e) => setFormData(prev => ({...prev, coordinates_e: e.target.value === '' ? undefined : Number(e.target.value)}))} disabled={isReadOnly} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Coordinates N</label>
                        <input type="number" step="0.001" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.coordinates_n ?? ''} onChange={(e) => setFormData(prev => ({...prev, coordinates_n: e.target.value === '' ? undefined : Number(e.target.value)}))} disabled={isReadOnly} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Section Name</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.section_name ?? ''} onChange={(e) => setFormData(prev => ({...prev, section_name: e.target.value}))} disabled={isReadOnly} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Location</label>
                      <input type="text" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.location ?? ''} onChange={(e) => setFormData(prev => ({...prev, location: e.target.value}))} disabled={isReadOnly} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Chainage (km)</label>
                      <input type="number" step="0.001" className="mt-1 block w-full rounded-md border px-3 py-2" value={formData.chainage_km ?? ''} onChange={(e) => setFormData(prev => ({...prev, chainage_km: e.target.value === '' ? undefined : Number(e.target.value)}))} disabled={isReadOnly} />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="soil" className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-medium">Soil Laboratory Tests</h3>
                {formData.soil_test_completed && (<Badge variant="default" className="bg-green-100 text-green-700"><CheckCircle className="h-4 w-4 mr-1" />Completed</Badge>)}
              </div>
              <SoilLabReportForm
                labRequest={labRequest}
                existingReport={{
                  ...existingReport,
                  soil_test_data: formData.soil_test_data,
                  rock_test_data: formData.rock_test_data
                }}
                onSubmit={handleSoilFormSubmit}
                onCancel={() => {}}
                onSaveDraft={() => {}}
                isLoading={false}
                userRole={userRole}
                isReadOnly={isReadOnly}
                onDataChange={React.useCallback((d) => {
                  console.log('SoilLabReportForm onDataChange:', d);
                  setFormData(prev => ({
                  ...prev,
                  soil_test_data: d.soil_test_data,
                  soil_test_completed: Array.isArray(d.soil_test_data) && d.soil_test_data.length > 0
                  }));
                }, [])}
                incomingSoilData={incomingSoilDataRef}
                onMetaChange={React.useCallback((meta) => setFormData(prev => ({...prev, ...sanitizeMeta(meta)})), [sanitizeMeta])}
              />
            </TabsContent>

            <TabsContent value="rock" className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Mountain className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-medium">Rock Laboratory Tests</h3>
                {formData.rock_test_completed && (<Badge variant="default" className="bg-orange-100 text-orange-700"><CheckCircle className="h-4 w-4 mr-1" />Completed</Badge>)}
              </div>
              <RockLabReportForm
                labRequest={labRequest}
                existingReport={{
                  ...existingReport,
                  soil_test_data: formData.soil_test_data,
                  rock_test_data: formData.rock_test_data
                }}
                onSubmit={handleRockFormSubmit}
                onCancel={() => {}}
                onSaveDraft={() => {}}
                isLoading={false}
                userRole={userRole}
                isReadOnly={isReadOnly}
                onDataChange={React.useCallback((d) => {
                  console.log('RockLabReportForm onDataChange:', d);
                  setFormData(prev => ({
                  ...prev,
                  rock_test_data: d.rock_test_data,
                  rock_test_completed: Array.isArray(d.rock_test_data) && d.rock_test_data.length > 0
                  }));
                }, [])}
                incomingRockData={incomingRockDataRef}
                onMetaChange={React.useCallback((meta) => setFormData(prev => ({...prev, ...sanitizeMeta(meta)})), [sanitizeMeta])}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


    </div>
  );
}
