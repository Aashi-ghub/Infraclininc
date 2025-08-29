import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Eye, 
  Edit, 
  FileText, 
  FlaskConical, 
  Mountain, 
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Download
} from 'lucide-react';
import { unifiedLabReportsApi } from '@/lib/api';
import { format } from 'date-fns';

interface UnifiedLabReport {
  report_id: string;
  assignment_id?: string;
  borelog_id: string;
  sample_id: string;
  project_name: string;
  borehole_no: string;
  client: string;
  test_date: string;
  tested_by: string;
  checked_by: string;
  approved_by: string;
  test_types: string[];
  soil_test_data: any[];
  rock_test_data: any[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
  created_at: string;
  created_by_user_id: string;
}

export default function PendingReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<UnifiedLabReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<UnifiedLabReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, statusFilter, testTypeFilter]);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const response = await unifiedLabReportsApi.getAll();
      
      if (response.data.success) {
        setReports(response.data.data || []);
      } else {
        toast({
          title: 'Error',
          description: response.data.message || 'Failed to load reports',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = reports;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.borehole_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.sample_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    // Filter by test type
    if (testTypeFilter !== 'all') {
      filtered = filtered.filter(report => 
        report.test_types?.some(type => type.toLowerCase() === testTypeFilter.toLowerCase())
      );
    }

    setFilteredReports(filtered);
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/lab-reports/view/${reportId}`);
  };

  const handleEditReport = (reportId: string) => {
    navigate(`/lab-reports/edit/${reportId}`);
  };

  const handleSubmitReport = async (reportId: string) => {
    try {
      await unifiedLabReportsApi.submit(reportId);
      toast({
        title: 'Success',
        description: 'Report submitted for approval',
      });
      loadReports();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit report',
        variant: 'destructive',
      });
    }
  };

  const handleApproveReport = async (reportId: string) => {
    try {
      await unifiedLabReportsApi.approve(reportId);
      toast({
        title: 'Success',
        description: 'Report approved successfully',
      });
      loadReports();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve report',
        variant: 'destructive',
      });
    }
  };

  const handleRejectReport = async (reportId: string) => {
    const reason = prompt('Reason for rejection?') || 'No reason provided';
    try {
      await unifiedLabReportsApi.reject(reportId, { rejection_reason: reason });
      toast({
        title: 'Success',
        description: 'Report rejected successfully',
      });
      loadReports();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject report',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-800', label: 'Submitted' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getTestTypesBadge = (testTypes: string[]) => {
    if (!testTypes || testTypes.length === 0) {
      return <Badge variant="outline">No tests</Badge>;
    }

    return (
      <div className="flex gap-1">
        {testTypes.map((type, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {type === 'Soil' ? <FlaskConical className="w-3 h-3 mr-1" /> : <Mountain className="w-3 h-3 mr-1" />}
            {type}
          </Badge>
        ))}
      </div>
    );
  };

  const getSampleCount = (report: UnifiedLabReport) => {
    const soilCount = report.soil_test_data?.length || 0;
    const rockCount = report.rock_test_data?.length || 0;
    return soilCount + rockCount;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lab Reports</h1>
          <p className="text-gray-600 mt-2">Manage and review laboratory test reports</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadReports} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by test type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Test Types</SelectItem>
                <SelectItem value="soil">Soil Tests</SelectItem>
                <SelectItem value="rock">Rock Tests</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-gray-500 flex items-center">
              {filteredReports.length} of {reports.length} reports
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading reports...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No reports found</p>
              <p className="text-sm">Try adjusting your filters or upload a new report</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Borehole</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Test Types</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.report_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.project_name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">ID: {report.sample_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>{report.borehole_no || 'N/A'}</TableCell>
                    <TableCell>{report.client || 'N/A'}</TableCell>
                    <TableCell>{getTestTypesBadge(report.test_types)}</TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-medium">{getSampleCount(report)}</div>
                        <div className="text-xs text-gray-500">
                          {report.soil_test_data?.length || 0} soil, {report.rock_test_data?.length || 0} rock
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {format(new Date(report.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewReport(report.report_id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditReport(report.report_id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        
                        {/* Submit button for draft reports (Lab Engineers only) */}
                        {report.status === 'draft' && user?.role === 'Lab Engineer' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSubmitReport(report.report_id)}
                          >
                            Submit
                          </Button>
                        )}
                        
                        {/* Approve/Reject buttons for submitted reports (Admin, Project Manager, Approval Engineer) */}
                        {report.status === 'submitted' && ['Admin', 'Project Manager', 'Approval Engineer'].includes(user?.role || '') && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveReport(report.report_id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRejectReport(report.report_id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
