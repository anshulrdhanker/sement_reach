import { Queue, QueueEvents } from 'bullmq';
import { REDIS_CONFIG } from './config';

// Redis connection configuration
const redisConfig = {
  host: REDIS_CONFIG.HOST,
  port: REDIS_CONFIG.PORT,
  password: REDIS_CONFIG.PASSWORD || undefined,
  maxRetriesPerRequest: null, // BullMQ requirement
  retryDelayOnFailure: 1000,
  connectTimeout: 60000,
};

// Default job options
const defaultJobOptions = {
  removeOnComplete: 10,
  removeOnFail: 20,
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
};

// Queue instances
export const campaignQueue = new Queue('campaign-processing', {
  connection: redisConfig,
  defaultJobOptions,
});

export const emailQueue = new Queue('email-sending', {
  connection: redisConfig,
  defaultJobOptions,
});

// Queue events
export const campaignQueueEvents = new QueueEvents('campaign-processing', {
  connection: redisConfig,
});

export const emailQueueEvents = new QueueEvents('email-sending', {
  connection: redisConfig,
});

// Cleanup function
export async function closeQueues() {
  console.log('Closing queues...');
  await Promise.all([
    campaignQueue.close(),
    emailQueue.close(),
    campaignQueueEvents.close(),
    emailQueueEvents.close(),
  ]);
  console.log('All queues closed');
}

// Handle process termination
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);
