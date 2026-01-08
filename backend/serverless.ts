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
      PARQUET_LAMBDA_FUNCTION_NAME: process.env.PARQUET_LAMBDA_FUNCTION_NAME || 'parquet-repository-dev-parquet-repository',
      BORELOG_PARSER_QUEUE_URL: process.env.BORELOG_PARSER_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/211946440260/borelog-parser-queue-dev',
      // Storage configuration (REQUIRED for S3 mode)
      // These defaults ensure the variables are always set in Lambda
      S3_BUCKET_NAME: 'bpc-cloud',
      PARQUET_BUCKET_NAME: 'parquet-repository-dev-serverlessdeploymentbucket-cfxpeawuynnl',
      STORAGE_MODE: 's3',
      // Note: AWS_REGION is automatically provided by Lambda and cannot be set manually
    },
    apiGateway: {
      binaryMediaTypes: [
        '*/*',
        'application/octet-stream',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
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
              's3:ListBucket',
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
              's3:HeadObject'
            ],
            Resource: [
              'arn:aws:s3:::bpc-cloud',
              'arn:aws:s3:::bpc-cloud/*',
              'arn:aws:s3:::parquet-repository-dev-serverlessdeploymentbucket-cfxpeawuynnl',
              'arn:aws:s3:::parquet-repository-dev-serverlessdeploymentbucket-cfxpeawuynnl/*'
            ]
          },
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
    // Note: parquetRepository and borelogParser are already deployed separately
    // They are not included in this service to avoid conflicts

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
    uploadBoreholeCsv: {
      handler: 'src/handlers/uploadBoreholeCsv.handler',
      events: [
        {
          http: {
            method: 'post',
            path: '/api/borelog/upload-csv',
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
            path: '/borelog-image/{image_id}',
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
    deleteBorelog: {
      handler: 'src/handlers/deleteBorelog.handler',
      events: [
        {
          http: {
            method: 'delete',
            path: '/borelog/{borelog_id}',
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
    // Note: BorelogParserQueue and BorelogParserDLQ are already deployed separately
  },
  custom: {
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
        '@aws-sdk/*'
      ],
      keepNames: true,
      packagerOptions: {
        scripts: []
      }
    }
  }
};

module.exports = serverlessConfiguration; 