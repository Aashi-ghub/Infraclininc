import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { geologicalLogApi } from '@/lib/api';
import { GeologicalLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from '@/components/Loader';
import { ProtectedRoute } from '@/lib/authComponents';
import { useAuth } from '@/lib/auth';

export default function BorelogListPage() {
  const [borelogs, setBorelogs] = useState<GeologicalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { projectId } = useParams<{ projectId?: string }>();
  const { user } = useAuth();

  useEffect(() => {
    const fetchBorelogs = async () => {
      try {
        setLoading(true);
        let response;
        
        if (projectId) {
          response = await geologicalLogApi.getByProject(projectId);
        } else {
          response = await geologicalLogApi.list();
        }
        
        console.log('Borelogs response:', response);
        setBorelogs(response.data.data);
      } catch (error) {
        console.error('Error fetching borelogs:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch borelogs. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBorelogs();
  }, [projectId, toast]);

  const isSiteEngineer = user?.role === 'Site Engineer';

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {projectId ? 'Project Borelogs' : 'All Geological Logs'}
              {isSiteEngineer && ' (My Assignments)'}
            </CardTitle>
            {!isSiteEngineer && (
              <Button asChild>
                <Link to="/geological-log/create">Create New Log</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader size="lg" />
              </div>
            ) : borelogs.length === 0 ? (
              <div className="text-center p-8">
                {isSiteEngineer ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      You don't have any borelog assignments yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Contact your Project Manager to get assigned to borelogs.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">No geological logs found.</p>
                    <Button asChild className="mt-4">
                      <Link to="/geological-log/create">Create your first log</Link>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borehole Number</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Depth</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {borelogs.map((log) => (
                      <TableRow key={log.borelog_id}>
                        <TableCell>{log.borehole_number}</TableCell>
                        <TableCell>{log.project_name}</TableCell>
                        <TableCell>{log.borehole_location}</TableCell>
                        <TableCell>{log.termination_depth} m</TableCell>
                        <TableCell>{new Date(log.commencement_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(log.completion_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/geological-log/${log.borelog_id}`}>View</Link>
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
      </div>
    </ProtectedRoute>
  );
}