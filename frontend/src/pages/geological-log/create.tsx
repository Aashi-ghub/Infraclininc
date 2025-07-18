import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateBorelogForm } from '@/components/CreateBorelogForm';
import { ProtectedRoute } from '@/lib/authComponents';

export default function CreateGeologicalLogPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Create New Geological Log</h1>
          <Button asChild variant="outline">
            <Link to="/geological-log/list">Back to List</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enter Geological Log Details</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateBorelogForm />
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}