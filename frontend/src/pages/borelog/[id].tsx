import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { borelogApiV2, borelogImagesApi, labTestApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/Loader';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calendar, Ruler, Droplets, FileText, Layers, TestTube } from 'lucide-react';

export default function BoreholeSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [borelogData, setBorelogData] = useState<any>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [latestVersion, setLatestVersion] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    
    // Fetch comprehensive borelog data using the borelog details endpoint
    borelogApiV2.getDetailsByBorelogId(id)
      .then(response => {
        console.log('Borelog data response:', response);
        const data = response.data.data;
        setBorelogData(data);
        setVersionHistory(data.version_history || []);
        
        // Extract the latest version from version history
        if (data.version_history && data.version_history.length > 0) {
          setLatestVersion(data.version_history[0]);
        }
        
        // Fetch optional data in parallel
        Promise.allSettled([
          borelogImagesApi.getByBorelogId(id).then(r => r.data.data || []),
          labTestApi.getByBorelog(id).then(r => r.data.data || [])
        ]).then(([imagesResult, labTestsResult]) => {
          setImages(imagesResult.status === 'fulfilled' ? imagesResult.value : []);
          setLabTests(labTestsResult.status === 'fulfilled' ? labTestsResult.value : []);
        });
      })
      .catch((error) => {
        console.error('Failed to load borelog data:', error);
        toast({ 
          title: 'Error', 
          description: 'Failed to load borelog data. Please try again.', 
          variant: 'destructive' 
        });
      })
      .finally(() => setIsLoading(false));
  }, [id, toast]);



  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (!borelogData || !latestVersion) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Borelog Not Found</h1>
        <p className="text-muted-foreground mb-4">No details available for this borelog.</p>
        <Button asChild>
          <Link to="/borelog/manage">Back to Manage</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Borehole: {latestVersion?.details?.number || latestVersion?.number || '—'}</h1>
          <div className="text-muted-foreground text-sm mt-1">
            <span>{borelogData.project?.name || '—'} → {borelogData.structure?.structure_type || '—'} → {borelogData.structure?.substructure_type || '—'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
                            <Link to={`/borelog-details/${id}`}>Add Geological Entry</Link>
          </Button>
          <Button asChild>
            <Link to={`/borelog/entry?borelog_id=${id}`}>Edit Borelog</Link>
          </Button>
        </div>
      </div>

      {/* Project Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Project Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Project Name</div>
              <div className="font-medium">{borelogData.project?.name || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Job Code</div>
              <div className="font-medium">{latestVersion?.details?.job_code || latestVersion?.job_code || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Structure Type</div>
              <div className="font-medium">{borelogData.structure?.structure_type || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Substructure Type</div>
              <div className="font-medium">{borelogData.structure?.substructure_type || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Borehole Number</div>
              <div className="font-medium">{latestVersion?.details?.number || latestVersion?.number || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Version</div>
              <div className="font-medium">
                <Badge variant="outline">v{latestVersion.version_no || '1'}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location & Coordinates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Coordinates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Location</div>
              <div className="font-medium">{latestVersion?.details?.location || latestVersion?.location || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Chainage (km)</div>
              <div className="font-medium">{latestVersion?.details?.chainage_km || latestVersion?.chainage_km || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">MSL</div>
              <div className="font-medium">{latestVersion?.details?.msl || latestVersion?.msl || '—'} m</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Coordinates</div>
              <div className="font-medium">
                {latestVersion.coordinate ? 
                  `${JSON.parse(latestVersion.coordinate).coordinates[0]}, ${JSON.parse(latestVersion.coordinate).coordinates[1]}` : 
                  '—'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boring Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Boring Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Method of Boring</div>
              <div className="font-medium">{latestVersion?.details?.boring_method || latestVersion?.boring_method || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Hole Diameter</div>
              <div className="font-medium">{latestVersion?.details?.hole_diameter || latestVersion?.hole_diameter || '—'} mm</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Termination Depth</div>
              <div className="font-medium">{latestVersion?.details?.termination_depth || latestVersion?.termination_depth || '—'} m</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Commencement Date</div>
              <div className="font-medium">
                {latestVersion?.details?.commencement_date ? new Date(latestVersion.details.commencement_date).toLocaleDateString() : 
                 latestVersion?.commencement_date ? new Date(latestVersion.commencement_date).toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Completion Date</div>
              <div className="font-medium">
                {latestVersion?.details?.completion_date ? new Date(latestVersion.details.completion_date).toLocaleDateString() : 
                 latestVersion?.completion_date ? new Date(latestVersion.completion_date).toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Standing Water Level</div>
              <div className="font-medium">{latestVersion?.details?.standing_water_level || latestVersion?.standing_water_level || '—'} m</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Counts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Counts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{latestVersion?.details?.permeability_test_count || latestVersion?.permeability_test_count || 0}</div>
              <div className="text-xs text-muted-foreground">Permeability Tests</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{latestVersion?.details?.spt_vs_test_count || latestVersion?.spt_vs_test_count || 0}</div>
              <div className="text-xs text-muted-foreground">SPT/VS Tests</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{latestVersion?.details?.undisturbed_sample_count || latestVersion?.undisturbed_sample_count || 0}</div>
              <div className="text-xs text-muted-foreground">Undisturbed Samples</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{latestVersion?.details?.disturbed_sample_count || latestVersion?.disturbed_sample_count || 0}</div>
              <div className="text-xs text-muted-foreground">Disturbed Samples</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{latestVersion?.details?.water_sample_count || latestVersion?.water_sample_count || 0}</div>
              <div className="text-xs text-muted-foreground">Water Samples</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stratum Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Stratum Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestVersion?.details?.stratum_description || latestVersion?.stratum_description ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground">Description</div>
                  <div className="font-medium">{latestVersion?.details?.stratum_description || latestVersion?.stratum_description}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Depth Range</div>
                  <div className="font-medium">
                    {latestVersion?.details?.stratum_depth_from || latestVersion?.stratum_depth_from || '—'} - {latestVersion?.details?.stratum_depth_to || latestVersion?.stratum_depth_to || '—'} m
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Thickness</div>
                  <div className="font-medium">{latestVersion?.details?.stratum_thickness_m || latestVersion?.stratum_thickness_m || '—'} m</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">RQD Length</div>
                  <div className="font-medium">{latestVersion?.details?.rqd_length_cm || latestVersion?.rqd_length_cm || '—'} cm</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">RQD Percentage</div>
                  <div className="font-medium">{latestVersion?.details?.rqd_percent || latestVersion?.rqd_percent || '—'}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">TCR Percentage</div>
                  <div className="font-medium">{latestVersion?.details?.tcr_percent || latestVersion?.tcr_percent || '—'}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Return Water Color</div>
                  <div className="font-medium">{latestVersion?.details?.return_water_colour || latestVersion?.return_water_colour || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Water Loss</div>
                  <div className="font-medium">{latestVersion?.details?.water_loss || latestVersion?.water_loss || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Borehole Diameter</div>
                  <div className="font-medium">{latestVersion?.details?.borehole_diameter || latestVersion?.borehole_diameter || '—'}</div>
                </div>
              </div>
              {(latestVersion?.details?.remarks || latestVersion?.remarks) && (
                <div>
                  <div className="text-sm text-muted-foreground">Remarks</div>
                  <div className="font-medium whitespace-pre-line">{latestVersion?.details?.remarks || latestVersion?.remarks}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-2">No stratum data available</div>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/borelog-details/${id}`}>Add Stratum Data</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          {!versionHistory.length ? (
            <div className="text-sm text-muted-foreground">No version history available.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versionHistory.map((version) => (
                    <TableRow key={`${version.borelog_id}-${version.version_no}`}>
                      <TableCell>v{version.version_no}</TableCell>
                      <TableCell>{version.created_by?.name || '—'}</TableCell>
                      <TableCell>
                        {version.created_at ? new Date(version.created_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={version.status === 'approved' ? 'default' : 'outline'}>
                          {version.status || 'draft'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/geological-log/${version.borelog_id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lab Tests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lab Tests</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/lab-tests/create?borelog_id=${id}`}>Create New</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!labTests.length ? (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground mb-2">No lab tests found for this borelog.</div>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/lab-tests/create?borelog_id=${id}`}>Create First Lab Test</Link>
              </Button>
            </div>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {labTests.map((t) => (
                <li key={t.id}>{t.test_type} — {t.status || '—'}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


