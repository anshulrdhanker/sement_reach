import { ConversationData } from '../types/conversation';

export { ConversationData };

// Campaign status types
export type CampaignStatus = 
  | 'draft'          // Initial state
  | 'validating'     // Data validation in progress
  | 'pending'        // Waiting to be processed
  | 'searching'      // Finding candidates (PDL search)
  | 'processing'     // General processing state
  | 'generating'     // Creating email content
  | 'sending'        // Actively sending emails
  | 'paused'         // Manually paused
  | 'active'         // Currently active and processing
  | 'partial'        // Partially completed
  | 'completed'      // All emails sent
  | 'failed';        // Processing failed

// Validation types
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  received?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Types for campaign processing queue
export interface CampaignJobData {
  campaignId: string;
  userId: string;
  conversationData: ConversationData;
}

// Types for email sending queue
export interface EmailJobData {
  campaignId: string;
  candidateId: string;
  userId: string;
  candidate: any;      // Will be typed more specifically later
  campaignData: any;   // Will be typed more specifically later
}

// Progress tracking for long-running jobs
export interface JobProgress {
  campaignId: string;
  stage: 'searching' | 'generating' | 'sending' | 'completed' | 'failed';
  totalCandidates?: number;
  processedCandidates?: number;
  emailsSent?: number;
  errors?: string[];
  startedAt: Date;
  completedAt?: Date;
}

// Rate limiting configuration
export interface RateLimitConfig {
  pdl: {
    requestsPerMinute: number;
    delayBetweenRequests: number;
  };
  gmail: {
    emailsPerDay: number;
    emailsPerSecond: number;
  };
  openai: {
    maxConcurrent: number;
    retryDelay: number;
  };
}

// Rate limits for external services
export const RATE_LIMITS: RateLimitConfig = {
  pdl: {
    requestsPerMinute: 10,
    delayBetweenRequests: 7000, // 7 seconds between requests
  },
  gmail: {
    emailsPerDay: 250,
    emailsPerSecond: 1,
  },
  openai: {
    maxConcurrent: 5,
    retryDelay: 1000, // 1 second
  },
};
