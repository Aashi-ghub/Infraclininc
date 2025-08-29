import type { AWS } from '@serverless/typescript';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const serverlessConfiguration: AWS = {
  service: 'backendbore',
  frameworkVersion: '3',
  plugins: ['serverless-esbuild', 'serverless-offline'],
  provider: {
    name: 'aws',
    runtime: 'nodejs18.x',
    region: 'us-east-1',
    stage: '${opt:stage, "dev"}',
    // Increase default timeout for all Lambdas (in seconds)
    timeout: 30,
    // Optionally increase memory for heavy handlers
    memorySize: 512,
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NODE_OPTIONS: '--enable-source-maps',
      SECRETS_NAME: process.env.IS_OFFLINE ? 'local-dev-secrets' : '${ssm:/infra/postgres/secrets-name}',
      // Pass database connection variables directly
      PGHOST: process.env.PGHOST || '',
      PGPORT: process.env.PGPORT || '5432',
      PGDATABASE: process.env.PGDATABASE || '',
      PGUSER: process.env.PGUSER || '',
      PGPASSWORD: process.env.PGPASSWORD || '',
      // JWT Secret for authentication
      JWT_SECRET: process.env.JWT_SECRET || '',
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: [
              'secretsmanager:GetSecretValue'
            ],
            Resource: [
              process.env.IS_OFFLINE ? '*' : 'arn:aws:secretsmanager:${aws:region}:${aws:accountId}:secret:infra/postgres/*'
            ]
          }
        ]
      }
    }
  },
  functions: {
    // Auth endpoints
    login: {
      handler: 'src/handlers/auth.login',
      events: [
        {
          http: {
            method: 'post',
            path: '/auth/login',
            cors: true
          }
        }
      ]
    },
    register: {
      handler: 'src/handlers/auth.register',
      events: [
        {
          http: {
            method: 'post',
            path: '/auth/register',
            cors: true
          }
        }
      ]
    },
    me: {
      handler: 'src/handlers/auth.me',
      events: [
        {
          http: {
            method: 'get',
            path: '/auth/me',
            cors: true
          }
        }
      ]
    },
    
    // Geological Log endpoints
    createGeologicalLog: {
      handler: 'src/handlers/createGeologicalLog.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/geological-log',
            cors: true
          }
        }
      ]
    },
    getGeologicalLogById: {
      handler: 'src/handlers/getGeologicalLogById.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/geological-log/{borelog_id}',
            cors: true
          }
        }
      ]
    },
    updateGeologicalLog: {
      handler: 'src/handlers/updateGeologicalLog.handler',
      events: [
        {
          http: {
            method: 'put',
            path: '/geological-log/{borelog_id}',
            cors: true
          }
        }
      ]
    },
    deleteGeologicalLog: {
      handler: 'src/handlers/deleteGeologicalLog.handler',
      events: [
        {
          http: {
            method: 'delete',
            path: '/geological-log/{borelog_id}',
            cors: true
          }
        }
      ]
    },
    updateSubstructureAssignment: {
      handler: 'src/handlers/updateSubstructureAssignment.handler',
      events: [
        {
          http: {
            method: 'put',
            path: '/geological-log/{borelog_id}/substructure',
            cors: true
          }
        }
      ]
    },
    listGeologicalLogs: {
      handler: 'src/handlers/listGeologicalLogs.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/geological-log',
            cors: true
          }
        }
      ]
    },
    getGeologicalLogsByProjectName: {
      handler: 'src/handlers/getGeologicalLogsByProjectName.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/geological-log/project-name/{project_name}',
            cors: true
          }
        }
      ]
    },
    getGeologicalLogsByProjectNameWithSubstructures: {
      handler: 'src/handlers/getGeologicalLogsByProjectNameWithSubstructures.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/geological-log/project-name/{project_name}/with-substructures',
            cors: true
          }
        }
      ]
    },
    
    // Borelog endpoints
    createBorelog: {
      handler: 'src/handlers/createBorelog.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog',
            cors: true
          }
        }
      ]
    },
    
    // Borelog Details endpoints (Updated with new handlers)
    createBorelogDetails: {
      handler: 'src/handlers/createBorelogDetails.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog-details',
            cors: true
          }
        }
      ]
    },
    getBorelogDetailsByBorelogId: {
      handler: 'src/handlers/getBorelogDetailsByBorelogId.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-details/{borelog_id}',
            cors: true
          }
        }
      ]
    },
    getBorelogBasicInfo: {
      handler: 'src/handlers/getBorelogBasicInfo.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog/{borelog_id}',
            cors: true
          }
        }
      ]
    },
    getBorelogBySubstructureId: {
      handler: 'src/handlers/getBorelogBySubstructureId.handler',
      // Explicitly set higher timeout for complex aggregation
      timeout: 30,
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog/substructure/{substructure_id}',
            cors: true
          }
        }
      ]
    },
    createBorelogVersion: {
      handler: 'src/handlers/createBorelogVersion.handler',
      // Explicitly set higher timeout for version writes
      timeout: 30,
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog/version',
            cors: true
          }
        }
      ]
    },
    getBorelogsByProject: {
      handler: 'src/handlers/getBorelogsByProject.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/projects/{project_id}/borelogs',
            cors: true
          }
        }
      ]
    },
    
    // Add alias for backward compatibility
    listBorelogs: {
      handler: 'src/handlers/listGeologicalLogs.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelogs',
            cors: true
          }
        }
      ]
    },
    
    // Lab Tests endpoints
    createLabTest: {
      handler: 'src/handlers/labTests.createLabTest',
      events: [
        {
          http: {
            method: 'post',
            path: '/lab-tests',
            cors: true
          }
        }
      ]
    },
    listLabTests: {
      handler: 'src/handlers/labTests.listLabTests',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-tests',
            cors: true
          }
        }
      ]
    },
    
    // Lab Requests endpoints
    createLabRequest: {
      handler: 'src/handlers/labRequests.createLabRequest',
      events: [
        {
          http: {
            method: 'post',
            path: '/lab-requests',
            cors: true
          }
        }
      ]
    },
    listLabRequests: {
      handler: 'src/handlers/labRequests.listLabRequests',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-requests',
            cors: true
          }
        }
      ]
    },
    getLabRequestById: {
      handler: 'src/handlers/labRequests.getLabRequestById',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-requests/{id}',
            cors: true
          }
        }
      ]
    },
    updateLabRequest: {
      handler: 'src/handlers/labRequests.updateLabRequest',
      events: [
        {
          http: {
            method: 'put',
            path: '/lab-requests/{id}',
            cors: true
          }
        }
      ]
    },
    deleteLabRequest: {
      handler: 'src/handlers/labRequests.deleteLabRequest',
      events: [
        {
          http: {
            method: 'delete',
            path: '/lab-requests/{id}',
            cors: true
          }
        }
      ]
    },
    getFinalBorelogs: {
      handler: 'src/handlers/labRequests.getFinalBorelogs',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-requests/final-borelogs',
            cors: true
          }
        }
      ]
    },

    // Projects endpoints
    listProjects: {
      handler: 'src/handlers/projects.listProjects',
      events: [
        {
          http: {
            method: 'get',
            path: '/projects',
            cors: true
          }
        }
      ]
    },
    getProject: {
      handler: 'src/handlers/projects.getProject',
      events: [
        {
          http: {
            method: 'get',
            path: '/projects/{project_id}',
            cors: true
          }
        }
      ]
    },
    createProject: {
      handler: 'src/handlers/createProject.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/projects',
            cors: true
          }
        }
      ]
    },
    
    // Structures endpoints
    listStructures: {
      handler: 'src/handlers/listStructures.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/structures',
            cors: true
          }
        }
      ]
    },
    createStructure: {
      handler: 'src/handlers/createStructure.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/structures',
            cors: true
          }
        }
      ]
    },
    getStructureById: {
      handler: 'src/handlers/getStructureById.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/structures/{structure_id}',
            cors: true
          }
        }
      ]
    },
    
    // Substructure endpoints
    listSubstructures: {
      handler: 'src/handlers/listSubstructures.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/substructures',
            cors: true
          }
        }
      ]
    },
    createSubstructure: {
      handler: 'src/handlers/createSubstructure.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/substructures',
            cors: true
          }
        }
      ]
    },
    uploadBorelogCSV: {
      handler: 'src/handlers/uploadBorelogCSV.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog/upload-csv',
            cors: true
          }
        }
      ]
    },
    approveBorelog: {
      handler: 'src/handlers/approveBorelog.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog/{borelog_id}/approve',
            cors: true
          }
        }
      ]
    },
    getSubstructureById: {
      handler: 'src/handlers/getSubstructureById.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/substructures/{substructure_id}',
            cors: true
          }
        }
      ]
    },
    
    // User Assignment endpoints
    assignUsers: {
      handler: 'src/handlers/assignUsers.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/assignments',
            cors: true
          }
        }
      ]
    },
    
    // Borelog Assignment endpoints
    createBorelogAssignment: {
      handler: 'src/handlers/borelogAssignments.createAssignment',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog-assignments',
            cors: true
          }
        }
      ]
    },
    updateBorelogAssignment: {
      handler: 'src/handlers/borelogAssignments.updateAssignment',
      events: [
        {
          http: {
            method: 'put',
            path: '/borelog-assignments/{assignmentId}',
            cors: true
          }
        }
      ]
    },
    getBorelogAssignmentsByBorelogId: {
      handler: 'src/handlers/borelogAssignments.getAssignmentsByBorelogId',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-assignments/borelog/{borelogId}',
            cors: true
          }
        }
      ]
    },
    getBorelogAssignmentsByStructureId: {
      handler: 'src/handlers/borelogAssignments.getAssignmentsByStructureId',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-assignments/structure/{structureId}',
            cors: true
          }
        }
      ]
    },
    getBorelogAssignmentsBySiteEngineer: {
      handler: 'src/handlers/borelogAssignments.getAssignmentsBySiteEngineer',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-assignments/site-engineer/{siteEngineerId}',
            cors: true
          }
        }
      ]
    },
    getActiveBorelogAssignments: {
      handler: 'src/handlers/borelogAssignments.getActiveAssignments',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-assignments/active',
            cors: true
          }
        }
      ]
    },
    deleteBorelogAssignment: {
      handler: 'src/handlers/borelogAssignments.deleteAssignment',
      events: [
        {
          http: {
            method: 'delete',
            path: '/borelog-assignments/{assignmentId}',
            cors: true
          }
        }
      ]
    },
    
    // User Management endpoints
    listUsers: {
      handler: 'src/handlers/users.listUsers',
      events: [
        {
          http: {
            method: 'get',
            path: '/users',
            cors: true
          }
        }
      ]
    },
    getUserById: {
      handler: 'src/handlers/users.getUserById',
      events: [
        {
          http: {
            method: 'get',
            path: '/users/{user_id}',
            cors: true
          }
        }
      ]
    },
    getLabEngineers: {
      handler: 'src/handlers/users.getLabEngineers',
      events: [
        {
          http: {
            method: 'get',
            path: '/users/lab-engineers',
            cors: true
          }
        }
      ]
    },
    
    // Anomalies endpoints
    listAnomalies: {
      handler: 'src/handlers/anomalies.listAnomalies',
      events: [
        {
          http: {
            method: 'get',
            path: '/anomalies',
            cors: true
          }
        }
      ]
    },
    createAnomaly: {
      handler: 'src/handlers/anomalies.createAnomaly',
      events: [
        {
          http: {
            method: 'post',
            path: '/anomalies',
            cors: true
          }
        }
      ]
    },
    updateAnomaly: {
      handler: 'src/handlers/anomalies.updateAnomaly',
      events: [
        {
          http: {
            method: 'patch',
            path: '/anomalies/{anomaly_id}',
            cors: true
          }
        }
      ]
    },
    
    // Contacts endpoints
    createContact: {
      handler: 'src/handlers/contacts.createContactHandler',
      events: [
        {
          http: {
            method: 'post',
            path: '/contacts',
            cors: true
          }
        }
      ]
    },
    listContacts: {
      handler: 'src/handlers/contacts.listContactsHandler',
      events: [
        {
          http: {
            method: 'get',
            path: '/contacts',
            cors: true
          }
        }
      ]
    },
    getContactById: {
      handler: 'src/handlers/contacts.getContactByIdHandler',
      events: [
        {
          http: {
            method: 'get',
            path: '/contacts/{contact_id}',
            cors: true
          }
        }
      ]
    },
    getContactsByOrganisation: {
      handler: 'src/handlers/contacts.getContactsByOrganisationHandler',
      events: [
        {
          http: {
            method: 'get',
            path: '/contacts/organisation/{organisation_id}',
            cors: true
          }
        }
      ]
    },
    updateContact: {
      handler: 'src/handlers/contacts.updateContactHandler',
      events: [
        {
          http: {
            method: 'put',
            path: '/contacts/{contact_id}',
            cors: true
          }
        }
      ]
    },
    deleteContact: {
      handler: 'src/handlers/contacts.deleteContactHandler',
      events: [
        {
          http: {
            method: 'delete',
            path: '/contacts/{contact_id}',
            cors: true
          }
        }
      ]
    },

    // Borelog Images endpoints
    uploadBorelogImage: {
      handler: 'src/handlers/borelogImages.uploadImage',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog-images',
            cors: true
          }
        }
      ]
    },
    getBorelogImages: {
      handler: 'src/handlers/borelogImages.getImages',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-images/{borelog_id}',
            cors: true
          }
        }
      ]
    },
    deleteBorelogImage: {
      handler: 'src/handlers/borelogImages.deleteImage',
      events: [
        {
          http: {
            method: 'delete',
            path: '/borelog-images/{image_id}',
            cors: true
          }
        }
      ]
    },

    // Borelog submission endpoints
    submitBorelog: {
      handler: 'src/handlers/borelogSubmission.submitBorelog',
      events: [
        {
          http: {
            method: 'post',
            path: '/borelog/submit',
            cors: true
          }
        }
      ]
    },
    getBorelogSubmissions: {
      handler: 'src/handlers/borelogSubmission.getBorelogSubmissions',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog/submissions/{projectId}/{boreholeId}',
            cors: true
          }
        }
      ]
    },
    getBorelogSubmission: {
      handler: 'src/handlers/borelogSubmission.getBorelogSubmission',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog/submission/{submissionId}',
            cors: true
          }
        }
      ]
    },

    // Borehole endpoints
    listBoreholes: {
      handler: 'src/handlers/boreholes.listBoreholes',
      events: [
        {
          http: {
            method: 'get',
            path: '/boreholes',
            cors: true
          }
        }
      ]
    },
    getBoreholeById: {
      handler: 'src/handlers/boreholes.getBoreholeById',
      events: [
        {
          http: {
            method: 'get',
            path: '/boreholes/{boreholeId}',
            cors: true
          }
        }
      ]
    },
    getBoreholesByProject: {
      handler: 'src/handlers/boreholes.getBoreholesByProject',
      events: [
        {
          http: {
            method: 'get',
            path: '/boreholes/project/{projectId}',
            cors: true
          }
        }
      ]
    },
    getBoreholesByProjectAndStructure: {
      handler: 'src/handlers/boreholes.getBoreholesByProjectAndStructure',
      events: [
        {
          http: {
            method: 'get',
            path: '/boreholes/project/{projectId}/structure/{structureId}',
            cors: true
          }
        }
      ]
    },
    createBorehole: {
      handler: 'src/handlers/boreholes.createBorehole',
      events: [
        {
          http: {
            method: 'post',
            path: '/boreholes',
            cors: true
          }
        }
      ]
    },
    updateBorehole: {
      handler: 'src/handlers/boreholes.updateBorehole',
      events: [
        {
          http: {
            method: 'put',
            path: '/boreholes/{boreholeId}',
            cors: true
          }
        }
      ]
    },
    deleteBorehole: {
      handler: 'src/handlers/boreholes.deleteBorehole',
      events: [
        {
          http: {
            method: 'delete',
            path: '/boreholes/{boreholeId}',
            cors: true
          }
        }
      ]
    },
    getBorelogFormData: {
      handler: 'src/handlers/getBorelogFormData.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/borelog-form-data',
            cors: true
          }
        }
      ]
    },
    saveStratumData: {
      handler: 'src/handlers/saveStratumData.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/stratum-data',
            cors: true
          }
        }
      ]
    },
    getStratumData: {
      handler: 'src/handlers/getStratumData.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/stratum-data',
            cors: true
          }
        }
      ]
    },

    // Workflow endpoints
    submitForReview: {
      handler: 'src/handlers/workflowActions.submitForReview',
      events: [
        {
          http: {
            method: 'post',
            path: '/workflow/{borelog_id}/submit',
            cors: true
          }
        }
      ]
    },
    reviewBorelog: {
      handler: 'src/handlers/workflowActions.reviewBorelog',
      events: [
        {
          http: {
            method: 'post',
            path: '/workflow/{borelog_id}/review',
            cors: true
          }
        }
      ]
    },
    assignLabTests: {
      handler: 'src/handlers/workflowActions.assignLabTests',
      events: [
        {
          http: {
            method: 'post',
            path: '/workflow/lab-assignments',
            cors: true
          }
        }
      ]
    },
    submitLabTestResults: {
      handler: 'src/handlers/workflowActions.submitLabTestResults',
      events: [
        {
          http: {
            method: 'post',
            path: '/workflow/lab-results',
            cors: true
          }
        }
      ]
    },
    getWorkflowStatus: {
      handler: 'src/handlers/workflowActions.getWorkflowStatus',
      events: [
        {
          http: {
            method: 'get',
            path: '/workflow/{borelog_id}/status',
            cors: true
          }
        }
      ]
    },
    getPendingReviews: {
      handler: 'src/handlers/workflowDashboard.getPendingReviews',
      events: [
        {
          http: {
            method: 'get',
            path: '/workflow/pending-reviews',
            cors: true
          }
        }
      ]
    },
    getLabAssignments: {
      handler: 'src/handlers/workflowDashboard.getLabAssignments',
      events: [
        {
          http: {
            method: 'get',
            path: '/workflow/lab-assignments',
            cors: true
          }
        }
      ]
    },
    getWorkflowStatistics: {
      handler: 'src/handlers/workflowDashboard.getWorkflowStatistics',
      events: [
        {
          http: {
            method: 'get',
            path: '/workflow/statistics',
            cors: true
          }
        }
      ]
    },
    getSubmittedBorelogs: {
      handler: 'src/handlers/workflowDashboard.getSubmittedBorelogs',
      events: [
        {
          http: {
            method: 'get',
            path: '/workflow/submitted-borelogs',
            cors: true
          }
        }
      ]
    },
    

    
    // Unified Lab Reports endpoints
    createUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.createUnifiedLabReport',
      events: [
        {
          http: {
            method: 'post',
            path: '/unified-lab-reports',
            cors: true
          }
        }
      ]
    },
    getUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.getUnifiedLabReport',
      events: [
        {
          http: {
            method: 'get',
            path: '/unified-lab-reports/{reportId}',
            cors: true
          }
        }
      ]
    },
    updateUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.updateUnifiedLabReport',
      events: [
        {
          http: {
            method: 'put',
            path: '/unified-lab-reports/{reportId}',
            cors: true
          }
        }
      ]
    },
    getUnifiedLabReports: {
      handler: 'src/handlers/unifiedLabReports.getUnifiedLabReports',
      events: [
        {
          http: {
            method: 'get',
            path: '/unified-lab-reports',
            cors: true
          }
        }
      ]
    },
    deleteUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.deleteUnifiedLabReport',
      events: [
        {
          http: {
            method: 'delete',
            path: '/unified-lab-reports/{reportId}',
            cors: true
          }
        }
      ]
    },

    // Approval endpoints for unified lab reports
    approveUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.approveUnifiedLabReport',
      events: [
        {
          http: {
            method: 'post',
            path: '/unified-lab-reports/{reportId}/approve',
            cors: true
          }
        }
      ]
    },

    rejectUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.rejectUnifiedLabReport',
      events: [
        {
          http: {
            method: 'post',
            path: '/unified-lab-reports/{reportId}/reject',
            cors: true
          }
        }
      ]
    },

    submitUnifiedLabReport: {
      handler: 'src/handlers/unifiedLabReports.submitUnifiedLabReport',
      events: [
        {
          http: {
            method: 'post',
            path: '/unified-lab-reports/{reportId}/submit',
            cors: true
          }
        }
      ]
    },

    // Soil Test Samples endpoints
    getSoilTestSamples: {
      handler: 'src/handlers/soilTestSamples.getSoilTestSamples',
      events: [
        {
          http: {
            method: 'get',
            path: '/unified-lab-reports/{reportId}/soil-samples',
            cors: true
          }
        }
      ]
    },
    getSoilTestSample: {
      handler: 'src/handlers/soilTestSamples.getSoilTestSample',
      events: [
        {
          http: {
            method: 'get',
            path: '/soil-test-samples/{sampleId}',
            cors: true
          }
        }
      ]
    },
    updateSoilTestSample: {
      handler: 'src/handlers/soilTestSamples.updateSoilTestSample',
      events: [
        {
          http: {
            method: 'put',
            path: '/soil-test-samples/{sampleId}',
            cors: true
          }
        }
      ]
    },
    deleteSoilTestSample: {
      handler: 'src/handlers/soilTestSamples.deleteSoilTestSample',
      events: [
        {
          http: {
            method: 'delete',
            path: '/soil-test-samples/{sampleId}',
            cors: true
          }
        }
      ]
    },

    // Rock Test Samples endpoints
    getRockTestSamples: {
      handler: 'src/handlers/rockTestSamples.getRockTestSamples',
      events: [
        {
          http: {
            method: 'get',
            path: '/unified-lab-reports/{reportId}/rock-samples',
            cors: true
          }
        }
      ]
    },
    getRockTestSample: {
      handler: 'src/handlers/rockTestSamples.getRockTestSample',
      events: [
        {
          http: {
            method: 'get',
            path: '/rock-test-samples/{sampleId}',
            cors: true
          }
        }
      ]
    },
    updateRockTestSample: {
      handler: 'src/handlers/rockTestSamples.updateRockTestSample',
      events: [
        {
          http: {
            method: 'put',
            path: '/rock-test-samples/{sampleId}',
            cors: true
          }
        }
      ]
    },
    deleteRockTestSample: {
      handler: 'src/handlers/rockTestSamples.deleteRockTestSample',
      events: [
        {
          http: {
            method: 'delete',
            path: '/rock-test-samples/{sampleId}',
            cors: true
          }
        }
      ]
    },

    // Lab Reports endpoint (alias for unified lab reports)
    getLabReports: {
      handler: 'src/handlers/unifiedLabReports.getUnifiedLabReports',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-reports',
            cors: true
          }
        }
      ]
    },

    // Lab Report Version Control endpoints
    saveLabReportDraft: {
      handler: 'src/handlers/labReportVersionControl.saveLabReportDraft',
      events: [
        {
          http: {
            method: 'post',
            path: '/lab-reports/draft',
            cors: true
          }
        }
      ]
    },
    submitLabReportForReview: {
      handler: 'src/handlers/labReportVersionControl.submitLabReportForReview',
      events: [
        {
          http: {
            method: 'post',
            path: '/lab-reports/submit',
            cors: true
          }
        }
      ]
    },
    reviewLabReport: {
      handler: 'src/handlers/labReportVersionControl.reviewLabReport',
      events: [
        {
          http: {
            method: 'post',
            path: '/lab-reports/{report_id}/review',
            cors: true
          }
        }
      ]
    },
    getLabReportVersionHistory: {
      handler: 'src/handlers/labReportVersionControl.getLabReportVersionHistory',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-reports/{report_id}/versions',
            cors: true
          }
        }
      ]
    },
    getLabReportVersion: {
      handler: 'src/handlers/labReportVersionControl.getLabReportVersion',
      events: [
        {
          http: {
            method: 'get',
            path: '/lab-reports/{report_id}/version/{version_no}',
            cors: true
          }
        }
      ]
    },
    // Unified Lab Reports CSV upload
    uploadUnifiedLabReportCSV: {
      handler: 'src/handlers/uploadUnifiedLabReportCSV.handler',
      // Heavier workload: parsing large XLSX-derived CSV and multiple inserts
      timeout: 120,
      memorySize: 1024,
      events: [
        {
          http: {
            method: 'post',
            path: '/unified-lab-reports/upload-csv',
            cors: true
          }
        }
      ]
    },
  },
  package: {
    individually: true
  },
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      target: 'node18',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 10,
      external: ['pg-native', 'jsonwebtoken']
    }
  }
};

module.exports = serverlessConfiguration; 