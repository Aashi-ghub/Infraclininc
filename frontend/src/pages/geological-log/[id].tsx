import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogApi, borelogDetailsApi } from '@/lib/api';
import { GeologicalLog, BorelogDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/Loader';
import { PDFExportButton } from '@/components/PDFExportButton';
import { BorelogEditModal } from '@/components/BorelogEditModal';
import { ProtectedRoute } from '@/lib/authComponents';

export default function BorelogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [geologicalLog, setGeologicalLog] = useState<GeologicalLog | null>(null);
  const [borelogDetails, setBorelogDetails] = useState<BorelogDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchGeologicalLog = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const response = await geologicalLogApi.getById(id);
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

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Borehole: {geologicalLog.borehole_id}</h1>
            <p className="text-muted-foreground">Project: {geologicalLog.project_name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
              Edit Details
            </Button>
            <PDFExportButton data={geologicalLog} filename={`borelog-${geologicalLog.borehole_id}`} />
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
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Project ID</h3>
                <p>{geologicalLog.project_id}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Project Name</h3>
                <p>{geologicalLog.project_name}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Borehole ID</h3>
                <p>{geologicalLog.borehole_id}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Location</h3>
                <p>{geologicalLog.location}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Coordinates</h3>
                <p>Lat: {geologicalLog.latitude}, Long: {geologicalLog.longitude}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Elevation</h3>
                <p>{geologicalLog.elevation} m</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Total Depth</h3>
                <p>{geologicalLog.total_depth} m</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Water Level</h3>
                <p>{geologicalLog.water_level !== undefined ? `${geologicalLog.water_level} m` : 'Not recorded'}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Drilling Method</h3>
                <p>{geologicalLog.drilling_method}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Start Date</h3>
                <p>{new Date(geologicalLog.start_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">End Date</h3>
                <p>{new Date(geologicalLog.end_date).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-1">Logged By</h3>
                <p>{geologicalLog.logged_by}</p>
              </div>
            </div>

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
              <Link to={`/borelog/${id}/add-detail`}>Add Detail</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isDetailsLoading ? (
              <div className="flex justify-center p-8">
                <Loader size="md" />
              </div>
            ) : borelogDetails.length === 0 ? (
              <div className="text-center p-8">
                <p className="text-muted-foreground">No borelog details found.</p>
                <Button asChild className="mt-4">
                  <Link to={`/borelog/${id}/add-detail`}>Add your first detail</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Depth (m)</TableHead>
                      <TableHead>Sample Type</TableHead>
                      <TableHead>Sample Number</TableHead>
                      <TableHead>Soil Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {borelogDetails
                      .sort((a, b) => a.depth - b.depth)
                      .map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell>{detail.depth}</TableCell>
                          <TableCell>{detail.sample_type}</TableCell>
                          <TableCell>{detail.sample_number}</TableCell>
                          <TableCell>{detail.soil_type || '-'}</TableCell>
                          <TableCell>{detail.description}</TableCell>
                          <TableCell>
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/borelog-detail/${detail.id}`}>View</Link>
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