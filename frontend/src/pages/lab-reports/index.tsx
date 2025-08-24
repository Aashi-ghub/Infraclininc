import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import { LabRequest, LabReport } from '@/lib/types';
import { unifiedLabReportsApi, labReportApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LabReportManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('requests');
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [unifiedReports, setUnifiedReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load lab requests
      const requestsResponse = await labReportApi.getRequests();
      if (requestsResponse.data?.success) {
        setLabRequests(requestsResponse.data.data || []);
      }

      // Load lab reports (using unified lab reports endpoint)
      const reportsResponse = await unifiedLabReportsApi.getAll();
      if (reportsResponse.data?.success) {
        setLabReports(reportsResponse.data.data || []);
      }

      // Load unified lab reports
      const unifiedResponse = await unifiedLabReportsApi.getAll();
      if (unifiedResponse.data?.success) {
        setUnifiedReports(unifiedResponse.data.data || []);
      }
    } catch (error) {
      console.error('Error loading lab data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lab data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this lab request?')) {
      return;
    }

    try {
      await labReportApi.deleteRequest(requestId);
      toast({
        title: 'Success',
        description: 'Lab request deleted successfully',
      });
      loadData(); // Reload data
    } catch (error) {
      console.error('Error deleting lab request:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lab request',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUnifiedReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this unified lab report?')) {
      return;
    }

    try {
      await unifiedLabReportsApi.delete(reportId);
      toast({
        title: 'Success',
        description: 'Unified lab report deleted successfully',
      });
      loadData(); // Reload data
    } catch (error) {
      console.error('Error deleting unified lab report:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete unified lab report',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRequests = labRequests.filter(request => {
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesSearch = request.sample_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.borelog?.borehole_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.borelog?.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredReports = labReports.filter(report => {
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
    const matchesSearch = report.sample_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.borelog?.borehole_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.borelog?.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredUnifiedReports = unifiedReports.filter(report => {
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
    const matchesSearch = report.sample_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.borehole_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'submitted':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading lab data...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer', 'Customer']}>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lab Report Management</h1>
            <p className="text-gray-600 mt-2">Manage lab test requests and reports</p>
          </div>
          <div className="flex gap-2">
            {(user?.role === 'Admin' || user?.role === 'Project Manager') && (
              <Button onClick={() => navigate('/workflow/dashboard')}>
                View Approved Borelogs
              </Button>
            )}
            <Button onClick={() => navigate('/lab-reports/create-request')}>
              Create Lab Request
            </Button>
            <Button onClick={() => navigate('/lab-reports/unified')}>
              Create Unified Report
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="requests">Lab Requests ({labRequests.length})</TabsTrigger>
            <TabsTrigger value="reports">Lab Reports ({labReports.length})</TabsTrigger>
            <TabsTrigger value="unified">Unified Reports ({unifiedReports.length})</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search by sample ID, borehole number, or project name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="requests" className="space-y-4">
            {filteredRequests.length === 0 ? (
            <Card key="no-requests">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No lab requests found</p>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request, index) => (
                <Card key={request.id || `request-${index}`} className="hover:shadow-md transition-shadow">
              <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{request.sample_id}</CardTitle>
                        <CardDescription>
                          {request.borelog?.project_name} - {request.borelog?.borehole_number}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                </div>
              </CardHeader>
              <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Test Type:</span>
                        <p className="text-gray-600">{request.test_type}</p>
                      </div>
                      <div>
                        <span className="font-medium">Requested By:</span>
                        <p className="text-gray-600">{request.requested_by}</p>
                      </div>
                      <div>
                        <span className="font-medium">Requested Date:</span>
                        <p className="text-gray-600">{formatDate(request.requested_date)}</p>
                      </div>
                      <div>
                        <span className="font-medium">Due Date:</span>
                        <p className="text-gray-600">{request.due_date ? formatDate(request.due_date) : 'Not set'}</p>
                      </div>
                </div>
                    {request.notes && (
                      <div className="mt-4">
                        <span className="font-medium">Notes:</span>
                        <p className="text-gray-600 mt-1">{request.notes}</p>
          </div>
                    )}
                    <div className="flex gap-2 mt-4">
                  <Button 
                        size="sm" 
                        onClick={() => navigate(`/lab-reports/create/${request.id}`)}
                        disabled={request.status !== 'Pending'}
                      >
                        Create Report
                  </Button>
                  <Button 
                        size="sm" 
                    variant="outline"
                        onClick={() => navigate(`/lab-reports/unified/${request.id}`)}
                      >
                        Create Unified Report
                  </Button>
                  {user?.role === 'Admin' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDeleteRequest(request.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            {filteredReports.length === 0 ? (
              <Card key="no-reports">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No lab reports found</p>
                </CardContent>
              </Card>
            ) : (
              filteredReports.map((report, index) => (
                <Card key={report.id || `report-${index}`} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{report.sample_id}</CardTitle>
                        <CardDescription>
                          {report.borelog?.project_name} - {report.borelog?.borehole_number}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Test Type:</span>
                        <p className="text-gray-600">{report.test_type}</p>
                  </div>
                    <div>
                        <span className="font-medium">Submitted By:</span>
                        <p className="text-gray-600">{report.submitted_by}</p>
                    </div>
                      <div>
                        <span className="font-medium">Submitted Date:</span>
                        <p className="text-gray-600">{formatDate(report.submitted_at)}</p>
                  </div>
                    <div>
                        <span className="font-medium">Version:</span>
                        <p className="text-gray-600">{report.version}</p>
                    </div>
                  </div>
                    <div className="flex gap-2 mt-4">
                               <Button 
                                 size="sm" 
                                 variant="outline"
                        onClick={() => navigate(`/lab-reports/${report.id}`)}
                               >
                        View Report
                               </Button>
                      {report.file_url && (
                               <Button 
                                 size="sm" 
                                 variant="outline"
                          onClick={() => window.open(report.file_url, '_blank')}
                               >
                          Download PDF
                               </Button>
                      )}
                </div>
              </CardContent>
            </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="unified" className="space-y-4">
            {filteredUnifiedReports.length === 0 ? (
             <Card key="no-unified-reports">
                <CardContent className="text-center py-8">
                  <p className="text-gray-500">No unified lab reports found</p>
                </CardContent>
              </Card>
            ) : (
              filteredUnifiedReports.map((report, index) => (
                <Card key={report.report_id || `unified-report-${index}`} className="hover:shadow-md transition-shadow">
               <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{report.sample_id}</CardTitle>
                        <CardDescription>
                          {report.project_name} - {report.borehole_no}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
               </CardHeader>
               <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Test Types:</span>
                        <p className="text-gray-600">{report.test_types?.join(', ')}</p>
                      </div>
                      <div>
                        <span className="font-medium">Tested By:</span>
                        <p className="text-gray-600">{report.tested_by}</p>
                      </div>
                      <div>
                        <span className="font-medium">Test Date:</span>
                        <p className="text-gray-600">{formatDate(report.test_date)}</p>
                      </div>
                      <div>
                        <span className="font-medium">Client:</span>
                        <p className="text-gray-600">{report.client}</p>
                      </div>
                             </div>
                    <div className="flex gap-2 mt-4">
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 onClick={() => navigate(`/lab-reports/unified/${report.report_id}`)}
                               >
                        View Report
                               </Button>
                               <Button 
                                 size="sm" 
                                 variant="outline"
                        onClick={() => navigate(`/lab-reports/unified/${report.report_id}/edit`)}
                               >
                        Edit Report
                               </Button>
                               {user?.role === 'Admin' && (
                                 <Button 
                                   size="sm" 
                                   variant="destructive"
                                   onClick={() => handleDeleteUnifiedReport(report.report_id)}
                                 >
                                   Delete
                                 </Button>
                               )}
                 </div>
               </CardContent>
             </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="statistics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card key="total-requests">
            <CardHeader>
                  <CardTitle className="text-lg">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
                  <p className="text-3xl font-bold text-blue-600">{labRequests.length}</p>
            </CardContent>
          </Card>
          <Card key="total-reports">
            <CardHeader>
                  <CardTitle className="text-lg">Total Reports</CardTitle>
            </CardHeader>
            <CardContent>
                  <p className="text-3xl font-bold text-green-600">{labReports.length}</p>
            </CardContent>
          </Card>
              <Card key="unified-reports">
          <CardHeader>
                  <CardTitle className="text-lg">Unified Reports</CardTitle>
          </CardHeader>
          <CardContent>
                  <p className="text-3xl font-bold text-purple-600">{unifiedReports.length}</p>
          </CardContent>
        </Card>
              <Card key="pending">
          <CardHeader>
                  <CardTitle className="text-lg">Pending</CardTitle>
          </CardHeader>
          <CardContent>
                  <p className="text-3xl font-bold text-yellow-600">
                    {labRequests.filter(r => r.status === 'Pending').length}
                  </p>
          </CardContent>
        </Card>
            </div>
          </TabsContent>
        </Tabs>


      </div>
    </ProtectedRoute>
  );
}
