import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileUpload, Download, Eye, CheckCircle, XCircle, Clock, FlaskConical, Search, Filter, Plus, History, FileText, Users, Mountain } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/lib/authComponents';
import { 
  LabRequest, 
  LabReport, 
  UserRole, 
  getLabReportStatusVariant, 
  getLabRequestStatusVariant 
} from '@/lib/types';
import LabReportView from '@/components/LabReportView';
import LabRequestForm from '@/components/LabRequestForm';
import { useNavigate } from 'react-router-dom';
import { labTestResultsApi } from '@/lib/api';

// Mock data for demonstration
const mockLabRequests: LabRequest[] = [
  {
    id: 'req-001',
    borelog_id: 'bl-001',
    sample_id: 'SAMPLE-001',
    requested_by: 'John Smith',
    requested_date: '2024-01-15T10:00:00Z',
    status: 'Pending',
    test_type: 'Compressive Strength Test',
    priority: 'High',
    due_date: '2024-01-20T17:00:00Z',
    notes: 'Critical for foundation design',
    borelog: {
      borehole_number: 'BH-001',
      project_name: 'Highway Bridge Project',
      chainage: '2.5 km'
    }
  },
  {
    id: 'req-002',
    borelog_id: 'bl-002',
    sample_id: 'SAMPLE-002',
    requested_by: 'Sarah Johnson',
    requested_date: '2024-01-14T14:30:00Z',
    status: 'In Progress',
    test_type: 'Density Test',
    priority: 'Medium',
    due_date: '2024-01-18T17:00:00Z',
    borelog: {
      borehole_number: 'BH-002',
      project_name: 'Highway Bridge Project',
      chainage: '3.2 km'
    }
  },
  {
    id: 'req-003',
    borelog_id: 'bl-003',
    sample_id: 'Rock_BH.4',
    requested_by: 'Dr. Sarah Johnson',
    requested_date: '2024-01-16T09:00:00Z',
    status: 'Pending',
    test_type: 'Rock Mechanics Tests',
    priority: 'High',
    due_date: '2024-01-25T17:00:00Z',
    notes: 'Comprehensive rock testing including UCS, Point Load, and Brazilian tests',
    borelog: {
      borehole_number: 'BH-004',
      project_name: 'Highway Bridge Project - Phase 2',
      chainage: '4.8 km'
    }
  }
];

const mockLabReports: LabReport[] = [
  {
    id: 'rep-001',
    request_id: 'req-001',
    borelog_id: 'bl-001',
    sample_id: 'SAMPLE-001',
    test_type: 'Compressive Strength Test',
    results: 'Average compressive strength: 45.2 MPa\nStandard deviation: 2.1 MPa\nSample count: 6',
    file_url: '/reports/compressive-strength-001.pdf',
    submitted_by: 'Dr. Michael Chen',
    submitted_at: '2024-01-16T15:30:00Z',
    status: 'Submitted',
    version: 1,
    borelog: {
      borehole_number: 'BH-001',
      project_name: 'Highway Bridge Project',
      chainage: '2.5 km'
    }
  },
  {
    id: 'rep-002',
    request_id: 'req-002',
    borelog_id: 'bl-002',
    sample_id: 'SAMPLE-002',
    test_type: 'Density Test',
    results: 'Bulk density: 2.45 g/cm³\nDry density: 2.32 g/cm³\nMoisture content: 5.6%',
    file_url: '/reports/density-test-002.pdf',
    submitted_by: 'Dr. Michael Chen',
    submitted_at: '2024-01-17T11:20:00Z',
    status: 'Approved',
    version: 1,
    approved_by: 'Prof. David Wilson',
    approved_at: '2024-01-18T09:15:00Z',
    borelog: {
      borehole_number: 'BH-002',
      project_name: 'Highway Bridge Project',
      chainage: '3.2 km'
    }
  }
];

const testTypes = [
  { id: '1', name: 'Compressive Strength Test', category: 'Strength Tests' },
  { id: '2', name: 'Tensile Strength Test', category: 'Strength Tests' },
  { id: '3', name: 'Density Test', category: 'Soil Tests' },
  { id: '4', name: 'Moisture Content Test', category: 'Soil Tests' },
  { id: '5', name: 'Atterberg Limits Test', category: 'Soil Tests' },
  { id: '6', name: 'Permeability Test', category: 'Hydraulic Tests' },
  { id: '7', name: 'Consolidation Test', category: 'Soil Tests' },
  { id: '8', name: 'Shear Strength Test', category: 'Strength Tests' }
];

