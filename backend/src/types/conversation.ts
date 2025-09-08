// The core fields the OpenAI parser / user input produce for a search
export interface ConversationCore {
  // Base required
  outreach_type: 'sales' | 'recruiting';

  // Recruiter identity (if/when available)
  user_title?: string;
  user_company?: string;
  user_mission?: string;

  // Recruiting-specific (all optional)
  role_title?: string;
  // skills used across codebase as string[] (normalize here)
  skills?: string[];
  experience_level?: 'junior' | 'mid' | 'senior' | 'lead';

  // Sales-specific
  buyer_title?: string;
  pain_point?: string;

  // Shared
  company_size?: string;
  industry?: string;
  location?: string;

  // Normalized
  normalized_title?: string;
  title_variants?: string[];
  role?: string;
  seniority_levels?: string[];

  // Metadata
  parsed_at?: string;
  confidence_score?: number;
}

// The email template bits we persist with a campaign
export interface ConversationTemplates {
  subjectTemplate: string;
  bodyTemplate: string;
  placeholders: Record<string, string>;
}

// What the OpenAI parser typically returns (may NOT include templates yet)
export type ConversationData = ConversationCore & Partial<ConversationTemplates>;

// What we want to store with a campaign (templates are REQUIRED here)
export type ConversationPayload = ConversationCore & ConversationTemplates;
