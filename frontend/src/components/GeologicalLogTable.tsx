import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface GeologicalLog {
  id: string;
  project_name: string;
  borehole_number: string;
  client_name: string;
  termination_depth: number;
  commencement_date: string;
  logged_by: string;
  completion_date?: string;
  project_location?: string;
}

interface GeologicalLogTableProps {
  logs: GeologicalLog[];
  isLoading?: boolean;
}

type SortField = keyof GeologicalLog | null;
type SortDirection = 'asc' | 'desc';

export function GeologicalLogTable({ logs, isLoading }: GeologicalLogTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const sortedLogs = [...logs].sort((a, b) => {
    if (!sortField) return 0;
    
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  const handleViewLog = (id: string) => {
    navigate(`/geological-log/${id}`);
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Borehole Number</TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>Termination Depth</TableHead>
              <TableHead>Commencement Date</TableHead>
              <TableHead>Logged By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {[...Array(7)].map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <div className="mx-auto max-w-md">
          <h3 className="text-lg font-semibold mb-2">No geological logs found</h3>
          <p className="text-muted-foreground mb-4">
            No geological logs match your current filters. Try adjusting your search criteria.
          </p>
          <Button 
            onClick={() => navigate('/geological-log/create')}
            className="bg-gradient-to-r from-primary to-primary-glow"
          >
            Create First Log
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border shadow-form">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('project_name')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Project Name
                {getSortIcon('project_name')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('borehole_number')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Borehole Number
                {getSortIcon('borehole_number')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('client_name')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Client Name
                {getSortIcon('client_name')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('termination_depth')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Depth (m)
                {getSortIcon('termination_depth')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('commencement_date')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Start Date
                {getSortIcon('commencement_date')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                onClick={() => handleSort('logged_by')}
                className="h-auto p-0 font-semibold hover:bg-transparent"
              >
                Logged By
                {getSortIcon('logged_by')}
              </Button>
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLogs.map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium">{log.project_name}</TableCell>
              <TableCell>
                <Badge variant="outline">{log.borehole_number}</Badge>
              </TableCell>
              <TableCell>{log.client_name}</TableCell>
              <TableCell className="text-right">
                <span className="font-mono">{log.termination_depth}m</span>
              </TableCell>
              <TableCell>
                {format(new Date(log.commencement_date), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell>{log.logged_by}</TableCell>
              <TableCell className="text-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleViewLog(log.id)}
                  className="hover:bg-primary/10 hover:text-primary"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}