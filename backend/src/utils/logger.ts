import winston from 'winston';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'backendbore' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Prevent Winston from exiting on uncaught errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

export const logRequest = (event: any, context: any) => {
  logger.info('Lambda invocation', {
    requestId: context.awsRequestId,
    path: event.path,
    method: event.httpMethod,
    queryParams: event.queryStringParameters,
    headers: event.headers,
  });
};

export const logResponse = (response: any, duration: number) => {
  logger.info('Lambda response', {
    statusCode: response.statusCode,
    duration,
    body: typeof response.body === 'string' ? JSON.parse(response.body) : response.body,
  });
}; 