export default function LabReportManagement() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<UserRole>('Lab Engineer');
  const [labRequests, setLabRequests] = useState<LabRequest[]>(mockLabRequests);
  const [labReports, setLabReports] = useState<LabReport[]>(mockLabReports);
  const [labTestResults, setLabTestResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<LabReport | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isReviewingReport, setIsReviewingReport] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newReport, setNewReport] = useState({
    test_type: '',
    results: '',
    file: null as File | null
  });
  const [reviewComments, setReviewComments] = useState('');
  const { toast } = useToast();

  // Load lab test results from backend
  useEffect(() => {
    const loadLabTestResults = async () => {
      setIsLoading(true);
      try {
        const response = await labTestResultsApi.getAll();
        if (response.success) {
          setLabTestResults(response.data);
        } else {
          console.error('Failed to load lab test results:', response.message);
        }
      } catch (error) {
        console.error('Error loading lab test results:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load lab test results',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadLabTestResults();
  }, [toast]);

  // Filter data based on role and search
  const filteredRequests = labRequests.filter(request => {
    const matchesSearch = 
      request.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.borelog.borehole_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.test_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const filteredReports = labReports.filter(report => {
    const matchesSearch = 
      report.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.borelog.borehole_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.test_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    // Role-based filtering
    if (activeRole === 'Customer') {
      return matchesSearch && matchesStatus && report.status === 'Approved';
    }
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateLabReport = (requestId: string) => {
    navigate(`/lab-reports/create/${requestId}`);
  };

  const handleReviewReport = async (reportId: string, status: 'Approved' | 'Rejected', comments?: string) => {
    setIsReviewingReport(true);
    
    // Simulate API call
    setTimeout(() => {
      setLabReports(prev => prev.map(report => {
        if (report.id === reportId) {
          return {
            ...report,
            status,
            approved_by: status === 'Approved' ? 'Prof. David Wilson' : undefined,
            approved_at: status === 'Approved' ? new Date().toISOString() : undefined,
            rejected_by: status === 'Rejected' ? 'Prof. David Wilson' : undefined,
            rejected_at: status === 'Rejected' ? new Date().toISOString() : undefined,
            rejection_comments: status === 'Rejected' ? comments : undefined,
          };
        }
        return report;
      }));
      
      setReviewComments('');
      setIsReviewingReport(false);
      
      toast({
        title: 'Success',
        description: `Report ${status.toLowerCase()} successfully`,
      });
    }, 1000);
  };

  const handleCreateRequest = async (requestData: Omit<LabRequest, 'id' | 'requested_date' | 'status'>) => {
    setIsCreatingRequest(true);
    
    // Simulate API call
    setTimeout(() => {
      const newRequest: LabRequest = {
        id: `req-${Date.now()}`,
        ...requestData,
        requested_date: new Date().toISOString(),
        status: 'Pending',
        requested_by: 'John Smith' // This would come from current user
      };

      setLabRequests(prev => [newRequest, ...prev]);
      setIsCreatingRequest(false);
      setShowCreateRequest(false);
      
      toast({
        title: 'Success',
        description: 'Lab test request created successfully',
      });
    }, 1000);
  };

  const getRoleBasedContent = () => {
    switch (activeRole) {
      case 'Project Manager':
        return (
          <div className="space-y-6">
            {/* Create New Request Button */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Lab Test Requests
                  </CardTitle>
                  <Button onClick={() => setShowCreateRequest(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Request
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Borelog ID</TableHead>
                        <TableHead>Sample ID</TableHead>
                        <TableHead>Test Type</TableHead>
                        <TableHead>Requested Date</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.id}</TableCell>
                          <TableCell>{request.borelog.borehole_number}</TableCell>
                          <TableCell>{request.sample_id}</TableCell>
                          <TableCell>{request.test_type}</TableCell>
                          <TableCell>{format(new Date(request.requested_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={request.priority === 'Urgent' ? 'destructive' : 'secondary'}>
                              {request.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getLabRequestStatusVariant(request.status)}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'Lab Engineer':
        return (
          <div className="space-y-6">
            {/* Quick Access Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Quick Access - Lab Test Forms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/lab-reports/unified')}
                    className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Unified Report
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/lab-reports/soil-test')}
                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Create Soil Test Report
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/lab-reports/rock-test')}
                    className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                  >
                    <Mountain className="h-4 w-4 mr-2" />
                    Create Rock Test Report
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Workload Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">Pending</p>
                      <p className="text-2xl font-bold">{filteredRequests.filter(r => r.status === 'Pending').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">In Progress</p>
                      <p className="text-2xl font-bold">{filteredRequests.filter(r => r.status === 'In Progress').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Submitted</p>
                      <p className="text-2xl font-bold">{filteredReports.filter(r => r.submitted_by === 'Dr. Michael Chen' && r.status === 'Submitted').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Approved</p>
                      <p className="text-2xl font-bold">{filteredReports.filter(r => r.submitted_by === 'Dr. Michael Chen' && r.status === 'Approved').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pending Lab Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Lab Requests ({filteredRequests.filter(r => r.status === 'Pending').length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Borelog ID</TableHead>
                        <TableHead>Sample ID</TableHead>
                        <TableHead>Test Type</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Requested Date</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests
                        .filter(request => request.status === 'Pending')
                        .map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.id}</TableCell>
                          <TableCell>{request.borelog.borehole_number}</TableCell>
                          <TableCell>{request.sample_id}</TableCell>
                          <TableCell>{request.test_type}</TableCell>
                          <TableCell>{request.requested_by}</TableCell>
                          <TableCell>{format(new Date(request.requested_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={request.priority === 'Urgent' ? 'destructive' : 'secondary'}>
                              {request.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getLabRequestStatusVariant(request.status)}>
                              {request.status}
                            </Badge>
                          </TableCell>
                                                     <TableCell>
                             <div className="flex gap-2">
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 onClick={() => navigate(`/lab-reports/unified/${request.id}`)}
                                 className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                               >
                                 <FileText className="h-4 w-4 mr-1" />
                                 Fill Sample Report
                               </Button>
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 onClick={() => navigate('/lab-reports/soil-test')}
                                 className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                               >
                                 <FlaskConical className="h-4 w-4 mr-1" />
                                 Soil Only
                               </Button>
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 onClick={() => navigate('/lab-reports/rock-test')}
                                 className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                               >
                                 <Mountain className="h-4 w-4 mr-1" />
                                 Rock Only
                               </Button>
                             </div>
                           </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Submitted Reports */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  My Submitted Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report ID</TableHead>
                        <TableHead>Borelog ID</TableHead>
                        <TableHead>Test Type</TableHead>
                        <TableHead>Submitted On</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports
                        .filter(report => report.submitted_by === 'Dr. Michael Chen')
                        .map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{report.id}</TableCell>
                          <TableCell>{report.borelog.borehole_number}</TableCell>
                          <TableCell>{report.test_type}</TableCell>
                          <TableCell>{format(new Date(report.submitted_at), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={getLabReportStatusVariant(report.status)}>
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">v{report.version}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setSelectedReport(report)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {report.file_url && (
                                <Button size="sm" variant="outline">
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'Approval Engineer':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Reports Pending Review ({filteredReports.filter(r => r.status === 'Submitted').length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report ID</TableHead>
                      <TableHead>Borelog ID</TableHead>
                      <TableHead>Test Type</TableHead>
                      <TableHead>Submitted On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports
                      .filter(report => report.status === 'Submitted')
                      .map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.id}</TableCell>
                        <TableCell>{report.borelog.borehole_number}</TableCell>
                        <TableCell>{report.test_type}</TableCell>
                        <TableCell>{format(new Date(report.submitted_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant={getLabReportStatusVariant(report.status)}>
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">v{report.version}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Approve Report</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to approve this lab report? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleReviewReport(report.id, 'Approved')}>
                                    Approve
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject Report</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Please provide comments for rejection:
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="py-4">
                                  <Textarea
                                    placeholder="Enter rejection comments..."
                                    value={reviewComments}
                                    onChange={(e) => setReviewComments(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleReviewReport(report.id, 'Rejected')}
                                    disabled={!reviewComments.trim()}
                                  >
                                    Reject
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );

      case 'Customer':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Approved Lab Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report ID</TableHead>
                      <TableHead>Borelog ID</TableHead>
                      <TableHead>Test Type</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports
                      .filter(report => report.status === 'Approved')
                      .map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.id}</TableCell>
                        <TableCell>{report.borelog.borehole_number}</TableCell>
                        <TableCell>{report.test_type}</TableCell>
                        <TableCell>{format(new Date(report.approved_at!), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">v{report.version}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {report.file_url && (
                              <Button size="sm" variant="outline">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return <div>Select a role to view content</div>;
    }
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-8 w-8 text-primary" />
              Lab Report Management
            </h1>
            <p className="text-muted-foreground">Manage laboratory test requests and reports</p>
          </div>
        </div>

        {/* Role Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Role Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as UserRole)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="Project Manager">Project Manager</TabsTrigger>
                <TabsTrigger value="Lab Engineer">Lab Engineer</TabsTrigger>
                <TabsTrigger value="Approval Engineer">Approval Engineer</TabsTrigger>
                <TabsTrigger value="Customer">Customer</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by sample ID, borehole, or test type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Role-based Content */}
        {getRoleBasedContent()}

        {/* Lab Report View Modal */}
        {selectedReport && (
          <LabReportView
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
            onReview={handleReviewReport}
            userRole={activeRole}
          />
        )}

                 {/* Create Request Modal */}
         {showCreateRequest && (
           <Dialog open={showCreateRequest} onOpenChange={setShowCreateRequest}>
             <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
               <DialogHeader>
                 <DialogTitle>Create Lab Test Request</DialogTitle>
               </DialogHeader>
               <LabRequestForm
                 onSubmit={handleCreateRequest}
                 onCancel={() => setShowCreateRequest(false)}
                 isLoading={isCreatingRequest}
               />
             </DialogContent>
           </Dialog>
         )}

         
      </div>
    </ProtectedRoute>
  );
}
