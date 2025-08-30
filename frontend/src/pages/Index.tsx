import { Link } from 'react-router-dom';
import { Building2, FileText, List, Plus, FlaskConical, ClipboardCheck, Users, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import heroImage from '@/assets/hero-geological.jpg';
import { useAuth } from '@/lib/auth';
import { RoleBasedComponent, UserRoleBadge } from '@/components/RoleBasedComponent';

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Hero Section */}
      <div className="relative h-96 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary-glow/60" />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center text-white">
            <h1 className="text-5xl font-bold mb-4">
              Infrastructure Testing Dashboard
            </h1>
            <p className="text-xl opacity-90 mb-4">
              Professional geological and infrastructure testing management system
            </p>
            {user && (
              <div className="flex justify-center items-center gap-2">
                <span className="text-sm opacity-80">Logged in as {user.name}</span>
                <UserRoleBadge />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Lab Reports - Lab Engineer and Admin */}
          <RoleBasedComponent allowedRoles={['Admin', 'Lab Engineer']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-primary" />
                  Lab Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Manage laboratory test reports and assignments
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/lab-reports">
                    View Lab Reports
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Projects - Admin, Project Manager, Site Engineer, Approval Engineer roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Manage infrastructure projects and assignments
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/projects/list">
                    View Projects
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Geological Logs - Admin, Project Manager, Site Engineer, Approval Engineer roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Geological Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  View and manage geological log entries
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/geological-log/list">
                    View Logs
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Borelog Management - Admin, Project Manager, Site Engineer roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Borelog Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Manage borelog details and project assignments
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/borelog/manage">
                    Manage Borelogs
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>
          
          {/* Contacts Management - Admin, Project Manager roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Contacts Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Manage project contacts and team members
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/contacts">
                    Manage Contacts
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Workflow Dashboard - Admin, Project Manager, Site Engineer, Approval Engineer roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Workflow Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Monitor project workflow and approvals
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/workflow/dashboard">
                    Open Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Lab Tests - Admin only */}
          <RoleBasedComponent allowedRoles={['Admin']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Lab Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Manage laboratory test results and reports
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/lab-tests/list">
                    View Lab Tests
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Reviewer Dashboard - Admin only */}
          <RoleBasedComponent allowedRoles={['Admin']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Reviewer Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Review and approve geological log anomalies
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/reviewer/dashboard">
                    Open Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>
        </div>
      </div>
    </div>
  );
};

export default Index;
