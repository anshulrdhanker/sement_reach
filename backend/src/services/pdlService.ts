// File: backend/services/pdlService.ts
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.PDL_API_KEY) {
  throw new Error('PDL_API_KEY environment variable is required');
}

const PDL_API_BASE_URL = 'https://api.peopledatalabs.com/v5';
const PDL_API_KEY = process.env.PDL_API_KEY;

import { ConversationData } from '../types/conversation';

type SkillsLike = string[] | string | null | undefined;

type PDLPerson = {
  id: string;
  first_name?: string;
  full_name?: string;
  work_email?: string;
  job_title?: string;
  job_company_name?: string;
  job_company_size?: string;
  job_company_industry?: string;
  linkedin_url?: string;
  location_name?: string;
  skills?: SkillsLike;
  inferred_years_experience?: number;
  [key: string]: any;
};

// Enhanced candidate interface
export interface Candidate {
  id: string;
  first_name: string;
  full_name: string;
  work_email?: string;
  job_title?: string;
  job_company_name?: string;
  job_company_size?: string;
  job_company_industry?: string;
  linkedin_url?: string;
  location_name?: string;
  skills?: string[];
  experience_years?: number;
  relevance_score?: number;
}

// Location normalization mapping for common location formats to PDL canonical fields
const LOCATION_NORMALIZATION: Record<string, {city?: string, region?: string, country?: string, metro?: string}> = {
  // US Cities
  'new york': { city: 'New York', region: 'New York', country: 'United States', metro: 'New York City Metro Area' },
  'nyc': { city: 'New York', region: 'New York', country: 'United States', metro: 'New York City Metro Area' },
  'san francisco': { city: 'San Francisco', region: 'California', country: 'United States', metro: 'San Francisco Bay Area' },
  'sf': { city: 'San Francisco', region: 'California', country: 'United States', metro: 'San Francisco Bay Area' },
  'bay area': { region: 'California', country: 'United States', metro: 'San Francisco Bay Area' },
  'los angeles': { city: 'Los Angeles', region: 'California', country: 'United States', metro: 'Greater Los Angeles Area' },
  'la': { city: 'Los Angeles', region: 'California', country: 'United States', metro: 'Greater Los Angeles Area' },
  'seattle': { city: 'Seattle', region: 'Washington', country: 'United States', metro: 'Greater Seattle Area' },
  'boston': { city: 'Boston', region: 'Massachusetts', country: 'United States', metro: 'Greater Boston Area' },
  'chicago': { city: 'Chicago', region: 'Illinois', country: 'United States', metro: 'Greater Chicago Area' },
  'austin': { city: 'Austin', region: 'Texas', country: 'United States', metro: 'Greater Austin Area' },
  'denver': { city: 'Denver', region: 'Colorado', country: 'United States', metro: 'Denver Metro Area' },

  // US States
  'california': { region: 'California', country: 'United States' },
  'texas': { region: 'Texas', country: 'United States' },
  'florida': { region: 'Florida', country: 'United States' },
  'washington': { region: 'Washington', country: 'United States' },

  // Countries
  'usa': { country: 'United States' },
  'united states': { country: 'United States' },
  'canada': { country: 'Canada' },
  'uk': { country: 'United Kingdom' },
  'united kingdom': { country: 'United Kingdom' },
  'germany': { country: 'Germany' },
  'france': { country: 'France' },
  'australia': { country: 'Australia' },
  'india': { country: 'India' },
  'singapore': { country: 'Singapore' }
};

// PDL canonical value mappings
const EXPERIENCE_LEVEL_MAPPING: Record<string, string[]> = {
  'entry': ['entry', 'training'],
  'junior': ['entry', 'training', 'manager'],
  'mid': ['manager', 'senior'],
  'senior': ['senior', 'director'],
  'lead': ['senior', 'director', 'vp'],
  'principal': ['director', 'vp'],
  'staff': ['director', 'vp'],
  'director': ['director', 'vp'],
  'vp': ['vp', 'cxo'],
  'executive': ['cxo'],
  'c-level': ['cxo']
};

