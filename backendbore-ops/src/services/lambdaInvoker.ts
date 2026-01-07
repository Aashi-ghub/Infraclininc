import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { logger } from '../utils/logger';

let sqsClient: SQSClient | null = null;

function getSqsClient(): SQSClient | null {
  if (process.env.IS_OFFLINE === 'true') {
    return null;
  }

  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  return sqsClient;
}

export interface BorelogParserQueuePayload {
  bucket: string;
  csvKey: string;
  project_id: string;
  borelog_id: string;
  upload_id: string;
  version_no: number;
  fileType: string;
  requestedBy: string;
}

export async function invokeBorelogParserLambda(
  payload: BorelogParserQueuePayload
): Promise<void> {
  const queueUrl = process.env.BORELOG_PARSER_QUEUE_URL;
  if (!queueUrl) {
    logger.warn(
      'Skipping borelog parser enqueue because BORELOG_PARSER_QUEUE_URL is not configured'
    );
    return;
  }

  const client = getSqsClient();
  if (!client) {
    logger.info('Skipping borelog parser enqueue in offline mode');
    return;
  }

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
  });

  try {
    await client.send(command);
    logger.info('Queued borelog parser message', {
      queueUrl,
      upload_id: payload.upload_id,
      borelog_id: payload.borelog_id,
    });
  } catch (error) {
    logger.error('Failed to enqueue borelog parser message', {
      error,
      queueUrl,
      payloadSummary: {
        bucket: payload.bucket,
        key: payload.csvKey,
        upload_id: payload.upload_id,
      },
    });
    throw new Error('Failed to enqueue borelog parser message');
  }
}

