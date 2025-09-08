import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Validate OpenAI API key on startup
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types for our recruiting use cases
export interface CandidateInfo {
  full_name: string;
  current_title?: string;
  current_company?: string;
  skills?: string[];
  location?: string;
  experience_years?: number;
  selected_skill?: string;
}

export interface CampaignInfo {
  role_title: string;
  recruiter_name: string;
  recruiter_company: string;
  recruiter_title: string;
  recruiter_mission: string;
  location: string;
  salary_range?: string;
  is_remote: string;
}

import { ConversationData } from '../types/conversation';

export class OpenAIService {
  // Script templates for email composition
  private static readonly RECRUITING_SCRIPT = [
    "What role are you hiring for?",
    "What are some must-have skills or tools? (e.g. Python, React, Salesforce) — or just say 'skip' if not relevant.",
    "What level of seniority? (Junior, Mid, Senior, VP, etc.)",
    "What kind of companies should they be coming from? (Startups, mid-sized, enterprise, or no preference)",
    "Any specific industries? (e.g. Fintech, SaaS, etc.)",
    "Where should they be located — or is this remote?"
  ];

  /**
   * Helper method for OpenAI API calls with retry logic
   */
  private static async callOpenAI(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<string> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model: options.model || "gpt-4",
          messages,
          temperature: options.temperature || 0.3,
          max_tokens: options.max_tokens || 500,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          throw new Error('No response from OpenAI');
        }

