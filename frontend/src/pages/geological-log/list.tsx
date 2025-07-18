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

export default function BorelogListPage() {
  const [borelogs, setBorelogs] = useState<GeologicalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { projectId } = useParams<{ projectId?: string }>();

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

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {projectId ? 'Project Borelogs' : 'All Geological Logs'}
            </CardTitle>
            <Button asChild>
              <Link to="/geological-log/create">Create New Log</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader size="lg" />
              </div>
            ) : borelogs.length === 0 ? (
              <div className="text-center p-8">
                <p className="text-muted-foreground">No geological logs found.</p>
                <Button asChild className="mt-4">
                  <Link to="/geological-log/create">Create your first log</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borehole ID</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Total Depth</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {borelogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.borehole_id}</TableCell>
                        <TableCell>{log.project_name}</TableCell>
                        <TableCell>{log.location}</TableCell>
                        <TableCell>{log.total_depth} m</TableCell>
                        <TableCell>{new Date(log.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(log.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/geological-log/${log.id}`}>View</Link>
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