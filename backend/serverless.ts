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
    }
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
      external: ['pg-native']
    }
  }
};

module.exports = serverlessConfiguration; 