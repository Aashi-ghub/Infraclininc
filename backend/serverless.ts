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
      JWT_SECRET: process.env.JWT_SECRET || 'development-secret-key',
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
    
    // Borelog Details endpoints
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
    getBorelogsByProject: {
      handler: 'src/handlers/getBorelogsByProject.handler',
      events: [
        {
          http: {
            method: 'get',
            path: '/geological-log/project/{project_id}',
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