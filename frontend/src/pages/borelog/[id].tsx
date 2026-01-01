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
import { MapPin, Calendar, Ruler, Droplets, FileText, Layers, TestTube, ChevronDown, ChevronRight } from 'lucide-react';
import { WorkflowActions } from '@/components/WorkflowActions';

export default function BoreholeSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [borelogData, setBorelogData] = useState<any>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [latestVersion, setLatestVersion] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStrata, setExpandedStrata] = useState<Set<number>>(new Set());

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

      {/* Workflow Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Workflow Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowActions
            borelogId={id!}
            projectName={borelogData.project?.name || ''}
            boreholeNumber={latestVersion?.details?.number || latestVersion?.number || ''}
            currentStatus={latestVersion?.status || 'draft'}
            versionNumber={latestVersion?.version_no || 1}
            onActionComplete={() => {
              // Reload the page data when workflow action is completed
              window.location.reload();
            }}
          />
        </CardContent>
      </Card>

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
                {latestVersion?.details?.coordinate ? 
                  (() => {
                    const coord = latestVersion.details.coordinate;
                    if (Array.isArray(coord.coordinates)) {
                      return `${coord.coordinates[0]}, ${coord.coordinates[1]}`;
                    }
                    return '—';
                  })() :
                  latestVersion?.coordinate ? 
                    (() => {
                      try {
                        const parsed = typeof latestVersion.coordinate === 'string' 
                          ? JSON.parse(latestVersion.coordinate) 
                          : latestVersion.coordinate;
                        return `${parsed.coordinates[0]}, ${parsed.coordinates[1]}`;
                      } catch {
                        return '—';
                      }
                    })() :
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
          {latestVersion?.details?.strata && Array.isArray(latestVersion.details.strata) && latestVersion.details.strata.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="sticky left-0 bg-background z-20 min-w-[100px]">Depth From (m)</TableHead>
                      <TableHead className="sticky left-[100px] bg-background z-20 min-w-[100px]">Depth To (m)</TableHead>
                      <TableHead className="min-w-[100px]">Thickness (m)</TableHead>
                      <TableHead className="min-w-[80px]">N Value</TableHead>
                      <TableHead className="min-w-[80px]">TCR %</TableHead>
                      <TableHead className="min-w-[80px]">RQD %</TableHead>
                      <TableHead className="min-w-[200px]">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestVersion.details.strata.map((stratum: any, index: number) => {
                      const hasLongDescription = stratum.description && stratum.description.length > 100;
                      const isExpanded = expandedStrata.has(index);
                      
                      const toggleExpanded = () => {
                        setExpandedStrata(prev => {
                          const next = new Set(prev);
                          if (next.has(index)) {
                            next.delete(index);
                          } else {
                            next.add(index);
                          }
                          return next;
                        });
                      };
                      
                      return (
                        <>
                          <TableRow key={index}>
                            <TableCell className="align-top">
                              <div className="flex items-start gap-2">
                                {(hasLongDescription || (stratum.samples && stratum.samples.length > 0)) && (
                                  <button 
                                    onClick={toggleExpanded}
                                    className="flex-shrink-0 hover:text-primary transition-colors"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 mt-0.5" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 mt-0.5" />
                                    )}
                                  </button>
                                )}
                                <div className={hasLongDescription && !isExpanded ? 'line-clamp-2' : ''}>
                                  {stratum.description || '—'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="sticky left-0 bg-background z-10 align-top">
                              {stratum.depth_from !== null && stratum.depth_from !== undefined 
                                ? typeof stratum.depth_from === 'number' 
                                  ? stratum.depth_from.toFixed(2) 
                                  : stratum.depth_from 
                                : '—'}
                            </TableCell>
                            <TableCell className="sticky left-[100px] bg-background z-10 align-top">
                              {stratum.depth_to !== null && stratum.depth_to !== undefined 
                                ? typeof stratum.depth_to === 'number' 
                                  ? stratum.depth_to.toFixed(2) 
                                  : stratum.depth_to 
                                : '—'}
                            </TableCell>
                            <TableCell className="align-top">
                              {stratum.thickness_m !== null && stratum.thickness_m !== undefined 
                                ? typeof stratum.thickness_m === 'number' 
                                  ? stratum.thickness_m.toFixed(2) 
                                  : stratum.thickness_m 
                                : '—'}
                            </TableCell>
                            <TableCell className="align-top">
                              {stratum.n_value !== null && stratum.n_value !== undefined 
                                ? typeof stratum.n_value === 'number' 
                                  ? stratum.n_value.toString() 
                                  : stratum.n_value 
                                : '—'}
                            </TableCell>
                            <TableCell className="align-top">
                              {stratum.tcr_percent !== null && stratum.tcr_percent !== undefined 
                                ? typeof stratum.tcr_percent === 'number' 
                                  ? `${stratum.tcr_percent.toFixed(1)}%` 
                                  : `${stratum.tcr_percent}%` 
                                : '—'}
                            </TableCell>
                            <TableCell className="align-top">
                              {stratum.rqd_percent !== null && stratum.rqd_percent !== undefined 
                                ? typeof stratum.rqd_percent === 'number' 
                                  ? `${stratum.rqd_percent.toFixed(1)}%` 
                                  : `${stratum.rqd_percent}%` 
                                : '—'}
                            </TableCell>
                            <TableCell className="align-top">
                              {stratum.remarks ? (
                                <div className="whitespace-pre-line max-w-[300px]">
                                  {stratum.remarks}
                                </div>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                          {(hasLongDescription || (stratum.samples && stratum.samples.length > 0)) && isExpanded && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/50 p-4">
                                {hasLongDescription && (
                                  <div className="mb-4">
                                    <div className="text-sm font-semibold mb-2">Full Description:</div>
                                    <div className="text-sm whitespace-pre-line">
                                      {stratum.description}
                                    </div>
                                  </div>
                                )}
                                {stratum.samples && stratum.samples.length > 0 && (
                                  <div>
                                    <div className="text-sm font-semibold mb-2">Samples ({stratum.samples.length}):</div>
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="min-w-[80px]">Sample Code</TableHead>
                                            <TableHead className="min-w-[80px]">Type</TableHead>
                                            <TableHead className="min-w-[100px]">Depth (m)</TableHead>
                                            <TableHead>Remarks</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {stratum.samples.map((sample: any, sampleIndex: number) => (
                                            <TableRow key={sampleIndex}>
                                              <TableCell className="font-medium">{sample.sample_code || '—'}</TableCell>
                                              <TableCell>{sample.sample_type || sample.type || '—'}</TableCell>
                                              <TableCell>
                                                {sample.depth_m !== null && sample.depth_m !== undefined
                                                  ? typeof sample.depth_m === 'number'
                                                    ? sample.depth_m.toFixed(2)
                                                    : sample.depth_m
                                                  : '—'}
                                              </TableCell>
                                              <TableCell>{sample.remarks || '—'}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : latestVersion?.details?.stratum_description || latestVersion?.stratum_description ? (
            // Fallback for legacy format (backward compatibility)
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
              </div>
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


