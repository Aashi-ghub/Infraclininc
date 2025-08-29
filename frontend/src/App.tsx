import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "./lib/authComponents";
import { Navbar } from "./components/ui/navbar";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/login";
import CreateGeologicalLogPage from "./pages/geological-log/create";
import BorelogListPage from "./pages/geological-log/list";
import BorelogDetailPage from "./pages/geological-log/[id]";
import BoreholeSummaryPage from "./pages/borelog/[id]";
import ManageBorelogs from "./pages/borelog/manage";
import CreateLabTest from "./pages/lab-tests/create";
import LabTestsList from "./pages/lab-tests/list";
import LabTestDetailPage from "./pages/lab-tests/[id]";
import LabReportManagement from "./pages/lab-reports/index";
import CreateLabReport from "./pages/lab-reports/create";
import CreateLabRequest from "./pages/lab-reports/create-request";
import RockLabTestPage from "./pages/lab-reports/rock-test";
import SoilLabTestPage from "./pages/lab-reports/soil-test";
import UnifiedLabReportPage from "./pages/lab-reports/unified";
import PendingReportsPage from "./pages/lab-reports/pending-reports";
import ViewReportPage from "./pages/lab-reports/view-report";
import ReviewerDashboard from "./pages/reviewer/dashboard";
import CreateBorelogDetailPage from "./pages/borelog-details/create";
import ContactsListPage from "./pages/contacts/list";
import CreateContactPage from "./pages/contacts/create";
import ProjectListPage from "./pages/projects/list";
import CreateProjectPage from "./pages/projects/create";
import StructureListPage from "./pages/structures/list";
import CreateStructurePage from "./pages/structures/create";
import SubstructureListPage from "./pages/substructures/list";
import CreateSubstructurePage from "./pages/substructures/create";
import BorelogManagePage from "./pages/borelog/manage";
import BorelogEntryPage from "./pages/borelog/entry";
import WorkflowDashboard from "./pages/workflow/dashboard";
import ProjectAssignmentPage from "./pages/assignments/create";
import UserManagementPage from "./pages/users/list";
import BorelogAssignmentsPage from "./pages/borelog-assignments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login route with no navbar */}
            <Route path="/auth/login" element={<Login />} />
            
            {/* All other routes with navbar */}
            <Route path="/*" element={
              <>
                <Navbar />
                <div className="pt-4">
                  <Routes>
                    <Route path="/" element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    } />
                    
                    {/* Protected Routes - View Access */}
                    <Route path="/borelogs" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <BorelogListPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/geological-log/list" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <BorelogListPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/borelog/:id" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <BoreholeSummaryPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/geological-log/:id" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <BorelogDetailPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/:projectId/borelogs" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <BorelogListPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* Protected Routes - Create Access */}
                    <Route path="/create-borelog" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
                        <CreateGeologicalLogPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/geological-log/create" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
                        <CreateGeologicalLogPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* Protected Routes - Admin/Engineer Access */}
                    <Route path="/borelog-details/create" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
                        <CreateBorelogDetailPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/borelog-details/:id" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
                        <CreateBorelogDetailPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/borelog/manage" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <BorelogManagePage />
                      </ProtectedRoute>
                    } />
                    <Route path="/borelog/entry" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
                        <BorelogEntryPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/borelog/edit/:id" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer']}>
                        <CreateBorelogDetailPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/borelog-assignments" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <BorelogAssignmentsPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* Project Management Routes */}
                    <Route path="/projects" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <ProjectListPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/create" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <CreateProjectPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/:projectId/structures" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <StructureListPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/:projectId/structures/create" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <CreateStructurePage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/:projectId/structures/:structureId/substructures" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer', 'Customer']}>
                        <SubstructureListPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/:projectId/structures/:structureId/substructures/create" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <CreateSubstructurePage />
                      </ProtectedRoute>
                    } />
                    <Route path="/projects/:projectId/structures/:structureId/edit" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <CreateStructurePage mode="edit" />
                      </ProtectedRoute>
                    } />

                    {/* Contact Management Routes */}
                    <Route path="/contacts" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <ContactsListPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/contacts/create" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
                        <CreateContactPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* Lab Test Routes */}
                    <Route path="/lab-tests/create" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <CreateLabTest />
                      </ProtectedRoute>
                    } />
                    <Route path="/lab-tests/list" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <LabTestsList />
                      </ProtectedRoute>
                    } />
                    <Route path="/lab-tests/:id" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer', 'Project Manager']}>
                        <LabTestDetailPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* Lab Report Management Routes */}
                            <Route path="/lab-reports" element={
          <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer', 'Customer']}>
            <LabReportManagement />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/create/:requestId?" element={
          <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
            <CreateLabReport />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/create-request" element={
          <ProtectedRoute allowedRoles={['Admin', 'Project Manager']}>
            <CreateLabRequest />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/rock-test" element={
          <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
            <RockLabTestPage />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/soil-test" element={
          <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
            <SoilLabTestPage />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/unified/:requestId?" element={
          <ProtectedRoute allowedRoles={['Admin', 'Lab Engineer']}>
            <UnifiedLabReportPage />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/pending" element={
          <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer']}>
            <PendingReportsPage />
          </ProtectedRoute>
        } />
        <Route path="/lab-reports/view/:reportId" element={
          <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Lab Engineer', 'Approval Engineer']}>
            <ViewReportPage />
          </ProtectedRoute>
        } />
                    
                    {/* Protected Routes - Admin Only */}
                    <Route path="/reviewer/dashboard" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <ReviewerDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Workflow Dashboard */}
                    <Route path="/workflow/dashboard" element={
                      <ProtectedRoute allowedRoles={['Admin', 'Project Manager', 'Site Engineer', 'Approval Engineer', 'Lab Engineer']}>
                        <WorkflowDashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* User Assignment Routes */}
                    <Route path="/assignments/create" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <ProjectAssignmentPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* User Management Routes */}
                    <Route path="/users" element={
                      <ProtectedRoute allowedRoles={['Admin']}>
                        <UserManagementPage />
                      </ProtectedRoute>
                    } />
                    
                    {/* Catch-all route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
