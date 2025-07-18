import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { ProtectedRoute } from '@/lib/authComponents';

interface Anomaly {
  id: string;
  reason: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  flagged_by: string;
  flagged_at: string;
  geological_log: {
    id: string;
    project_name: string;
    borehole_number: string;
    client_name: string;
  };
}

export default function ReviewerDashboard() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    try {
      const response = await apiClient.get('/anomalies');
      setAnomalies(response.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch anomalies',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateAnomalyStatus = async (anomalyId: string, status: 'Accepted' | 'Rejected') => {
    try {
      await apiClient.patch(`/anomalies/${anomalyId}`, { status });
      setAnomalies(prev => 
        prev.map(anomaly => 
          anomaly.id === anomalyId ? { ...anomaly, status } : anomaly
        )
      );
      toast({
        title: 'Success',
        description: `Anomaly ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update anomaly status',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'default';
      case 'Rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const filteredAnomalies = anomalies.filter(anomaly => 
    !statusFilter || anomaly.status === statusFilter
  );

  const stats = {
    total: anomalies.length,
    pending: anomalies.filter(a => a.status === 'Pending').length,
    accepted: anomalies.filter(a => a.status === 'Accepted').length,
    rejected: anomalies.filter(a => a.status === 'Rejected').length,
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading anomalies...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Reviewer', 'Admin']}>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-primary" />
            Reviewer Dashboard
          </h1>
          <p className="text-muted-foreground">Review and manage flagged anomalies in geological logs</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Anomalies</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Flagged Anomalies</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Accepted">Accepted</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAnomalies.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No anomalies found</h3>
                <p className="text-muted-foreground">
                  {statusFilter 
                    ? `No anomalies with status: ${statusFilter}` 
                    : 'No anomalies have been flagged yet'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Borehole</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Flagged By</TableHead>
                      <TableHead>Date Flagged</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnomalies.map((anomaly) => (
                      <TableRow key={anomaly.id}>
                        <TableCell className="font-medium">
                          {anomaly.geological_log.project_name}
                        </TableCell>
                        <TableCell>
                          {anomaly.geological_log.borehole_number}
                        </TableCell>
                        <TableCell>
                          {anomaly.geological_log.client_name}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={anomaly.reason}>
                            {anomaly.reason}
                          </div>
                        </TableCell>
                        <TableCell>{anomaly.flagged_by}</TableCell>
                        <TableCell>
                          {format(new Date(anomaly.flagged_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(anomaly.status)} className="flex items-center gap-1 w-fit">
                            {getStatusIcon(anomaly.status)}
                            {anomaly.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {anomaly.status === 'Pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAnomalyStatus(anomaly.id, 'Accepted')}
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAnomalyStatus(anomaly.id, 'Rejected')}
                                className="text-red-600 border-red-600 hover:bg-red-50"
                              >
                                Reject
                              </Button>
                            </div>
                          )}
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