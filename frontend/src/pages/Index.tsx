import { Link } from 'react-router-dom';
import { Building2, FileText, List, Plus, FlaskConical, ClipboardCheck } from 'lucide-react';
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
        <h2 className="text-3xl font-bold text-center mb-12">
          Manage Your Projects
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-3xl mx-auto">
          Streamline your geological surveys, manage borehole logs, and track project
          progress with our comprehensive dashboard
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* View Logs - Available to all roles */}
          <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                View Geological Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                View and manage existing geological survey logs
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/geological-log/list">
                  View Logs
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Create Logs - Admin, Engineer, Logger roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Engineer', 'Logger']}>
            <Card className="shadow-elegant hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Create Geological Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Create a new geological survey log with detailed project information
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/geological-log/create">
                    Create New Log
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </RoleBasedComponent>

          {/* Borelog Management - Admin, Engineer roles */}
          <RoleBasedComponent allowedRoles={['Admin', 'Engineer']}>
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
