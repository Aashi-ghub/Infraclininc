# Backend Documentation - Borelog Management System

## Overview

The backend is a serverless AWS Lambda-based API built with TypeScript, Node.js, and PostgreSQL. It provides comprehensive geological logging, lab report management, and workflow functionality for infrastructure projects.

## Architecture

- **Framework**: Serverless Framework with AWS Lambda
- **Runtime**: Node.js 18.x
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT-based authentication
- **Deployment**: AWS Lambda with API Gateway
- **Environment**: Development (offline) and Production (AWS)

## Project Structure

```
backend/
├── src/                          # Source code
│   ├── db/                       # Database configuration
│   ├── handlers/                 # Lambda function handlers
│   ├── models/                   # Data models and interfaces
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
├── migrations/                   # Database migration scripts
├── scripts/                      # Database setup and utility scripts
├── tests/                        # Test files
├── serverless.ts                 # Serverless configuration
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript configuration
```

## Key Files and Their Purposes

### Configuration Files

#### `serverless.ts`
- **Purpose**: Main serverless framework configuration
- **Key Features**:
  - Defines all Lambda functions and their HTTP endpoints
  - Configures AWS provider settings (region, runtime, timeout)
  - Sets up environment variables and IAM permissions
  - Defines CORS settings for all endpoints
  - Configures esbuild for TypeScript compilation

#### `package.json`
- **Purpose**: Project dependencies and scripts
- **Key Dependencies**:
  - `@aws-sdk/client-secrets-manager`: AWS secrets management
  - `bcryptjs`: Password hashing
  - `csv-parse`: CSV file parsing
  - `exceljs`: Excel file processing
  - `jsonwebtoken`: JWT authentication
  - `pg`: PostgreSQL client
  - `winston`: Logging
  - `zod`: Input validation

### Database Layer

#### `src/db/index.ts`
- **Purpose**: Database connection management
- **Key Features**:
  - PostgreSQL connection pooling
  - Connection retry logic for serverless cold starts
  - Health check functionality
  - Graceful shutdown handling
  - Query execution with error handling and retries

### Handlers (Lambda Functions)

The handlers are organized by functionality:

#### Authentication (`src/handlers/auth.ts`)
- **`login`**: User authentication with JWT token generation
- **`register`**: User registration (if needed)
- **`me`**: Get current user information

#### Geological Log Management
- **`createGeologicalLog.ts`**: Create new geological logs
- **`getGeologicalLogById.ts`**: Retrieve geological log by ID
- **`updateGeologicalLog.ts`**: Update existing geological logs
- **`deleteGeologicalLog.ts`**: Delete geological logs
- **`listGeologicalLogs.ts`**: List all geological logs with filtering

#### Borelog Management
- **`createBorelog.ts`**: Create new borelog entries
- **`createBorelogDetails.ts`**: Create detailed borelog information
- **`createBorelogVersion.ts`**: Create versioned borelog entries
- **`getBorelogBasicInfo.ts`**: Get basic borelog information
- **`getBorelogDetailsByBorelogId.ts`**: Get detailed borelog data
- **`getBorelogBySubstructureId.ts`**: Get borelogs by substructure
- **`deleteBorelog.ts`**: Delete borelog entries

#### Project Management
- **`projects.ts`**: Project CRUD operations
- **`listStructures.ts`**: List project structures
- **`createStructure.ts`**: Create new structures
- **`listSubstructures.ts`**: List substructures
- **`createSubstructure.ts`**: Create new substructures

#### Lab Report Management
- **`unifiedLabReports.ts`**: Unified lab report CRUD operations
- **`labReportVersionControl.ts`**: Version control for lab reports
- **`labRequests.ts`**: Lab test request management
- **`labTests.ts`**: Lab test management
- **`soilTestSamples.ts`**: Soil test sample management
- **`rockTestSamples.ts`**: Rock test sample management

#### Workflow Management
- **`workflowActions.ts`**: Workflow actions (submit, review, approve)
- **`workflowDashboard.ts`**: Workflow dashboard data

#### File Upload and Processing
- **`uploadBorelogCSV.ts`**: CSV upload for borelog data
- **`uploadBoreholeCsv.ts`**: CSV upload for borehole data
- **`uploadUnifiedLabReportCSV.ts`**: CSV upload for lab reports

#### User and Assignment Management
- **`users.ts`**: User management
- **`assignUsers.ts`**: User assignment to projects
- **`borelogAssignments.ts`**: Borelog assignment management

#### Utility Handlers
- **`getBorelogFormData.ts`**: Get form data for borelog creation
- **`saveStratumData.ts`**: Save stratum data
- **`getStratumData.ts`**: Retrieve stratum data
- **`approveBorelog.ts`**: Approve borelog entries

### Models (`src/models/`)

#### `geologicalLog.ts`
- **Purpose**: Geological log data model
- **Key Fields**: Project info, borehole details, coordinates, dates, personnel

#### `borelogDetails.ts`
- **Purpose**: Detailed borelog information
- **Key Fields**: Stratum data, depth information, descriptions

#### `projects.ts`
- **Purpose**: Project data model
- **Key Fields**: Project metadata, assignments, timestamps

#### `structures.ts`
- **Purpose**: Structure data model
- **Key Fields**: Structure type, project association, descriptions

#### `borelogAssignments.ts`
- **Purpose**: Borelog assignment model
- **Key Fields**: Engineer assignments, status, completion dates

### Utilities (`src/utils/`)