const COMPANY_SIZE_MAPPING: Record<string, string[]> = {
  'startup': ['1-10', '11-200'],
  'mid-sized': ['201-500', '501-1000'],
  'medium': ['201-500', '501-1000'],
  'large': ['1001-5000', '5001-10000'],
  'enterprise': ['10001+'],
  'big tech': ['10001+'],
  'fortune 500': ['10001+']
};

const INDUSTRY_MAPPINGS: Record<string, string[]> = {
  'saas': ['computer software', 'internet', 'information technology and services'],
  'fintech': ['financial services', 'banking', 'insurance', 'investment banking'],
  'healthtech': ['hospital & health care', 'medical devices', 'pharmaceuticals'],
  'edtech': ['education management', 'e-learning', 'higher education'],
};

// Enhanced job title expansions for broader matching
const JOB_TITLE_EXPANSIONS: Record<string, Array<{title: string, boost: number}>> = {
  // VP Sales variations
  'vp sales': [
    { title: 'vice president of sales', boost: 1.0 },
    { title: 'vp of sales', boost: 1.0 },
    { title: 'vice president sales', boost: 0.9 },
    { title: 'sales vp', boost: 0.9 },
    { title: 'head of sales', boost: 0.85 },
    { title: 'director of sales', boost: 0.8 },
    { title: 'sales director', boost: 0.8 },
    { title: 'chief revenue officer', boost: 0.75 },
    { title: 'cro', boost: 0.7 },
    { title: 'chief sales officer', boost: 0.7 },
    { title: 'cso', boost: 0.65 },
    { title: 'sales leader', boost: 0.6 },
    { title: 'revenue leader', boost: 0.6 },
    { title: 'sales executive', boost: 0.5 },
    { title: 'business development executive', boost: 0.4 }
  ],
  'vp of sales': [
    { title: 'vice president of sales', boost: 1.0 },
    { title: 'vp of sales', boost: 1.0 },
    { title: 'vice president sales', boost: 0.9 },
    { title: 'sales vp', boost: 0.9 },
    { title: 'head of sales', boost: 0.85 },
    { title: 'director of sales', boost: 0.8 },
    { title: 'sales director', boost: 0.8 },
    { title: 'chief revenue officer', boost: 0.75 },
    { title: 'cro', boost: 0.7 },
    { title: 'chief sales officer', boost: 0.7 },
    { title: 'cso', boost: 0.65 },
    { title: 'sales leader', boost: 0.6 },
    { title: 'revenue leader', boost: 0.6 },
    { title: 'sales executive', boost: 0.5 },
    { title: 'business development executive', boost: 0.4 }
  ],
  // VP Engineering variations
  'vp engineering': [
    { title: 'vp of engineering', boost: 1.0 },
    { title: 'vice president of engineering', boost: 1.0 },
    { title: 'engineering vp', boost: 0.9 },
    { title: 'head of engineering', boost: 0.9 },
    { title: 'director of engineering', boost: 0.8 },
    { title: 'engineering director', boost: 0.8 },
    { title: 'cto', boost: 0.7 }
  ],
  'vp of engineering': [
    { title: 'vp of engineering', boost: 1.0 },
    { title: 'vice president of engineering', boost: 1.0 },
    { title: 'engineering vp', boost: 0.9 },
    { title: 'head of engineering', boost: 0.9 },
    { title: 'director of engineering', boost: 0.8 },
    { title: 'engineering director', boost: 0.8 },
    { title: 'cto', boost: 0.7 }
  ],
  'software engineer': [
    { title: 'software engineer', boost: 10 },
    { title: 'software developer', boost: 9 },
    { title: 'developer', boost: 8 },
    { title: 'programmer', boost: 7 },
    { title: 'engineer', boost: 5 },
    { title: 'full stack developer', boost: 6 }
  ],
  'frontend developer': [
    { title: 'frontend developer', boost: 10 },
    { title: 'front-end developer', boost: 10 },
    { title: 'ui developer', boost: 9 },
    { title: 'react developer', boost: 9 },
    { title: 'javascript developer', boost: 8 },
    { title: 'web developer', boost: 7 },
    { title: 'software engineer', boost: 5 }
  ],
  'backend developer': [
    { title: 'backend developer', boost: 10 },
    { title: 'back-end developer', boost: 10 },
    { title: 'server developer', boost: 9 },
    { title: 'api developer', boost: 9 },
    { title: 'software engineer', boost: 5 }
  ],
  'data scientist': [
    { title: 'data scientist', boost: 10 },
    { title: 'machine learning engineer', boost: 9 },
    { title: 'data analyst', boost: 8 },
    { title: 'ai researcher', boost: 7 },
    { title: 'data engineer', boost: 6 }
  ],
  'product manager': [
    { title: 'product manager', boost: 10 },
    { title: 'senior product manager', boost: 9 },
    { title: 'product owner', boost: 8 },
    { title: 'product lead', boost: 7 }
  ],
  'marketing manager': [
    { title: 'marketing manager', boost: 10 },
    { title: 'digital marketing manager', boost: 9 },
    { title: 'growth manager', boost: 8 },
    { title: 'marketing lead', boost: 7 },
    { title: 'marketing director', boost: 6 }
  ],
  'sales manager': [
    { title: 'sales manager', boost: 10 },
    { title: 'account manager', boost: 9 },
    { title: 'business development manager', boost: 8 },
    { title: 'sales director', boost: 7 }
  ]
};
interface PDLResponse {
  status: number;
  data: PDLPerson[];
  scroll_token?: string;
  total: number;
}

