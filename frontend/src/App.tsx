import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/authComponents";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            
            {/* Geological Log Routes */}
            <Route path="/create-borelog" element={<CreateGeologicalLogPage />} />
            <Route path="/geological-log/create" element={<CreateGeologicalLogPage />} />
            <Route path="/borelogs" element={<BorelogListPage />} />
            <Route path="/geological-log/list" element={<BorelogListPage />} />
            <Route path="/borelog/:id" element={<BorelogDetailPage />} />
            <Route path="/geological-log/:id" element={<BorelogDetailPage />} />
            <Route path="/projects/:projectId/borelogs" element={<BorelogListPage />} />
            
            {/* Other Routes */}
            <Route path="/borelog/manage" element={<ManageBorelogs />} />
            <Route path="/lab-tests/create" element={<CreateLabTest />} />
            <Route path="/lab-tests/list" element={<LabTestsList />} />
            <Route path="/reviewer/dashboard" element={<ReviewerDashboard />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