#### `logger.ts`
- **Purpose**: Centralized logging with Winston
- **Features**: Structured logging, different log levels, error tracking

#### `secrets.ts`
- **Purpose**: AWS Secrets Manager integration
- **Features**: Secure credential retrieval, caching

#### `validateInput.ts`
- **Purpose**: Input validation utilities
- **Features**: Zod schema validation, error handling

#### `boreholeCsvParser.ts`
- **Purpose**: CSV parsing for borehole data
- **Features**: Data validation, transformation, error handling

#### `stratumConverter.ts` & `stratumSaver.ts`
- **Purpose**: Stratum data processing
- **Features**: Data conversion, database operations

### Database Migrations (`migrations/`)

The migrations folder contains SQL scripts for database schema evolution:

#### Key Migration Files:
- **`create_stratum_tables.sql`**: Creates stratum-related tables
- **`create_borelog_versions_table.sql`**: Version control for borelogs
- **`create_unified_lab_reports_table.sql`**: Unified lab report tables
- **`create_lab_report_version_control.sql`**: Lab report versioning
- **`add_version_no_to_borelog_details.sql`**: Version numbering
- **`fix_assignment_id_null_constraint.sql`**: Constraint fixes

### Scripts (`scripts/`)

#### Database Setup Scripts:
- **`seed-admin-users.ts`**: Create admin users
- **`seed-organisations.ts`**: Seed organization data
- **`check-db.ts`**: Database connection testing
- **`setup-unified-lab-reports.ts`**: Lab report setup

#### Utility Scripts:
- **`generate-sql.ts`**: SQL generation utilities
- **`fix-passwords.ts`**: Password management
- **`test-password.ts`**: Password testing

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

### Geological Logs
- `POST /geological-log` - Create geological log
- `GET /geological-log/{id}` - Get geological log by ID
- `PUT /geological-log/{id}` - Update geological log
- `DELETE /geological-log/{id}` - Delete geological log
- `GET /geological-log` - List geological logs

### Borelogs
- `POST /borelog` - Create borelog
- `POST /borelog-details` - Create borelog details
- `POST /borelog/version` - Create borelog version
- `GET /borelog-details/{borelog_id}` - Get borelog details
- `GET /borelog/substructure/{substructure_id}` - Get by substructure
- `DELETE /borelog/{borelog_id}` - Delete borelog

### Projects & Structures
- `GET /projects` - List projects
- `POST /projects` - Create project
- `GET /structures` - List structures
- `POST /structures` - Create structure
- `GET /substructures` - List substructures
- `POST /substructures` - Create substructure

### Lab Reports
- `POST /unified-lab-reports` - Create unified lab report
- `GET /unified-lab-reports/{reportId}` - Get lab report
- `PUT /unified-lab-reports/{reportId}` - Update lab report
- `POST /unified-lab-reports/{reportId}/approve` - Approve report
- `POST /unified-lab-reports/{reportId}/reject` - Reject report

### Workflow
- `POST /workflow/{borelog_id}/submit` - Submit for review
- `POST /workflow/{borelog_id}/review` - Review borelog
- `GET /workflow/{borelog_id}/status` - Get workflow status
- `GET /workflow/pending-reviews` - Get pending reviews

### File Uploads
- `POST /borelog/upload-csv` - Upload borelog CSV
- `POST /unified-lab-reports/upload-csv` - Upload lab report CSV

## Environment Variables

### Required Environment Variables:
- `PGHOST` - PostgreSQL host
- `PGPORT` - PostgreSQL port (default: 5432)
- `PGDATABASE` - Database name
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret
- `SECRETS_NAME` - AWS Secrets Manager secret name

### Development Setup:
- `IS_OFFLINE=true` - Enable offline development
- `AWS_REGION=us-east-1` - AWS region for development

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to AWS
npm run deploy

# Run tests
npm test

# Run unit tests
npm run test:unit
```

## Database Schema

### Core Tables:
- **`geological_logs`** - Main geological log entries
- **`borelog_details`** - Detailed borelog information with versioning
- **`borelog_versions`** - Version control for borelogs
- **`projects`** - Project information
- **`structures`** - Project structures
- **`substructures`** - Structure substructures
- **`users`** - User accounts and roles
- **`borelog_assignments`** - Borelog assignments to engineers

### Lab Report Tables:
- **`unified_lab_reports`** - Unified lab reports
- **`lab_report_versions`** - Lab report versioning
- **`soil_test_samples`** - Soil test data
- **`rock_test_samples`** - Rock test data
- **`lab_assignments`** - Lab test assignments

### Workflow Tables:
- **`workflow_status`** - Workflow status tracking
- **`pending_csv_uploads`** - CSV upload approval workflow

## Security Features

- JWT-based authentication
- Role-based access control (Admin, Project Manager, Site Engineer, etc.)
- Input validation with Zod schemas
- SQL injection prevention with parameterized queries
- AWS Secrets Manager for credential management
- CORS configuration for frontend integration

## Error Handling

- Centralized error logging with Winston
- Structured error responses
- Database connection retry logic
- Graceful degradation for serverless cold starts
- Input validation with detailed error messages

## Performance Optimizations

- Connection pooling for database connections
- Lambda function timeout and memory optimization
- Efficient query patterns
- Caching for frequently accessed data
- Batch operations for bulk data processing

## Monitoring and Logging

- Winston logger with structured logging
- Error tracking and monitoring
- Performance metrics
- Database query logging
- Request/response logging

This backend provides a robust, scalable foundation for geological logging and lab report management with comprehensive workflow support and role-based access control.


