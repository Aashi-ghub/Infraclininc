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

export default function BorelogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [geologicalLog, setGeologicalLog] = useState<GeologicalLog | null>(null);
  const [borelogDetails, setBorelogDetails] = useState<BorelogDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
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
        toast({
          title: 'Error',
          description: 'Failed to fetch geological log details.',
          variant: 'destructive',
        });
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
    fetchBorelogDetails();
  }, [id, toast]);

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

  if (!geologicalLog) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Geological Log Not Found</h1>
        <p className="mb-4">The geological log you're looking for doesn't exist or has been removed.</p>
        <Button asChild>
          <Link to="/geological-log/list">Back to List</Link>
        </Button>
      </div>
    );
  }

  // Extract coordinates from GeoJSON if available
  const coordinates = geologicalLog.coordinate 
    ? { lat: geologicalLog.coordinate.coordinates[1], lng: geologicalLog.coordinate.coordinates[0] }
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
            <h1 className="text-3xl font-bold">Borehole: {geologicalLog.borehole_number}</h1>
            <p className="text-muted-foreground">Project: {geologicalLog.project_name}</p>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
              <BorelogEditModal 
                borelog={geologicalLog}
                substructures={substructures}
                onUpdate={handleUpdateBorelog}
              />
            </RoleBasedComponent>
            <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
              <DeleteBorelogButton 
                borelogId={geologicalLog.borelog_id} 
                onSuccess={handleDeleteSuccess}
              />
            </RoleBasedComponent>
            <PDFExportButton data={geologicalLog} filename={`borelog-${geologicalLog.borelog_id}`} />
            <Button asChild variant="secondary">
              <Link to="/geological-log/list">Back to List</Link>
            </Button>
          </div>
        </div>

        {/* Geological Log Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Geological Log Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Project Name</h3>
                <p>{geologicalLog.project_name}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Client Name</h3>
                <p>{geologicalLog.client_name}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Job Code</h3>
                <p>{geologicalLog.job_code}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Borehole Number</h3>
                <p>{geologicalLog.borehole_number}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Borehole Location</h3>
                <p>{geologicalLog.borehole_location}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Project Location</h3>
                <p>{geologicalLog.project_location}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Area</h3>
                <p>{geologicalLog.area}</p>
              </div>
              {coordinates && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-1">Coordinates</h3>
                  <p>Lat: {coordinates.lat.toFixed(6)}, Long: {coordinates.lng.toFixed(6)}</p>
                </div>
              )}
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">MSL</h3>
                <p>{geologicalLog.msl || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Termination Depth</h3>
                <p>{geologicalLog.termination_depth} m</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Water Level</h3>
                <p>{geologicalLog.standing_water_level !== undefined ? `${geologicalLog.standing_water_level} m` : 'Not recorded'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Method of Boring</h3>
                <p>{geologicalLog.method_of_boring}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Diameter of Hole</h3>
                <p>{geologicalLog.diameter_of_hole} mm</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Commencement Date</h3>
                <p>{new Date(geologicalLog.commencement_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Completion Date</h3>
                <p>{new Date(geologicalLog.completion_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Logged By</h3>
                <p>{geologicalLog.logged_by}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Checked By</h3>
                <p>{geologicalLog.checked_by}</p>
              </div>
            </div>

            {/* Additional Technical Information */}
            {(geologicalLog.lithology || 
              geologicalLog.rock_methodology || 
              geologicalLog.structural_condition || 
              geologicalLog.weathering_classification || 
              geologicalLog.fracture_frequency_per_m) && (
              <>
                <Separator className="my-6" />
                <h3 className="font-medium mb-4">Additional Technical Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {geologicalLog.lithology && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Lithology</h3>
                      <p>{geologicalLog.lithology}</p>
                    </div>
                  )}
                  {geologicalLog.rock_methodology && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Rock Methodology</h3>
                      <p>{geologicalLog.rock_methodology}</p>
                    </div>
                  )}
                  {geologicalLog.structural_condition && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Structural Condition</h3>
                      <p>{geologicalLog.structural_condition}</p>
                    </div>
                  )}
                  {geologicalLog.weathering_classification && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Weathering Classification</h3>
                      <p>{geologicalLog.weathering_classification}</p>
                    </div>
                  )}
                  {geologicalLog.fracture_frequency_per_m !== undefined && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Fracture Frequency (per m)</h3>
                      <p>{geologicalLog.fracture_frequency_per_m}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {geologicalLog.remarks && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Remarks</h3>
                  <p className="whitespace-pre-line">{geologicalLog.remarks}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Borelog Details */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Borelog Details</CardTitle>
            <Button asChild>
              <Link to={`/borelog-details/create?borelog_id=${geologicalLog.borelog_id}`}>
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
                  <Link to={`/borelog-details/create?borelog_id=${geologicalLog.borelog_id}`}>
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
        {isEditModalOpen && geologicalLog && (
          <BorelogEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            geologicalLog={geologicalLog}
            onUpdate={(updatedLog) => setGeologicalLog(updatedLog)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}