        return responseText;
      } catch (error: any) {
        const isRetryableError = 
          error?.status === 429 || // Rate limit
          error?.status === 500 || // Server error
          error?.status === 502 || // Bad gateway
          error?.status === 503;   // Service unavailable

        if (attempt === maxRetries || !isRetryableError) {
          console.error(`OpenAI API call failed after ${attempt} attempts:`, error);
          throw error;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`OpenAI API call failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error?.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Helper method to safely parse JSON responses
   */
  private static parseJSONResponse<T>(responseText: string, context: string): T {
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.error(`Failed to parse OpenAI JSON response for ${context}:`, responseText);
      throw new Error(`Invalid JSON response from OpenAI for ${context}`);
    }
  }

  /**
   * Test OpenAI API connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      await this.callOpenAI(
        [
          {
            role: 'user',
            content: 'Respond with "pong"'
          }
        ],
        {
          model: 'gpt-3.5-turbo',
          temperature: 0,
          max_tokens: 10
        }
      );
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  /**
   * Generate personalized recruiting email with subject and body
   */
  static async generateRecruitingEmail(
    candidate: CandidateInfo,
    campaign: CampaignInfo,
    template: string
  ): Promise<{ subject: string; body: string }> {
    try {
      const prompt = `
You are an expert recruiting copywriter. Create a personalized recruiting email using the template and candidate information.

CANDIDATE INFORMATION:
Name: ${candidate.full_name}
Current Title: ${candidate.current_title || 'Not specified'}
Current Company: ${candidate.current_company || 'Not specified'}
Key Skill: ${candidate.selected_skill || candidate.skills?.[0] || 'Not specified'}
Location: ${candidate.location || 'Not specified'}
Experience: ${candidate.experience_years ? `${candidate.experience_years} years` : 'Not specified'}

CAMPAIGN INFORMATION:
Role: ${campaign.role_title}
Recruiter: ${campaign.recruiter_name}
Company: ${campaign.recruiter_company}
Recruiter Title: ${campaign.recruiter_title}
Company Mission: ${campaign.recruiter_mission}
Job Location: ${campaign.location}
Salary Range: ${campaign.salary_range || 'Not specified'}
Remote Policy: ${campaign.is_remote}

EMAIL TEMPLATE:
${template}

INSTRUCTIONS:
1. Generate a compelling subject line (under 50 characters)
2. Create the email body using the template and personalizing it
3. Replace ALL variables in the template
4. Make it professional but warm
5. Return as JSON with "subject" and "body" fields

Return format:
{
  "subject": "Great opportunity for [Name] - [Role] at [Company]",
  "body": "The personalized email content here..."
}

Return only valid JSON, no explanations.`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: "You are a professional recruiting copywriter who creates personalized emails. Always return valid JSON with subject and body fields."
        },
        {
          role: "user",
          content: prompt
        }
      ];

      const responseText = await this.callOpenAI(messages, {
        model: "gpt-4",
        temperature: 0.7,
        max_tokens: 800,
      });

      // Parse the JSON response
      const emailContent = this.parseJSONResponse<{ subject: string; body: string }>(responseText, 'email generation');
      
      return emailContent;

    } catch (error) {
      console.error('Error generating recruiting email with OpenAI:', error);
      
      // Fallback: return structured response
      return {
        subject: `Exciting ${campaign.role_title} opportunity at ${campaign.recruiter_company}`,
        body: template
          .replace('{name}', candidate.full_name)
          .replace('{skills}', candidate.selected_skill || candidate.skills?.[0] || 'your expertise')
          .replace('{role_title}', campaign.role_title)
          .replace('{recruiter_company}', campaign.recruiter_company)
          .replace('{recruiter_name}', campaign.recruiter_name)
      };
    }
  }

  /**
   * Parse natural language input into structured ConversationData
   * @param naturalLanguageInput Natural language input (e.g., "Senior React developers at fintech startups in NYC")
   * @param outreachType Type of outreach ('recruiting' or 'sales')
   * @returns Structured conversation data
   */
  static async parseNaturalLanguageToConversationData(
    naturalLanguageInput: string,
    outreachType: 'recruiting' | 'sales'
  ): Promise<ConversationData> {
    const prompt = `From this query: "${naturalLanguageInput}"

Return ONLY a flat JSON object with these exact fields (unused = ""):

{
  "role_title": "",
  "normalized_title": "",
  "title_variants": [],
  "role": "",
  "seniority_levels": [],
  "skills": "",
  "experience_level": "",
  "buyer_title": "",
  "pain_point": "",
  "company_size": "",
  "industry": "",
  "location": ""
}

Rules:
- "normalized_title": Clean, human title (e.g., "VP of Engineering", "Head of Product").
- "title_variants": 3-8 realistic title spellings/synonyms for the same function/seniority (no junior titles if query implies VP+). Example for VP of Engineering: ["VP Engineering","VP, Engineering","Vice President of Engineering","Head of Engineering","Engineering Director"].
- "role": One word function bucket if obvious: one of ["engineering","product","marketing","sales","human resources","data","design","finance","operations","it","legal"]. Else "".
- "seniority_levels": Map to People Data Labs levels subset: any of ["training","entry","manager","senior","director","vp","cxo"]. Example: VP -> ["vp","cxo"]; Director -> ["director"].
- Expand location abbrevs (SF→San Francisco, NYC→New York City, LA→Los Angeles).
- Keep city/region/country inside "location" as natural text; do not nest objects.
- Return valid JSON only. No explanations.`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'You are an expert at extracting structured data from natural language job searches. Return ONLY valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const responseText = await this.callOpenAI(messages, {
        model: 'gpt-4',
        temperature: 0.2,
        max_tokens: 500
      });

      // Parse the JSON response with all fields from ConversationData
      const extractedData = this.parseJSONResponse<{
        role_title?: string;
        normalized_title?: string;
        title_variants?: string[];
        role?: string;
        seniority_levels?: string[];
        skills?: string;
        experience_level?: string;
        buyer_title?: string;
        pain_point?: string;
        company_size?: string;
        industry?: string;
        location?: string;
      }>(responseText, 'natural language parsing');

      // Coerce & fallback
      const normalized_title = extractedData.normalized_title?.trim() || extractedData.role_title?.trim() || "";
      let title_variants = Array.isArray((extractedData as any).title_variants)
        ? ((extractedData as any).title_variants as string[]).map(v => String(v).trim()).filter(Boolean)
        : [];

      if (!title_variants.length && normalized_title) {
        // Simple auto-variants as a fallback
        const base = normalized_title;
        const noOf = base.replace(/\bof\b/gi, '').replace(/\s+/g, ' ').trim();
        title_variants = Array.from(new Set([
          base,
          noOf,
          base.replace(/Vice President/gi, 'VP'),
          base.replace(/\bVP\b/gi, 'Vice President'),
          base.replace(/Head of/gi, 'Head,'),
          base.replace(/Head,/gi, 'Head of'),
        ])).filter(Boolean);
      }

      // Coerce seniority_levels
      let seniority_levels = Array.isArray((extractedData as any).seniority_levels)
        ? ((extractedData as any).seniority_levels as string[]).map(s => s.toLowerCase().trim())
        : [];

      const allowedLevels = new Set(['training','entry','manager','senior','director','vp','cxo']);
      seniority_levels = seniority_levels.filter(l => allowedLevels.has(l));

      // If nothing given but title clearly implies, infer a minimal set
      if (!seniority_levels.length && normalized_title) {
        const t = normalized_title.toLowerCase();
        if (/\b(vp|vice president|chief|cto|cpo|cmo|cfo|coo)\b/.test(t)) seniority_levels = ['vp','cxo'];
        else if (/\bdirector|head\b/.test(t)) seniority_levels = ['director'];
        else if (/\bsenior\b/.test(t)) seniority_levels = ['senior'];
      }

      // Ensure skills is always an array
      const normalizedSkills = extractedData.skills 
        ? Array.isArray(extractedData.skills) 
          ? extractedData.skills 
          : extractedData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      // Ensure experience_level matches the expected type
      const validExperienceLevels = ['junior', 'mid', 'senior', 'lead'] as const;
      const normalizedExperienceLevel = extractedData.experience_level && 
        validExperienceLevels.includes(extractedData.experience_level.toLowerCase() as any)
          ? extractedData.experience_level.toLowerCase() as 'junior' | 'mid' | 'senior' | 'lead'
          : undefined;

      const { experience_level, ...restExtractedData } = extractedData;
      
      const conversationData: ConversationData = {
        ...restExtractedData,
        outreach_type: outreachType,
        skills: normalizedSkills,
        experience_level: normalizedExperienceLevel,
        normalized_title,
        title_variants,
        seniority_levels,
      };

      return conversationData;
    } catch (error) {
      console.error('Error parsing natural language to conversation data:', error);
      
      // Return minimal valid response on error with better defaults
      return {
        outreach_type: outreachType
      };
    }
  }
}