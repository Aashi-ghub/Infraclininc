import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "./lib/authComponents";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/login";
import CreateGeologicalLogPage from "./pages/geological-log/create";
import BorelogListPage from "./pages/geological-log/list";
import BorelogDetailPage from "./pages/geological-log/[id]";
import ManageBorelogs from "./pages/borelog/manage";
import CreateLabTest from "./pages/lab-tests/create";
import LabTestsList from "./pages/lab-tests/list";
import ReviewerDashboard from "./pages/reviewer/dashboard";
import CreateBorelogDetailPage from "./pages/borelog-details/create";
import { RoleSelector } from "./components/RoleSelector";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            
            {/* Protected Routes - View Access */}
            <Route path="/borelogs" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger', 'Viewer']}>
                <BorelogListPage />
              </ProtectedRoute>
            } />
            <Route path="/geological-log/list" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger', 'Viewer']}>
                <BorelogListPage />
              </ProtectedRoute>
            } />
            <Route path="/borelog/:id" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger', 'Viewer']}>
                <BorelogDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/geological-log/:id" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger', 'Viewer']}>
                <BorelogDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/projects/:projectId/borelogs" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger', 'Viewer']}>
                <BorelogListPage />
              </ProtectedRoute>
            } />
            
            {/* Protected Routes - Create Access */}
            <Route path="/create-borelog" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger']}>
                <CreateGeologicalLogPage />
              </ProtectedRoute>
            } />
            <Route path="/geological-log/create" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer', 'Logger']}>
                <CreateGeologicalLogPage />
              </ProtectedRoute>
            } />
            
            {/* Protected Routes - Admin/Engineer Access */}
            <Route path="/borelog-details/create" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer']}>
                <CreateBorelogDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/borelog/manage" element={
              <ProtectedRoute allowedRoles={['Admin', 'Engineer']}>
                <ManageBorelogs />
              </ProtectedRoute>
            } />
            
            {/* Protected Routes - Admin Only */}
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
            <Route path="/reviewer/dashboard" element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <ReviewerDashboard />
              </ProtectedRoute>
            } />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          
          {/* Role selector for development/testing */}
          <RoleSelector />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
