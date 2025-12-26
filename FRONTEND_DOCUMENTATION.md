# Frontend Documentation - Borelog Management System

## Overview

The frontend is a modern React application built with TypeScript, Vite, and Tailwind CSS. It provides a comprehensive user interface for geological logging, lab report management, and workflow operations with role-based access control.

## Architecture

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with shadcn/ui
- **Maps**: Leaflet for coordinate selection
- **Charts**: Recharts for data visualization
- **PDF Generation**: jsPDF for report generation

## Project Structure

```
frontend/
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── BorelogEntryForm/    # Borelog entry form components
│   │   ├── lab-tests/           # Lab test related components
│   │   └── [other components]   # Feature-specific components
│   ├── pages/                   # Page components (routes)
│   ├── lib/                     # Utility libraries and configurations
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── assets/                  # Static assets
├── public/                      # Public static files
├── package.json                 # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## Key Files and Their Purposes

### Configuration Files

#### `vite.config.ts`
- **Purpose**: Vite build tool configuration
- **Key Features**:
  - React plugin with SWC for fast compilation
  - Path aliases (@ for src directory)
  - Development server configuration
  - Component tagging for development

#### `package.json`
- **Purpose**: Project dependencies and scripts
- **Key Dependencies**:
  - `@tanstack/react-query`: Server state management
  - `@radix-ui/*`: UI component primitives
  - `react-router-dom`: Client-side routing
  - `react-hook-form`: Form management
  - `zod`: Schema validation
  - `tailwindcss`: Utility-first CSS framework
  - `leaflet`: Interactive maps
  - `recharts`: Data visualization
  - `jspdf`: PDF generation

#### `tailwind.config.ts`
- **Purpose**: Tailwind CSS configuration
- **Features**: Custom theme, component styling, responsive design

### Core Application Files

#### `src/main.tsx`
- **Purpose**: Application entry point
- **Features**: React root creation and rendering

#### `src/App.tsx`
- **Purpose**: Main application component with routing
- **Key Features**:
  - React Query client setup
  - Authentication provider
  - Route protection with role-based access
  - Navigation structure
  - Toast notifications setup

### Library Files (`src/lib/`)

#### `api.ts`
- **Purpose**: API client configuration and endpoint definitions
- **Key Features**:
  - Axios instance with interceptors
  - Authentication token management
  - Error handling and retry logic
  - Organized API endpoints by feature
  - Type-safe API calls

#### `auth.ts`
- **Purpose**: Authentication context and utilities
- **Key Features**:
  - User authentication state management
  - JWT token handling
  - Permission checking
  - Login/logout functionality
  - Token validation

#### `authComponents.tsx`
- **Purpose**: Authentication-related React components
- **Key Features**:
  - AuthProvider context
  - ProtectedRoute component
  - Role-based access control

#### `types.ts`
- **Purpose**: TypeScript type definitions
- **Key Types**:
  - Geological log interfaces
  - User and authentication types
  - Project and structure types
  - Lab report types
  - Workflow types
  - API response types

#### `utils.ts`
- **Purpose**: Utility functions
- **Features**: Common helper functions, formatting utilities

#### `zodSchemas.ts`
- **Purpose**: Validation schemas
- **Features**: Form validation schemas using Zod

### Page Components (`src/pages/`)

#### Authentication
- **`auth/login.tsx`**: User login page

#### Geological Logs
- **`geological-log/list.tsx`**: List all geological logs
- **`geological-log/create.tsx`**: Create new geological log
- **`geological-log/[id].tsx`**: View/edit geological log details

#### Borelog Management
- **`borelog/[id].tsx`**: Borelog summary view
- **`borelog/manage.tsx`**: Borelog management dashboard
- **`borelog/entry.tsx`**: Borelog entry form

#### Project Management
- **`projects/list.tsx`**: List all projects
- **`projects/create.tsx`**: Create new project
- **`structures/list.tsx`**: List project structures
- **`structures/create.tsx`**: Create new structure
- **`substructures/list.tsx`**: List substructures
- **`substructures/create.tsx`**: Create new substructure

#### Lab Reports
- **`lab-reports/index.tsx`**: Lab report management dashboard
- **`lab-reports/create.tsx`**: Create lab report
- **`lab-reports/create-request.tsx`**: Create lab request
- **`lab-reports/rock-test.tsx`**: Rock test form
- **`lab-reports/soil-test.tsx`**: Soil test form
- **`lab-reports/unified.tsx`**: Unified lab report form
- **`lab-reports/pending-reports.tsx`**: Pending reports view
- **`lab-reports/view-report.tsx`**: View lab report

#### Workflow
- **`workflow/dashboard.tsx`**: Workflow management dashboard
- **`reviewer/dashboard.tsx`**: Reviewer dashboard

#### User Management
- **`users/list.tsx`**: User management
- **`assignments/create.tsx`**: Project assignments
- **`borelog-assignments/index.tsx`**: Borelog assignments

### Component Library (`src/components/`)

#### UI Components (`src/components/ui/`)
- **Purpose**: Reusable UI components based on shadcn/ui
- **Components**: Button, Input, Dialog, Table, Form, etc.
- **Features**: Consistent styling, accessibility, TypeScript support

#### Feature Components

#### `BorelogEntryForm/`
- **Purpose**: Comprehensive borelog entry form
- **Key Components**:
  - `index.tsx`: Main form component
  - `components/StratumTable.tsx`: Stratum data table
  - `components/ColorLegend.tsx`: Color coding legend
  - `components/ProjectInfoSection.tsx`: Project information
  - `components/FormActions.tsx`: Form action buttons
  - `components/VersionHistory.tsx`: Version history display

#### `BorelogCSVUpload.tsx`
- **Purpose**: CSV upload for borelog data
- **Features**: File validation, progress tracking, error handling

#### `UnifiedLabReportForm.tsx`
- **Purpose**: Unified lab report creation form
- **Features**: Dynamic form fields, validation, file uploads

#### `WorkflowDashboard.tsx`
- **Purpose**: Workflow management interface
- **Features**: Status tracking, action buttons, progress indicators

#### `LabReportVersionControl.tsx`
- **Purpose**: Lab report version management
- **Features**: Version history, comparison, approval workflow

#### `CoordinateMapPicker.tsx`
- **Purpose**: Interactive map for coordinate selection
- **Features**: Leaflet integration, GPS coordinates, map markers

#### `PDFExportButton.tsx`
- **Purpose**: PDF generation for reports
- **Features**: jsPDF integration, custom formatting

### Custom Hooks (`src/hooks/`)

#### `use-mobile.tsx`
- **Purpose**: Mobile device detection
- **Features**: Responsive design utilities

#### `use-toast.ts`
- **Purpose**: Toast notification management
- **Features**: Success, error, warning notifications

### Type Definitions (`src/types/`)

#### `jspdf-autotable.d.ts`
- **Purpose**: TypeScript definitions for jsPDF autotable plugin

## Routing Structure

### Public Routes
- `/auth/login` - Login page

### Protected Routes (Role-based)
- `/` - Dashboard (all roles)
- `/borelogs` - Borelog list (all roles)
- `/geological-log/*` - Geological log management
- `/projects/*` - Project management
- `/lab-reports/*` - Lab report management
- `/workflow/*` - Workflow management
- `/users` - User management (Admin only)

### Role-based Access Control

#### Admin
- Full access to all features
- User management
- System configuration

#### Project Manager
- Project and structure management
- Team assignments
- Workflow oversight

#### Site Engineer
- Borelog creation and editing
- Data entry and submission
- Limited project access

#### Lab Engineer
- Lab report creation
- Test result entry
- Report submission

#### Approval Engineer
- Report review and approval
- Workflow management
- Quality control

#### Customer
- Read-only access
- Report viewing
- Status monitoring

## State Management

### Server State (React Query)
- API data caching
- Background refetching
- Optimistic updates
- Error handling
- Loading states

### Local State (React)
- Form state (React Hook Form)
- UI state (useState, useReducer)
- Authentication state (Context)

## Styling and UI

### Design System
- **Base**: Tailwind CSS utility classes
- **Components**: shadcn/ui component library
- **Icons**: Lucide React icons
- **Typography**: Custom font configuration
- **Colors**: Consistent color palette
- **Spacing**: Standardized spacing scale

### Responsive Design
- Mobile-first approach
- Breakpoint-based layouts
- Touch-friendly interfaces
- Adaptive navigation

### Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus management

## Form Management

### React Hook Form Integration
- Form validation with Zod schemas
- Error handling and display
- Field-level validation
- Form state management
- Submission handling

### Validation Schemas
- Input validation
- Type safety
- Error messages
- Custom validation rules

## Data Visualization

### Charts (Recharts)
- Workflow statistics
- Progress tracking
- Data analysis
- Interactive charts

### Maps (Leaflet)
- Coordinate selection
- Location visualization
- Interactive markers
- GPS integration

## File Handling

### CSV Processing
- File upload validation
- Data parsing and validation
- Error reporting
- Progress tracking

### PDF Generation
- Report generation
- Custom formatting
- Multi-page documents
- Table generation

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Environment Configuration

### Required Environment Variables
- `VITE_API_BASE_URL` - Backend API base URL

### Development Setup
- Hot module replacement
- Source maps
- Component tagging
- Error overlay

## Performance Optimizations

### Code Splitting
- Route-based splitting
- Component lazy loading
- Dynamic imports

### Caching
- React Query caching
- Browser caching
- Asset optimization

### Bundle Optimization
- Tree shaking
- Dead code elimination
- Asset compression

## Testing Strategy

### Component Testing
- Unit tests for components
- Integration tests for features
- Accessibility testing

### E2E Testing
- User workflow testing
- Cross-browser testing
- Performance testing

## Deployment

### Build Process
- TypeScript compilation
- Asset optimization
- Bundle generation
- Static file serving

### Production Considerations
- Environment variables
- API endpoint configuration
- Error monitoring
- Performance monitoring

## Security Features

### Authentication
- JWT token management
- Secure token storage
- Automatic token refresh
- Session management

### Authorization
- Role-based access control
- Route protection
- Component-level permissions
- API request authorization

### Data Protection
- Input sanitization
- XSS prevention
- CSRF protection
- Secure file uploads

## Error Handling

### Global Error Handling
- Error boundaries
- Global error reporting
- User-friendly error messages
- Fallback UI components

### API Error Handling
- Network error handling
- Validation error display
- Retry mechanisms
- Offline support

## Accessibility Features

### WCAG Compliance
- Semantic HTML
- ARIA attributes
- Keyboard navigation
- Screen reader support

### User Experience
- Loading states
- Error states
- Success feedback
- Progress indicators

This frontend provides a comprehensive, user-friendly interface for geological logging and lab report management with robust role-based access control, modern UI components, and excellent user experience.