export class PDLService {
  /** Main entry point: convert conversation to optimal single PDL search */
  static async searchFromConversation(conversationData: ConversationData, maxCandidates: number = 1): Promise<Candidate[]> {
    try {
      console.log('Converting conversation data to smart single PDL query:', conversationData);
      const elasticsearchQuery = this.buildComprehensiveQuery(conversationData);
      console.log('Generated PDL query object:', JSON.stringify(elasticsearchQuery, null, 2));
      const validatedQuery = this.validateAndTrimQuery(elasticsearchQuery);
      console.log('Final validated query before sending:', JSON.stringify(validatedQuery, null, 2));

      const response = await this.executeSearchWithRetry(validatedQuery, conversationData, maxCandidates);
      const candidates = this.parseAndScoreResults(response, conversationData);

      if (candidates.length === 0) {
        console.warn('No valid candidates found. Suggestions: broaden location, experience, or industries.');
      } else {
        console.log(`Found ${candidates.length} candidates out of ${response.total} total matches`, candidates);
      }
      return candidates;
    } catch (error) {
      console.error('Error in searchFromConversation:', error);
      throw new Error('Failed to search candidates from conversation data');
    }
  }

  /** Retry wrapper for search */
  private static async executeSearchWithRetry(query: object, data: ConversationData, maxCandidates: number, retries: number = 3): Promise<PDLResponse> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.executeSearch(query, data, maxCandidates);
      } catch (error: any) {
        if (error.message?.includes('429') && i < retries - 1) {
          const backoffDelay = (i + 1) * 1000;
          console.warn(`Rate limited (429). Attempt ${i+1}/${retries}. Retrying in ${backoffDelay}ms...`);
          await new Promise(r => setTimeout(r, backoffDelay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded for PDL API request');
  }

  /** Validate and trim oversized queries */
  private static validateAndTrimQuery(query: any, maxClauses: number = 100): any {
    const validatedQuery = JSON.parse(JSON.stringify(query));
    const boolNode = validatedQuery.query?.bool ?? validatedQuery.bool;
    if (boolNode?.should && boolNode.should.length > maxClauses) {
      boolNode.should = boolNode.should.slice(0, maxClauses);
    }
    if (boolNode?.must && boolNode.must.length > maxClauses) {
      boolNode.must = boolNode.must.slice(0, maxClauses);
    }
    return validatedQuery;
  }

  /** Build full query */
  private static buildComprehensiveQuery(data: ConversationData): object {
    const must: any[] = [];
    const should: any[] = [];
    const filter: any[] = [];
    const must_not: any[] = [];

    // --- 1) REQUIRED TITLE (variations allowed via inner should) ---
    const titleText = (data.outreach_type === 'recruiting' ? data.role_title : data.buyer_title)?.trim();
    const normalizedTitle = data.normalized_title?.trim();
    
    if (normalizedTitle || titleText) {
      const titleClauses = [];
      
      // Add normalized title if available
      if (normalizedTitle) {
        titleClauses.push({ match_phrase: { job_title: normalizedTitle } });
        titleClauses.push({ match: { job_title: normalizedTitle } });
      }
      
      // Add title variants if available
      if (Array.isArray(data.title_variants) && data.title_variants.length > 0) {
        data.title_variants.forEach((variant: string) => {
          const cleanVariant = variant?.trim();
          if (cleanVariant) {
            titleClauses.push({ match_phrase: { job_title: cleanVariant } });
            titleClauses.push({ match: { job_title: cleanVariant } });
          }
        });
      }
      
      // Fall back to original role_title if no other titles were added
      if (titleClauses.length === 0 && titleText) {
        titleClauses.push({ match_phrase: { job_title: titleText } });
        titleClauses.push({ match: { job_title: titleText } });
      }
      
      // Only add the title query if we have any title clauses
      if (titleClauses.length > 0) {
        must.push({ bool: { should: titleClauses } });
      }
    }

    // --- 2) REQUIRED GEO ANCHOR (country/region -> filter; city/metro -> should) ---
    if (data.location && !this.isRemoteLocation(data.location)) {
      const L = this.normalizeLocation(data.location);
      if (L.country) filter.push({ term: { location_country: L.country } });
      if (L.region)  filter.push({ term: { location_region:  L.region  } });
      if (L.metro)   should.push({ match: { location_metro:    L.metro } });
      if (L.city)    should.push({ match: { location_locality: L.city  } });
    }

    // --- 3) REQUIRED SENIORITY IF SPECIFIED OR IMPLIED ---
    if (data.experience_level) {
      const levels = EXPERIENCE_LEVEL_MAPPING[data.experience_level.toLowerCase()];
      if (levels?.length) filter.push({ terms: { job_title_levels: levels } });
    } else if (normalizedTitle || titleText) {
      const lower = (normalizedTitle || titleText)!.toLowerCase();
      // if title implies leadership, require senior bands
      if (/(vp|chief|cto|director|head)/.test(lower)) {
        filter.push({ terms: { job_title_levels: ['director','vp','cxo','manager'] } });
      }
    }

    // Optional: if title strongly implies engineering leadership, keep People/HR out
    if (titleText && /\b(engineer|engineering|cto|vp of engineering|vp engineering|head of engineering)\b/i.test(titleText)) {
      must_not.push({ term: { job_title_role: 'human resources' } });
      // If you know PDL populates this field well, also anchor role to engineering:
      // filter.push({ term: { job_title_role: 'engineering' } });
    }

    // --- 4) COMPANY SIZE FILTERING ---
    const impliesStartup =
      (data.company_size?.toLowerCase().includes('startup')) ||
      (data.industry?.toLowerCase()?.includes('startup')) ||
      (titleText?.toLowerCase()?.includes('startup'));
    if (impliesStartup) {
      filter.push({ terms: { job_company_size: ['1-10','11-50','51-200'] } });
    } else if (data.company_size) {
      const companySizes = COMPANY_SIZE_MAPPING[data.company_size.toLowerCase()];
      if (companySizes?.length) {
        filter.push({ terms: { job_company_size: companySizes } });
      }
    }

    // --- 5) INDUSTRY MAPPING ---
    if (data.industry) {
      const cleanIndustry = data.industry.toLowerCase().trim();
      const mappedIndustries = INDUSTRY_MAPPINGS[cleanIndustry] || [cleanIndustry];
      const uniqueIndustries = [...new Set(mappedIndustries
        .filter(v => v && v.toLowerCase() !== 'ai')
        .map(v => v.toLowerCase())
      )];
      
      uniqueIndustries.forEach(industry => {
        should.push({ match: { job_company_industry: industry } });
      });
    }

    // No broad fallbacks in pass 1
    return { query: { bool: { must, filter, should, must_not } } };
  }

  /** Build graduated job title query with multiple boost levels */
  private static buildGraduatedJobTitleQuery(title: string, context: 'recruiting' | 'sales'): any[] {
    const cleanTitle = title.toLowerCase().trim();
    const titleClauses: any[] = [];

    const expansions = this.getJobTitleExpansions(cleanTitle);
    expansions.forEach(({ title: expandedTitle }) => {
      titleClauses.push({ match_phrase: { job_title: expandedTitle } });
      titleClauses.push({ match: { job_title: expandedTitle } });
    });

    if (context === 'sales') {
      const seniorityTerms = ['director', 'vp', 'head', 'chief', 'manager', 'lead'];
      seniorityTerms.forEach(term => {
        if (cleanTitle.includes(term)) {
          titleClauses.push({ match: { job_title: term } });
        }
      });
    }
    return titleClauses;
  }

  /** Build graduated skills query */
  private static buildGraduatedSkillsQuery(skillsString: string): any[] {
    if (!skillsString?.trim()) return [];
    const skills = skillsString
      .split(/[,&]|\sand\s/)
      .map(skill => skill.trim().toLowerCase())
      .filter(skill => skill.length > 1);

    if (skills.length === 0) return [];
    return skills.map(skill => ({ match: { skills: skill } }));
  }

  /** Build graduated experience level query */
  private static buildGraduatedExperienceQuery(level: string): any[] {
    const cleanLevel = level.toLowerCase().trim();
    const mappedLevels = EXPERIENCE_LEVEL_MAPPING[cleanLevel];
    if (!mappedLevels) return [];
    return [{ terms: { job_title_levels: mappedLevels, boost: 5 } }];
  }

  /** Build graduated company size query */
  private static buildGraduatedCompanySizeQuery(sizeString: string): any[] {
    const cleanSize = sizeString.toLowerCase().trim();
    const clauses: any[] = [];

    const mappedSizes = COMPANY_SIZE_MAPPING[cleanSize];
    if (mappedSizes) {
      clauses.push({ terms: { job_company_size: mappedSizes, boost: 5 } });
    }

    const numberMatch = sizeString.match(/(\d+)[-\s]*(\d+)?/);
    if (numberMatch) {
      const min = parseInt(numberMatch[1]);
      const max = numberMatch[2] ? parseInt(numberMatch[2]) : min * 10;
      const sizeRanges = this.getSizeRangesForNumbers(min, max);
      if (sizeRanges.length > 0) {
        clauses.push({ terms: { job_company_size: sizeRanges, boost: 5 } });
      }
    }
    return clauses;
  }

  /** Build graduated industry query */
  private static buildGraduatedIndustryQuery(industryString: string): any[] {
    if (!industryString) return [];
    const cleanIndustry = industryString.toLowerCase().trim();
    const industryClauses: any[] = [];
    const seenIndustries = new Set<string>();

    const mappedIndustries = INDUSTRY_MAPPINGS[cleanIndustry] || [];
    mappedIndustries.forEach(industry => {
      const normalizedIndustry = industry.toLowerCase().trim();
      if (normalizedIndustry && !seenIndustries.has(normalizedIndustry) && normalizedIndustry !== 'ai') {
        seenIndustries.add(normalizedIndustry);
        industryClauses.push({ match: { job_company_industry: normalizedIndustry } });
      }
    });

    if (cleanIndustry && cleanIndustry !== 'ai' && !seenIndustries.has(cleanIndustry)) {
      industryClauses.push({ match: { job_company_industry: cleanIndustry } });
    }

    if (
      cleanIndustry.includes('tech') ||
      cleanIndustry.includes('software') ||
      cleanIndustry.includes('saas') ||
      cleanIndustry.includes('ai') ||
      cleanIndustry.includes('artificial intelligence')
    ) {
      const broaderTerms = [
        'technology',
        'information technology',
        'it services',
        'computer software',
        'internet',
        'saas',
        'cloud computing',
        'artificial intelligence',
        'machine learning',
        'data science',
        'big data',
        'analytics'
      ];
      broaderTerms.forEach(term => {
        if (!seenIndustries.has(term)) {
          seenIndustries.add(term);
          industryClauses.push({ match: { job_company_industry: term } });
        }
      });
    }

    return industryClauses;
  }
  /** Normalize location */
  private static normalizeLocation(locationString: string): { city?: string; region?: string; country?: string; metro?: string } {
    if (!locationString) return {};
    const cleanLocation = locationString.toLowerCase().trim();

    if (LOCATION_NORMALIZATION[cleanLocation]) {
      return { ...LOCATION_NORMALIZATION[cleanLocation] };
    }

    for (const [key, value] of Object.entries(LOCATION_NORMALIZATION)) {
      if (cleanLocation.includes(key)) {
        return { ...value };
      }
    }

    return { city: locationString.trim() };
  }

  /** Build graduated location query */
  private static buildGraduatedLocationQuery(locationString: string): any[] {
    if (!locationString) return [];
    const normalized = this.normalizeLocation(locationString);
    const locationClauses: any[] = [];

    if (normalized.metro) locationClauses.push({ match: { location_metro: normalized.metro } });
    if (normalized.city && normalized.region) {
      locationClauses.push({
        bool: {
          must: [
            { match: { location_locality: normalized.city } },
            { match: { location_region: normalized.region } }
          ]
        }
      });
    }
    if (normalized.city) locationClauses.push({ match: { location_locality: normalized.city } });
    if (normalized.region) locationClauses.push({ match: { location_region: normalized.region } });
    if (normalized.country) locationClauses.push({ match: { location_country: normalized.country } });
    if (locationClauses.length === 0) {
      locationClauses.push({ match: { location_name: locationString } });
    }
    return locationClauses;
  }

  /** Build pain point query */
  private static buildGraduatedPainPointQuery(painPoint: string): any[] {
    const keyTerms = painPoint.toLowerCase().split(/\s+/).filter(term => term.length > 3).slice(0, 5);
    if (keyTerms.length === 0) return [];
    return keyTerms.map(term => ({ match: { job_company_industry: term } }));
  }

  /** Build broad fallback clauses */
  private static buildFallbackClauses(data: ConversationData): any[] {
    const fallbackClauses: any[] = [];
    const seenIndustries = new Set<string>();

    if (data.industry) {
      const cleanIndustry = data.industry.toLowerCase().trim();
      const mappedIndustries = INDUSTRY_MAPPINGS[cleanIndustry] || [];
      mappedIndustries.forEach(industry => {
        const normalizedIndustry = industry.toLowerCase().trim();
        if (normalizedIndustry && normalizedIndustry !== 'ai' && !seenIndustries.has(normalizedIndustry)) {
          seenIndustries.add(normalizedIndustry);
          fallbackClauses.push({ match: { job_company_industry: normalizedIndustry } });
        }
      });
      if (cleanIndustry && cleanIndustry !== 'ai' && !seenIndustries.has(cleanIndustry)) {
        fallbackClauses.push({ match: { job_company_industry: cleanIndustry } });
      }
    }

    if (data.outreach_type === 'recruiting') {
      fallbackClauses.push(
        { match: { job_company_industry: 'computer software' } },
        { match: { job_company_industry: 'information technology' } }
      );
    }

    if (data.outreach_type === 'sales') {
      fallbackClauses.push({ terms: { job_title_levels: ['manager', 'director', 'vp', 'cxo'] } });
    }
    return fallbackClauses;
  }

  /** Remote detection */
  private static isRemoteLocation(location: string): boolean {
    const cleanLocation = location.toLowerCase().trim();
    return cleanLocation.includes('remote') || cleanLocation.includes('global') || cleanLocation.includes('anywhere');
  }

  /** Execute API call */
  private static async executeSearch(query: any, data: ConversationData, maxCandidates: number): Promise<PDLResponse> {
    const startTime = Date.now();
    if (!PDL_API_KEY) throw new Error('PDL_API_KEY is not set');

    const requestBody = {
      ...query,
      size: Math.min(maxCandidates, 100),
      data_include:
        'first_name,full_name,work_email,job_title,job_company_name,job_company_size,job_company_industry,linkedin_url,location_name,skills,inferred_years_experience',
      titlecase: true
    };

    const url = `${PDL_API_BASE_URL}/person/search`;
    console.log(`[PDL] Sending request to ${url}`, { 
      querySummary: { 
        size: requestBody.size,
        hasQuery: !!query.query,
        hasFilter: !!query.query?.bool?.filter
      },
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Api-Key': PDL_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PDL] API request failed:', {
          status: response.status,
          statusText: response.statusText,
          url,
          error: errorText,
          timestamp: new Date().toISOString()
        });
        throw new Error(`PDL API request failed: ${response.status} - ${response.statusText}`);
      }

      const data_response: PDLResponse = await response.json();
      if (!data_response || data_response.status !== 200) {
        console.error('[PDL] API response error:', {
          response: data_response,
          url,
          timestamp: new Date().toISOString()
        });
        throw new Error(`PDL API error: ${JSON.stringify(data_response)}`);
      }

      console.log(`[PDL] API call successful in ${Date.now() - startTime}ms, ${data_response.total} results`);
      return data_response;
    } catch (error: any) {
      console.error('[PDL] Fatal error in executeSearch:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        cause: error?.cause,
        code: error?.code,
        url,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /** Normalize skills input to string array */
  private static normalizeSkills(input: SkillsLike): string[] {
    if (Array.isArray(input)) {
      return input.filter((s): s is string => Boolean(s));
    }
    if (typeof input === 'string') {
      return input
        .split(/[,&]|\sand\s/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  /** Parse and score results */
  private static parseAndScoreResults(response: PDLResponse, conversationData: ConversationData): Candidate[] {
    if (!response.data || response.data.length === 0) return [];
    const candidates: Candidate[] = [];

    for (const person of response.data) {
      if (!(person.first_name || person.full_name)) continue;
      const safeFirst = person.first_name || (person.full_name ? String(person.full_name).split(/\s+/)[0] : '');

      const candidate: Candidate = {
        id: person.id,
        first_name: safeFirst,
        full_name: person.full_name || safeFirst,
        work_email: person.work_email || undefined,
        job_title: person.job_title,
        job_company_name: person.job_company_name,
        job_company_size: person.job_company_size,
        job_company_industry: person.job_company_industry,
        linkedin_url: person.linkedin_url,
        location_name: person.location_name,
        skills: this.normalizeSkills(person.skills),
        experience_years: person.inferred_years_experience,
        relevance_score: this.calculateRelevanceScore(person, conversationData)
      };
      candidates.push(candidate);
    }

    candidates.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    return candidates;
  }

  /** Relevance scoring */
  private static calculateRelevanceScore(person: any, data: ConversationData): number {
    let score = 0;
    const targetTitle = data.outreach_type === 'recruiting' ? data.role_title : data.buyer_title;

    if (targetTitle && person.job_title) {
      score += this.calculateTitleSimilarity(person.job_title, targetTitle) * 40;
    }
    if (data.outreach_type === 'recruiting') {
      score += this.calculateSkillsMatch(person.skills, data.skills) * 30;
    }
    if (data.company_size && person.job_company_size) {
      score += this.calculateSizeMatch(person.job_company_size, data.company_size) * 15;
    }
    if (data.industry && person.job_company_industry) {
      score += this.calculateIndustryMatch(person.job_company_industry, data.industry) * 15;
    }
    return Math.round(score);
  }

  private static calculateTitleSimilarity(personTitle: string, targetTitle: string): number {
    const person = personTitle.toLowerCase();
    const target = targetTitle.toLowerCase();
    if (person === target) return 1.0;
    if (person.includes(target) || target.includes(person)) return 0.8;
    const personWords = person.split(/\s+/);
    const targetWords = target.split(/\s+/);
    const commonWords = personWords.filter(word => targetWords.includes(word));
    return commonWords.length / Math.max(personWords.length, targetWords.length);
  }

  private static calculateSkillsMatch(
    personSkills: SkillsLike,
    targetSkills: SkillsLike
  ): number {
    const personLower = this.normalizeSkills(personSkills).map((s: string) => s.toLowerCase());
    if (personLower.length === 0) return 0;

    const targetLower = this.normalizeSkills(targetSkills).map((s: string) => s.toLowerCase());
    if (targetLower.length === 0) return 0;

    const matches = targetLower.filter((skill: string) =>
      personLower.some((p: string) => p.includes(skill) || skill.includes(p))
    );

    return matches.length / targetLower.length;
  }

  private static calculateSizeMatch(personSize: string, targetSize: string): number {
    return personSize.toLowerCase().includes(targetSize.toLowerCase()) ? 1.0 : 0.0;
  }

  private static calculateIndustryMatch(personIndustry: string, targetIndustry: string): number {
    const person = personIndustry.toLowerCase();
    const target = targetIndustry.toLowerCase();
    if (person.includes(target) || target.includes(person)) return 1.0;
    const mappedIndustries = INDUSTRY_MAPPINGS[target];
    if (mappedIndustries && mappedIndustries.some(industry => person.includes(industry.toLowerCase()))) {
      return 0.8;
    }
    return 0.0;
  }
  /** Helpers */
  private static getJobTitleExpansions(title: string): Array<{ title: string; boost: number }> {
    if (!title) return [];
    const cleanTitle = title.toLowerCase().trim();
    const exactMatch = JOB_TITLE_EXPANSIONS[cleanTitle];
    if (exactMatch) return exactMatch;

    const normalizedKey = cleanTitle
      .replace(/\bof\b/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return JOB_TITLE_EXPANSIONS[normalizedKey] || [{ title, boost: 10 }];
  }

  private static getSizeRangesForNumbers(min: number, max: number): string[] {
    const ranges: string[] = [];
    if (min <= 10) ranges.push('1-10');
    if (min <= 50 && max >= 11) ranges.push('11-50');
    if (min <= 200 && max >= 51) ranges.push('51-200');
    if (min <= 500 && max >= 201) ranges.push('201-500');
    if (min <= 1000 && max >= 501) ranges.push('501-1000');
    if (min <= 5000 && max >= 1001) ranges.push('1001-5000');
    if (min <= 10000 && max >= 5001) ranges.push('5001-10000');
    if (max > 10000) ranges.push('10001+');
    return ranges;
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /** Test connection */
  static async testConnection(): Promise<boolean> {
    try {
      const testQuery = { query: { bool: { must: [{ match: { job_title: 'engineer' } }] } } };
      const response = await this.executeSearchWithRetry(testQuery, { outreach_type: 'recruiting' } as ConversationData, 1);
      console.log(`PDL connection test successful. Found ${response.total} records.`);
      return true;
    } catch (error) {
      console.error('PDL connection test failed:', error);
      return false;
    }
  }
}
