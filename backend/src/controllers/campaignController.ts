import { Request, Response } from 'express';
import { validateCampaignRequest, formatValidationErrors } from '../utils/validation';
import { Campaign, CampaignProfile } from '../models/Campaign';
import { User, UserProfile } from '../models/User';
import { QueueService } from '../services/queueService';
import { CreateCampaignData } from '../models/Campaign';
import { SubscriptionService } from '../services/subscriptionService';
import { Candidate } from '../models/Candidate';

class CampaignController {
  /**
   * POST /api/campaigns - Create a new recruiting campaign
   */
  async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      const { conversationData, name } = req.body;
      // Mock userId for development
      const userId = 'mock-user-id';
      // Comment out authentication check
      // if (!userId) {
      //   res.status(401).json({
      //     error: 'UNAUTHORIZED',
      //     message: 'User not authenticated'
      //   });
      //   return;
      // }

      // 2. Validate request data
      const validation = validateCampaignRequest({ conversationData, name });
      if (!validation.isValid) {
        res.status(400).json(formatValidationErrors(validation.errors));
        return;
      }

      // 3. Get user and check limits
      const userProfile = await User.findById(userId);
      if (!userProfile) {
        res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
        return;
      }

      const subscriptionCheck = await SubscriptionService.checkCampaignLimits(userId);
      
      if (!subscriptionCheck.canCreate) {
        res.status(403).json({
          error: 'CAMPAIGN_LIMIT_REACHED',
          message: 'You have no remaining campaign credits',
          details: {
            remaining: subscriptionCheck.remainingCampaigns,
            needsToPurchase: subscriptionCheck.needsToPurchase,
            isEnterprise: subscriptionCheck.isEnterprise
          }
        });
        return;
      }

      // 4. Prepare conversation payload
      const conversationPayload = {
        ...conversationData,
        user_name: conversationData.user_name || 'User',
        user_company: conversationData.user_company,
        user_title: conversationData.user_title,
        user_mission: conversationData.user_mission,
        role_title: conversationData.role_title || conversationData.buyer_title || '',
        skills: Array.isArray(conversationData.skills) 
          ? conversationData.skills 
          : (conversationData.skills || '').split(',').map((s: string) => s.trim()).filter(Boolean),
        experience_level: conversationData.experience_level,
        company_size: conversationData.company_size,
        industry: conversationData.industry,
        location: conversationData.location,
        is_remote: conversationData.location?.toLowerCase().includes('remote') ? 'true' : 'false',
        parsed_at: new Date().toISOString(),
        confidence_score: 1.0,
        // Include any additional fields from conversationData
        ...(conversationData.additional_variables || {})
      };

      // 5. Prepare campaign data
      const campaignData: CreateCampaignData = {
        user_id: userId,
        name: name || `${conversationData.outreach_type} Campaign - ${new Date().toLocaleDateString()}`,
        conversation_data: conversationPayload,
        
        // Keep additional variables for tracking
        additional_variables: {
          source: 'api',
          createdAt: new Date().toISOString()
        },
        
        // For backward compatibility
        outreach_type: conversationData.outreach_type,
        status: 'pending'
      };

      // 5. Create campaign in database
      console.log('=== CAMPAIGN CREATE DEBUG ===');
      console.log('About to create campaign with data:', JSON.stringify(campaignData, null, 2));

      let campaign;
      try {
        campaign = await Campaign.create(campaignData);
        console.log('✅ Campaign created successfully:', campaign);
        
        // Deduct campaign credit after successful creation
        const campaignUsed = await SubscriptionService.useCampaign(userId);
        if (!campaignUsed) {
          console.error('Failed to deduct campaign credit');
        }
        
        if (!campaign) {
          throw new Error('Campaign.create returned null/undefined');
        }
      } catch (error: unknown) {
        const dbError = error as Error;
        console.error('❌ Database creation error:', dbError);
        console.error('Error name:', dbError.name);
        console.error('Error message:', dbError.message);
        console.error('Error stack:', dbError.stack);
        throw new Error(`Database error: ${dbError.message}`);
      }

      // 6. Start background processing
      try {
        await QueueService.startCampaignProcessing(
          campaign.id,
          userId,
          conversationData
        );
        
      } catch (queueError) {
        console.error('Queue processing failed:', queueError);
        // Don't fail the whole request - campaign was created successfully
      }

      // 8. Return success response
      res.status(201).json({
        data: {
          campaignId: campaign.id,
          name: campaign.name,
          status: campaign.status || 'draft',
          createdAt: campaign.created_at,
          message: 'Campaign created successfully and processing started'
        }
      });

    } catch (error) {
      console.error('Campaign creation failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create campaign',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/campaigns/:id - Get campaign status
   */
  async getCampaignStatus(req: Request, res: Response): Promise<void> {
    try {
      // Prevent caching of this endpoint
      res.set('Cache-Control', 'no-store');
      const { id: campaignId } = req.params;
      // Mock userId for development and bypass authentication
      const userId = 'mock-user-id';
      
      // Authentication check temporarily disabled for testing
      // if (!userId) {
      //   res.status(401).json({
      //     error: 'UNAUTHORIZED',
      //     message: 'User not authenticated'
      //   });
      //   return;
      // }

      // Get campaign from database
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        res.status(404).json({
          error: 'CAMPAIGN_NOT_FOUND',
          message: 'Campaign not found'
        });
        return;
      }

      // Ownership verification temporarily disabled for testing
      // if (campaign.user_id !== userId) {
      //   res.status(403).json({
      //     error: 'FORBIDDEN',
      //     message: 'You do not have permission to access this campaign'
      //   });
      //   return;
      // }

      // Get queue status if campaign is processing
      let queueStatus = null;
      const processingStates = ['draft', 'validating', 'searching', 'generating', 'sending'];
      
      if (processingStates.includes(campaign.status)) {
        try {
          queueStatus = await QueueService.getCampaignStatus(campaignId);
        } catch (queueError) {
          console.error('Failed to get queue status:', queueError);
          // Continue without queue status
        }
      }

      // Prepare response data
      const responseData: any = {
        id: campaign.id,
        status: campaign.status,
        name: campaign.name,
        created_at: campaign.created_at,
        queueStatus
      };

      // If campaign is completed, include candidates
      if (campaign.status === 'completed') {
        const candidates = await Candidate.findByCampaignId(campaignId);
        responseData.candidates = candidates.map(candidate => ({
          id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          current_title: candidate.current_title,
          current_company: candidate.current_company,
          location: candidate.location,
          linkedin_url: candidate.linkedin_url,
          skills: candidate.skills,
          experience_years: candidate.experience_years,
          status: candidate.status
        }));
      }

      res.json(responseData);

    } catch (error) {
      console.error('Failed to get campaign status:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve campaign status'
      });
    }
  }

  /**
   * GET /api/campaigns - List user's campaigns
   */
  async listCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;  // Using type assertion for user property

      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
        return;
      }

      // Get user's campaigns (you'll need to implement this in Campaign model)
      // For now, return empty array
      const campaigns: CampaignProfile[] = []; // TODO: Implement Campaign.findByUserId(userId)

      res.json({
        data: campaigns
      });

    } catch (error) {
      console.error('Failed to list campaigns:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve campaigns'
      });
    }
  }
}

export default new CampaignController();