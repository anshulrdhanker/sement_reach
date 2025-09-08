import { supabase } from '../config/database';
import { CampaignStatus } from '../services/queueTypes';
import { ConversationPayload } from '../types/conversation';

export interface CreateCampaignData {
  // Required fields
  user_id: string;
  name: string;
  
  // All campaign data is now in conversation_data
  conversation_data: ConversationPayload;
  
  // Template and search fields
  subject_template?: string | null;
  body_template?: string | null;
  placeholder_values?: Record<string, string>;
  search_criteria?: any;
  status?: 'pending' | 'searching' | 'completed' | 'failed' | 'active' | 'partial';
  
  // Optional fields for backward compatibility
  outreach_type?: 'sales' | 'recruiting'; // Will be overridden by conversation_data
  user_name?: string;                     // Will be overridden by conversation_data
  user_company?: string;                  // Will be overridden by conversation_data
  user_title?: string;                    // Will be overridden by conversation_data
  user_mission?: string;                  // Will be overridden by conversation_data
  industry?: string;                      // Will be overridden by conversation_data
  is_remote?: string;                     // Will be overridden by conversation_data
  role_title?: string;                    // Will be overridden by conversation_data
  role_requirements?: string;             // Will be overridden by conversation_data
  job_location?: string;                  // Will be overridden by conversation_data
  salary_range?: string;                  // Will be overridden by conversation_data
  remote_ok?: boolean;                    // Will be overridden by conversation_data
  target_emails?: number;                 // Will be overridden by conversation_data
  specific_skills?: string[];             // Will be overridden by conversation_data
  experience_level?: string;              // Will be overridden by conversation_data
  company_size?: string;                  // Will be overridden by conversation_data
  additional_variables?: Record<string, string>; // Will be overridden by conversation_data
}

export interface CampaignProfile {
  id: string;
  user_id: string;
  name: string;
  outreach_type: 'sales' | 'recruiting';
  
  // Campaign metadata
  status: CampaignStatus | 'pending' | 'searching' | 'completed' | 'failed' | 'active' | 'partial';
  pdl_search_params: any;
  total_found: number;
  total_sent: number;
  target_emails: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  
  // Template and search fields
  subject_template: string | null;
  body_template: string | null;
  placeholder_values: Record<string, string>;
  search_criteria: any;
  
  // All conversation data including templates
  conversation_data: ConversationPayload;
  
  // Additional metadata (stored in pdl_search_params)
  additional_variables?: Record<string, string>;
}

export interface CampaignStats {
  total_campaigns: number;
  active_campaigns: number;
  total_candidates_found: number;
  total_emails_sent: number;
  average_response_rate: number;
}

export class Campaign {
  /**
   * Create a new outreach campaign
   */
  static async create(campaignData: CreateCampaignData): Promise<CampaignProfile | null> {
    try {
      // Ensure conversation_data has all required fields
      const conversationData = campaignData.conversation_data;
      
      // Set default values if not provided
      const now = new Date().toISOString();
      if (!conversationData.parsed_at) {
        conversationData.parsed_at = now;
      }
      if (conversationData.confidence_score === undefined) {
        conversationData.confidence_score = 1.0;
      }

      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          user_id: campaignData.user_id,
          name: campaignData.name,
          outreach_type: conversationData.outreach_type,
          status: campaignData.status || 'pending',
          pdl_search_params: {
            // Store any additional search parameters here
            additional_variables: campaignData.additional_variables || {}
          },
          total_found: 0,
          total_sent: 0,
          target_emails: campaignData.target_emails || 50,
          subject_template: campaignData.subject_template ?? null,
          body_template: campaignData.body_template ?? null,
          placeholder_values: campaignData.placeholder_values || {},
          search_criteria: campaignData.search_criteria || {},
          created_at: now,
          updated_at: now,
          completed_at: null,
          // Store all conversation data including templates
          conversation_data: conversationData,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating campaign:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in Campaign.create:', error);
      return null;
    }
  }

