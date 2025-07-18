import { Link } from 'react-router-dom';
import { Building2, FileText, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import heroImage from '@/assets/hero-geological.jpg';

const Index = () => {
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
            <p className="text-xl opacity-90">
              Professional geological and infrastructure testing management system
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 text-foreground">
            Manage Your Projects
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Streamline your geological surveys, manage borehole logs, and track project progress with our comprehensive dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
              <Button asChild className="w-full">
                <Link to="/geological-log/create">
                  Create New Log
                </Link>
              </Button>
            </CardContent>
          </Card>

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
        </div>
      </div>
    </div>
  );
};

export default Index;
