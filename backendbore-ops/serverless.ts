import type { AWS } from '@serverless/typescript';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const serverlessConfiguration: AWS = {
  service: 'backendbore-ops',
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
      PARQUET_LAMBDA_FUNCTION_NAME: process.env.PARQUET_LAMBDA_FUNCTION_NAME || 'parquet-repository-dev-parquet-repository',
      BORELOG_PARSER_QUEUE_URL: process.env.BORELOG_PARSER_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/211946440260/borelog-parser-queue-dev',
      // Storage configuration (REQUIRED for S3 mode)
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'bpc-cloud',
      PARQUET_BUCKET_NAME: process.env.PARQUET_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'parquet-repository-dev-serverlessdeploymentbucket-cfxpeawuynnl',
      STORAGE_MODE: process.env.STORAGE_MODE || 's3',
      // Note: AWS_REGION is automatically provided by Lambda and cannot be set manually
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
          },
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:PutObject'
            ],
            Resource: [
              'arn:aws:s3:::${env:S3_BUCKET_NAME}',
              'arn:aws:s3:::${env:S3_BUCKET_NAME}/*'
            ]
          },
          // SQS permissions removed - queues are managed separately
          // Handlers can still send messages using queue URL from env vars
          {
            Effect: 'Allow',
            Action: [
              'sqs:SendMessage',
              'sqs:GetQueueAttributes'
            ],
            Resource: [
              'arn:aws:sqs:${aws:region}:${aws:accountId}:borelog-parser-queue-${self:provider.stage}',
              'arn:aws:sqs:${aws:region}:${aws:accountId}:borelog-parser-dlq-${self:provider.stage}'
            ]
          }
        ]
      }
    }
  },
  functions: {
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

    // Pending CSV Uploads endpoints
    listPendingCSVUploads: {
      handler: 'src/handlers/listPendingCSVUploads.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/pending-csv-uploads',
            cors: true
          }
        }
      ]
    },
    getPendingCSVUpload: {
      handler: 'src/handlers/getPendingCSVUpload.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/pending-csv-uploads/{upload_id}',
            cors: true
          }
        }
      ]
    },
    approvePendingCSVUpload: {
      handler: 'src/handlers/approvePendingCSVUpload.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/pending-csv-uploads/{upload_id}/approve',
            cors: true
          }
        }
      ]
    },
  },
  package: {
    individually: true,
    patterns: [
      '!node_modules/@aws-sdk/**',
      '!node_modules/**',
      '!**/*.test.ts',
      '!**/*.test.js',
      '!**/*.spec.ts',
      '!**/*.spec.js',
      '!**/tests/**',
      '!**/test/**',
      '!.git/**',
      '!.vscode/**',
      '!.idea/**',
      '!*.md',
      '!tsconfig.json',
      '!jest.config.js'
    ]
  },
  resources: {
    Resources: {} as any
  },
  custom: {
    'serverless-offline': {
      httpPort: 3005,
      lambdaPort: 3006
    },
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: false,
      target: 'node18',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 3,
      external: [
        'pg-native',
        'jsonwebtoken',
        '@aws-sdk/*',
        'aws-sdk'
      ],
      keepNames: true,
      packagerOptions: {
        scripts: []
      }
    }
  }
};

module.exports = serverlessConfiguration; 