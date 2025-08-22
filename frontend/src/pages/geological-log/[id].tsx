import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogApi, borelogDetailsApi } from '@/lib/api';
import { GeologicalLog, BorelogDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/Loader';
import { PDFExportButton } from '@/components/PDFExportButton';
import { BorelogEditModal, Substructure } from '@/components/BorelogEditModal';
import { ProtectedRoute } from '@/lib/authComponents';
import { RoleBasedComponent } from '@/components/RoleBasedComponent';
import { Edit } from 'lucide-react';
import { DeleteBorelogButton } from '@/components/DeleteBorelogButton';
import { BorelogImageManager } from '@/components/BorelogImageManager';

export default function BorelogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [geologicalLog, setGeologicalLog] = useState<GeologicalLog | null>(null);
  const [borelogDetails, setBorelogDetails] = useState<BorelogDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isV2Fallback, setIsV2Fallback] = useState(false);
  
  // Mock substructures for demo - in a real app, fetch these from an API
  const [substructures, setSubstructures] = useState<Substructure[]>([
    { id: '1', name: 'Bridge Pier 1', type: 'Pier' },
    { id: '2', name: 'Bridge Pier 2', type: 'Pier' },
    { id: '3', name: 'Abutment North', type: 'Abutment' },
    { id: '4', name: 'Abutment South', type: 'Abutment' },
  ]);

  useEffect(() => {
    const fetchGeologicalLog = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const response = await geologicalLogApi.getById(id);
        console.log('Geological log response:', response);
        setGeologicalLog(response.data.data);
      } catch (error) {
        console.error('Error fetching geological log:', error);
        // If legacy geological_log not found, we'll fall back to V2 borelog_details-only view
        if ((error as any)?.response?.status === 404) {
          setIsV2Fallback(true);
          // Fetch borelog details as fallback
          await fetchBorelogDetails();
        } else {
          toast({
            title: 'Error',
            description: 'Failed to fetch geological log details.',
            variant: 'destructive',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    const fetchBorelogDetails = async () => {
      if (!id) return;
      
      try {
        setIsDetailsLoading(true);
        const response = await borelogDetailsApi.getByBorelogId(id);
        setBorelogDetails(response.data.data);
      } catch (error) {
        console.error('Error fetching borelog details:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch borelog details.',
          variant: 'destructive',
        });
      } finally {
        setIsDetailsLoading(false);
      }
    };

    fetchGeologicalLog();
    // Only fetch borelog details if we're not in fallback mode
    if (!isV2Fallback) {
      fetchBorelogDetails();
    }
  }, [id, toast, isV2Fallback]);

  const handleUpdateBorelog = (updatedBorelog: GeologicalLog) => {
    setGeologicalLog(updatedBorelog);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  // Derive a minimal view from V2 details for newly created borelogs (no geological_log row)
  const latestDetail = borelogDetails.length > 0
    ? borelogDetails.reduce((a, b) => (a.version_no ?? 0) > (b.version_no ?? 0) ? a : b)
    : null as any;

  const effectiveLog: GeologicalLog | null = geologicalLog || (latestDetail
    ? ({
        borelog_id: latestDetail.borelog_id,
        project_name: '',
        client_name: '',
        design_consultant: '',
        job_code: latestDetail.job_code || '',
        project_location: '',
        chainage_km: (latestDetail.chainage_km as any) ?? null,
        area: '',
        borehole_location: '',
        borehole_number: latestDetail.number || '',
        msl: (latestDetail.msl as any) ?? null,
        method_of_boring: latestDetail.boring_method || '',
        diameter_of_hole: latestDetail.hole_diameter as any,
        commencement_date: latestDetail.commencement_date as any,
        completion_date: latestDetail.completion_date as any,
        standing_water_level: latestDetail.standing_water_level as any,
        termination_depth: latestDetail.termination_depth as any,
        coordinate: latestDetail.coordinate as any,
        type_of_core_barrel: '',
        bearing_of_hole: '',
        collar_elevation: null as any,
        logged_by: '',
        checked_by: '',
        lithology: '',
        rock_methodology: '',
        structural_condition: '',
        weathering_classification: '',
        fracture_frequency_per_m: null as any,
        size_of_core_pieces_distribution: null as any,
        remarks: latestDetail.remarks || '',
        images: latestDetail.images || '',
        created_at: latestDetail.created_at as any,
        created_by_user_id: latestDetail.created_by_user_id as any,
        is_approved: false,
        approved_by: null as any,
        approved_at: null as any,
      } as unknown as GeologicalLog)
    : null);

  if (!effectiveLog && !isLoading && !isDetailsLoading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Borelog Not Found</h1>
        <p className="mb-4">The borelog you're looking for doesn't exist or has been removed.</p>
        <Button asChild>
          <Link to="/geological-log/list">Back to List</Link>
        </Button>
      </div>
    );
  }

  // Extract coordinates from GeoJSON if available
  const coordinates = effectiveLog?.coordinate 
    ? { lat: (effectiveLog as any).coordinate.coordinates[1], lng: (effectiveLog as any).coordinate.coordinates[0] }
    : null;

  const handleDeleteSuccess = () => {
    toast({
      title: 'Success',
      description: 'Borelog deleted successfully',
    });
    // Navigate to the list page
    navigate('/geological-log/list', { replace: true });
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Borehole: {effectiveLog?.borehole_number || '—'}</h1>
            <p className="text-muted-foreground">Project: {effectiveLog?.project_name || '—'}</p>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
              <BorelogEditModal 
                borelog={effectiveLog as any}
                substructures={substructures}
                onUpdate={handleUpdateBorelog}
              />
            </RoleBasedComponent>
            <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
              <DeleteBorelogButton 
                borelogId={effectiveLog?.borelog_id as any} 
                onSuccess={handleDeleteSuccess}
              />
            </RoleBasedComponent>
            {effectiveLog && (
              <PDFExportButton data={effectiveLog} filename={`borelog-${(effectiveLog as any).borelog_id}`} />
            )}
            <Button asChild variant="secondary">
              <Link to="/geological-log/list">Back to List</Link>
            </Button>
          </div>
        </div>

        {/* Geological Log Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{isV2Fallback ? 'Borelog Details' : 'Geological Log Details'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Project Name</h3>
                <p>{effectiveLog?.project_name || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Client Name</h3>
                <p>{effectiveLog?.client_name || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Job Code</h3>
                <p>{effectiveLog?.job_code || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Borehole Number</h3>
                <p>{effectiveLog?.borehole_number || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Borehole Location</h3>
                <p>{effectiveLog?.borehole_location || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Project Location</h3>
                <p>{effectiveLog?.project_location || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Area</h3>
                <p>{(effectiveLog as any)?.area || '—'}</p>
              </div>
              {coordinates && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-1">Coordinates</h3>
                  <p>Lat: {coordinates.lat.toFixed(6)}, Long: {coordinates.lng.toFixed(6)}</p>
                </div>
              )}
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">MSL</h3>
                <p>{(effectiveLog as any)?.msl ?? 'Not specified'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Termination Depth</h3>
                <p>{(effectiveLog as any)?.termination_depth ?? '—'} m</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Water Level</h3>
                <p>{(effectiveLog as any)?.standing_water_level !== undefined ? `${(effectiveLog as any).standing_water_level} m` : 'Not recorded'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Method of Boring</h3>
                <p>{(effectiveLog as any)?.method_of_boring || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Diameter of Hole</h3>
                <p>{(effectiveLog as any)?.diameter_of_hole ?? '—'} mm</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Commencement Date</h3>
                <p>{(effectiveLog as any)?.commencement_date ? new Date((effectiveLog as any).commencement_date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Completion Date</h3>
                <p>{(effectiveLog as any)?.completion_date ? new Date((effectiveLog as any).completion_date).toLocaleDateString() : '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Logged By</h3>
                <p>{(effectiveLog as any)?.logged_by || '—'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Checked By</h3>
                <p>{(effectiveLog as any)?.checked_by || '—'}</p>
              </div>
            </div>

            {/* Additional Technical Information */}
            {(effectiveLog as any)?.lithology || 
              (effectiveLog as any)?.rock_methodology || 
              (effectiveLog as any)?.structural_condition || 
              (effectiveLog as any)?.weathering_classification || 
              (effectiveLog as any)?.fracture_frequency_per_m ? (
              <>
                <Separator className="my-6" />
                <h3 className="font-medium mb-4">Additional Technical Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(effectiveLog as any)?.lithology && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Lithology</h3>
                      <p>{(effectiveLog as any).lithology}</p>
                    </div>
                  )}
                  {(effectiveLog as any)?.rock_methodology && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Rock Methodology</h3>
                      <p>{(effectiveLog as any).rock_methodology}</p>
                    </div>
                  )}
                  {(effectiveLog as any)?.structural_condition && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Structural Condition</h3>
                      <p>{(effectiveLog as any).structural_condition}</p>
                    </div>
                  )}
                  {(effectiveLog as any)?.weathering_classification && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Weathering Classification</h3>
                      <p>{(effectiveLog as any).weathering_classification}</p>
                    </div>
                  )}
                  {(effectiveLog as any)?.fracture_frequency_per_m !== undefined && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Fracture Frequency (per m)</h3>
                      <p>{(effectiveLog as any).fracture_frequency_per_m}</p>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {(effectiveLog as any)?.remarks && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Remarks</h3>
                  <p className="whitespace-pre-line">{(effectiveLog as any).remarks}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Borelog Images */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Borelog Images</CardTitle>
          </CardHeader>
          <CardContent>
            <BorelogImageManager
              borelogId={(effectiveLog as any)?.borelog_id || id}
              onImagesChange={() => {
                // Optionally refresh the page or update state
                toast({
                  title: 'Success',
                  description: 'Images updated successfully',
                });
              }}
            />
          </CardContent>
        </Card>

        {/* Borelog Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Borelog Details</CardTitle>
            <Button asChild>
              <Link to={`/borelog-details/${(effectiveLog as any)?.borelog_id || id}`}>
                Add Detail
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isDetailsLoading ? (
              <div className="flex justify-center py-8">
                <Loader size="md" />
              </div>
            ) : borelogDetails.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No borelog details found.</p>
                <Button asChild>
                  <Link to={`/borelog-details/${(effectiveLog as any)?.borelog_id || id}`}>
                    Add your first detail
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Depth Range (m)</TableHead>
                      <TableHead>Stratum Description</TableHead>
                      <TableHead>Boring Method</TableHead>
                      <TableHead>Sample Number</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {borelogDetails.map((detail) => (
                      <TableRow key={`${detail.borelog_id}-${detail.number}`}>
                        <TableCell>{detail.stratum_depth_from} - {detail.stratum_depth_to}</TableCell>
                        <TableCell>{detail.stratum_description}</TableCell>
                        <TableCell>{detail.boring_method}</TableCell>
                        <TableCell>{detail.number}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/geological-log/${detail.borelog_id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal */}
        {isEditModalOpen && effectiveLog && (
          <BorelogEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            geologicalLog={effectiveLog as GeologicalLog}
            onUpdate={(updatedLog) => setGeologicalLog(updatedLog)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}