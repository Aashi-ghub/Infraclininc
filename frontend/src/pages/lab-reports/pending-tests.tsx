import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { unifiedLabReportsApi } from '@/lib/api';
import { ProtectedRoute } from '@/lib/authComponents';

export default function PendingLabTestsPage() {
  const { toast } = useToast();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await unifiedLabReportsApi.getAll({ status: 'submitted' });
      if (resp.data?.success) setTests(resp.data.data || []);
    } catch (e) {
      toast({ title: 'Failed to load', description: 'Could not fetch pending lab tests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (reportId: string) => {
    await unifiedLabReportsApi.update(reportId, { status: 'approved' });
    toast({ title: 'Approved' });
    load();
  };
  const reject = async (reportId: string) => {
    const reason = prompt('Reason for rejection?') || undefined;
    await unifiedLabReportsApi.update(reportId, { status: 'rejected', rejection_reason: reason });
    toast({ title: 'Rejected' });
    load();
  };

  return (
    <ProtectedRoute allowedRoles={['Admin','Project Manager','Lab Admin']}>
      <div className="container mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Pending Lab Tests</h1>
        {loading ? (
          <div>Loading...</div>
        ) : tests.length === 0 ? (
          <Card><CardContent className="p-6">No pending lab tests.</CardContent></Card>
        ) : (
          tests.map((t: any) => (
            <Card key={t.report_id}>
              <CardHeader>
                <CardTitle>{t.sample_id} — {Array.isArray(t.test_types) ? t.test_types.join(', ') : t.test_types}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Borelog: {t.borelog_id}</div>
                <div>Test Date: {new Date(t.test_date).toLocaleString()}</div>
                <div>Remarks: {t.remarks || '-'}</div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => approve(t.report_id)}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => reject(t.report_id)}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ProtectedRoute>
  );
}