  /**
   * Find campaign by ID
   */
  static async findById(campaignId: string): Promise<CampaignProfile | null> {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in Campaign.findById:', error);
      return null;
    }
  }

  /**
   * Get all campaigns for a user
   */
  static async findByUserId(userId: string, limit: number = 50): Promise<CampaignProfile[]> {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user campaigns:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in Campaign.findByUserId:', error);
      return [];
    }
  }

  /**
   * Update campaign status
   */
  static async updateStatus(campaignId: string, status: CampaignStatus): Promise<boolean> {
    try {
      const updateData: any = {
        status,
      };

      // Set completed_at when status changes to completed
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaignId);

      if (error) {
        console.error('Error updating campaign status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.updateStatus:', error);
      return false;
    }
  }

  /**
   * Update PDL search parameters
   */
  static async updatePDLSearchParams(campaignId: string, searchParams: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          pdl_search_params: searchParams,
        })
        .eq('id', campaignId);

      if (error) {
        console.error('Error updating PDL search params:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.updatePDLSearchParams:', error);
      return false;
    }
  }

  /**
   * Get all campaign variables for email personalization
   */
  static async getCampaignVariables(campaignId: string): Promise<Record<string, string> | null> {
    try {
      const campaign = await this.findById(campaignId);
      if (!campaign || !campaign.conversation_data) return null;

      const conv = campaign.conversation_data;
      const variables: Record<string, string> = {
        role_title: conv.role_title || conv.buyer_title || '',
        user_company: conv.user_company || '',
        user_title: conv.user_title || '',
        user_mission: conv.user_mission || '',
        industry: conv.industry || '',
        location: conv.location || '',
        job_location: conv.location || '', // Using location for job_location
        salary_range: '', // Not in conversation_data
        experience_level: conv.experience_level || '',
        company_size: conv.company_size || '',
        outreach_type: conv.outreach_type,
      };

      // Add skills if available
      if (Array.isArray(conv.skills) && conv.skills.length > 0) {
        variables.required_skills = conv.skills.join(', ');
      }

      // Add any additional variables from pdl_search_params
      if (campaign.pdl_search_params?.additional_variables) {
        Object.assign(variables, campaign.pdl_search_params.additional_variables);
      }

      return variables;
    } catch (error) {
      console.error('Error in Campaign.getCampaignVariables:', error);
      return null;
    }
  }

  /**
   * Update campaign variables
   */
  static async updateVariables(campaignId: string, variables: {
    user_company?: string;
    user_title?: string;
    user_mission?: string;
    industry?: string;
    location?: string;
    experience_level?: string;
    company_size?: string;
    additional_variables?: Record<string, string>;
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update(variables)
        .eq('id', campaignId);

      if (error) {
        console.error('Error updating campaign variables:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.updateVariables:', error);
      return false;
    }
  }

  /**
   * Generate PDL search parameters from campaign data
   */
  static async generatePDLSearchParams(campaignId: string): Promise<any> {
    try {
      const campaign = await this.findById(campaignId);
      if (!campaign || !campaign.conversation_data) return null;

      const conv = campaign.conversation_data;
      
      // Build PDL search parameters based on conversation data
      const searchParams: any = {
        required: []
      };

      // Add role/title criteria
      const titleToSearch = conv.role_title || conv.buyer_title;
      if (titleToSearch) {
        searchParams.required.push({
          field: "job_title",
          condition: "contains",
          value: titleToSearch
        });
      }

      // Add skills criteria
      if (Array.isArray(conv.skills) && conv.skills.length > 0) {
        searchParams.required.push({
          field: "skills",
          condition: "contains",
          value: conv.skills
        });
      }

      // Add industry criteria
      if (conv.industry) {
        searchParams.required.push({
          field: "industry",
          condition: "contains",
          value: conv.industry
        });
      }

      // Add location criteria
      if (conv.location && conv.location.toLowerCase() !== 'remote') {
        searchParams.required.push({
          field: "location_region",
          condition: "contains",
          value: conv.location
        });
      }

      // Add experience level criteria
      if (conv.experience_level) {
        searchParams.required.push({
          field: "job_title_levels",
          condition: "contains",
          value: conv.experience_level
        });
      }

      return searchParams;
    } catch (error) {
      console.error('Error in Campaign.generatePDLSearchParams:', error);
      return null;
    }
  }

  /**
   * Create campaign variables object for email generation
   */
  static createEmailVariables(campaign: CampaignProfile, candidate: any): Record<string, string> {
    const conv = campaign.conversation_data;
    return {
      // Campaign variables from conversation data
      role_title: conv.role_title || conv.buyer_title || '',
      user_company: conv.user_company || '',
      user_title: conv.user_title || '',
      user_mission: conv.user_mission || '',
      location: conv.location || '',
      salary_range: '', // Not in conversation_data
      industry: conv.industry || '',
      
      // Candidate variables
      name: candidate.full_name || '',
      skills: candidate.selected_skill || 
             (Array.isArray(candidate.skills) ? candidate.skills.join(', ') : ''),
      current_company: candidate.current_company || '',
      current_title: candidate.current_title || '',
      candidate_location: candidate.location || '',
      experience_years: candidate.experience_years ? candidate.experience_years.toString() : '',
      
      // Additional variables from pdl_search_params if needed
      ...(campaign.pdl_search_params?.additional_variables || {})
    };
  }

  /**
   * Update campaign statistics
   */
  static async updateStats(campaignId: string, stats: {
    total_found?: number;
    total_sent?: number;
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update(stats)
        .eq('id', campaignId);

      if (error) {
        console.error('Error updating campaign stats:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.updateStats:', error);
      return false;
    }
  }

  /**
   * Increment total found count
   */
  static async incrementTotalFound(campaignId: string, count: number = 1): Promise<boolean> {
    try {
      // First get current value
      const campaign = await this.findById(campaignId);
      if (!campaign) return false;

      // Then update with incremented value
      const { error } = await supabase
        .from('campaigns')
        .update({
          total_found: campaign.total_found + count,
        })
        .eq('id', campaignId);

      if (error) {
        console.error('Error incrementing total found:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.incrementTotalFound:', error);
      return false;
    }
  }

  /**
   * Increment total sent count
   */
  static async incrementTotalSent(campaignId: string, count: number = 1): Promise<boolean> {
    try {
      // First get current value
      const campaign = await this.findById(campaignId);
      if (!campaign) return false;

      // Then update with incremented value
      const { error } = await supabase
        .from('campaigns')
        .update({
          total_sent: campaign.total_sent + count,
        })
        .eq('id', campaignId);

      if (error) {
        console.error('Error incrementing total sent:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.incrementTotalSent:', error);
      return false;
    }
  }

  /**
   * Get campaign statistics for a user
   */
  static async getStatsForUser(userId: string): Promise<CampaignStats> {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId);

      if (error || !data) {
        console.error('Error fetching campaign stats:', error);
        return this.getEmptyStats();
      }

      const stats = data.reduce((acc, campaign) => {
        acc.total_campaigns += 1;
        if (campaign.status === 'active') acc.active_campaigns += 1;
        acc.total_candidates_found += campaign.total_found || 0;
        acc.total_emails_sent += campaign.total_sent || 0;
        return acc;
      }, this.getEmptyStats());

      // Calculate average response rate (placeholder - would need reply data from candidates table)
      stats.average_response_rate = 0; // TODO: Calculate from candidates table

      return stats;
    } catch (error) {
      console.error('Error in Campaign.getStatsForUser:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get campaigns that need processing (draft or processing status)
   */
  static async getPendingCampaigns(limit: number = 50): Promise<CampaignProfile[]> {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['draft', 'processing'])
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error getting pending campaigns:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPendingCampaigns:', error);
      return [];
    }
  }

  /**
   * Get active campaigns for email sending
   */
  static async getActiveCampaigns(limit: number = 50): Promise<CampaignProfile[]> {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['sending', 'processing'])
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error getting active campaigns:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getActiveCampaigns:', error);
      return [];
    }
  }

  /**
   * Delete a campaign
   */
  static async delete(campaignId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) {
        console.error('Error deleting campaign:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Campaign.delete:', error);
      return false;
    }
  }

  /**
   * Pause/Resume campaign
   */
  static async togglePause(campaignId: string): Promise<boolean> {
    try {
      // Get current status
      const campaign = await this.findById(campaignId);
      if (!campaign) return false;

      const newStatus: CampaignStatus = campaign.status === 'paused' ? 'sending' : 'paused';
      return this.updateStatus(campaignId, newStatus);
    } catch (error) {
      console.error('Error in Campaign.togglePause:', error);
      return false;
    }
  }

  /**
   * Check if campaign has reached target emails
   */
  static async hasReachedTarget(campaignId: string): Promise<boolean> {
    try {
      const campaign = await this.findById(campaignId);
      if (!campaign) return false;

      return campaign.total_sent >= campaign.target_emails;
    } catch (error) {
      console.error('Error in Campaign.hasReachedTarget:', error);
      return false;
    }
  }

  /**
   * Helper to get empty stats object
   */
  static getEmptyStats(): CampaignStats {
    return {
      total_campaigns: 0,
      active_campaigns: 0,
      total_candidates_found: 0,
      total_emails_sent: 0,
      average_response_rate: 0
    };
  }
}