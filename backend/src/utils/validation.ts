import { ConversationData, ValidationError, ValidationResult } from '../services/queueTypes';

/**
 * Validates outreach data for campaign creation based on outreach type
 */
export function validateConversationData(data: Partial<ConversationData>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate base required fields explicitly
  if (!data.outreach_type || (typeof data.outreach_type === 'string' && !data.outreach_type.trim())) {
    errors.push({
      field: 'outreach_type',
      code: 'REQUIRED_FIELD',
      message: 'Outreach type is required',
      received: data.outreach_type
    });
  }

  if (!data.user_title || (typeof data.user_title === 'string' && !data.user_title.trim())) {
    errors.push({
      field: 'user_title',
      code: 'REQUIRED_FIELD',
      message: 'User title is required',
      received: data.user_title
    });
  }

  if (!data.user_company || (typeof data.user_company === 'string' && !data.user_company.trim())) {
    errors.push({
      field: 'user_company',
      code: 'REQUIRED_FIELD',
      message: 'User company is required',
      received: data.user_company
    });
  }

  if (!data.user_mission || (typeof data.user_mission === 'string' && !data.user_mission.trim())) {
    errors.push({
      field: 'user_mission',
      code: 'REQUIRED_FIELD',
      message: 'User mission is required',
      received: data.user_mission
    });
  }

  // Validate outreach type
  const validOutreachTypes = ['sales', 'recruiting'];
  if (!data.outreach_type || !validOutreachTypes.includes(data.outreach_type)) {
    errors.push({
      field: 'outreach_type',
      code: 'INVALID_VALUE',
      message: 'Outreach type must be either "sales" or "recruiting"',
      received: data.outreach_type
    });
  }

  // Validate recruiting-specific fields if outreach_type is recruiting
  if (data.outreach_type === 'recruiting') {
    if (!data.role_title || (typeof data.role_title === 'string' && !data.role_title.trim())) {
      errors.push({
        field: 'role_title',
        code: 'REQUIRED_FIELD',
        message: 'Role title is required for recruiting outreach',
        received: data.role_title
      });
    }

    let hasValidSkills = false;
    if (Array.isArray(data.skills)) {
      hasValidSkills = data.skills.length > 0 && 
                     data.skills.every((skill: string | unknown) => {
                       if (typeof skill !== 'string') return false;
                       return skill.trim().length > 0;
                     });
    } else if (typeof data.skills === 'string') {
      hasValidSkills = (data.skills as string).trim().length > 0;
    }

    if (!hasValidSkills) {
      errors.push({
        field: 'skills',
        code: 'REQUIRED_FIELD',
        message: 'At least one skill is required for recruiting outreach',
        received: data.skills
      });
    }

    if (!data.experience_level || !['junior', 'mid', 'senior', 'lead'].includes(data.experience_level)) {
      errors.push({
        field: 'experience_level',
        code: 'REQUIRED_FIELD',
        message: 'Experience level is required for recruiting outreach and must be one of: junior, mid, senior, lead',
        received: data.experience_level
      });
    }
  }

  // Validate sales-specific fields if outreach_type is sales
  if (data.outreach_type === 'sales') {
    if (!data.buyer_title || (typeof data.buyer_title === 'string' && !data.buyer_title.trim())) {
      errors.push({
        field: 'buyer_title',
        code: 'REQUIRED_FIELD',
        message: 'Buyer title is required for sales outreach',
        received: data.buyer_title
      });
    }

    if (!data.pain_point || (typeof data.pain_point === 'string' && !data.pain_point.trim())) {
      errors.push({
        field: 'pain_point',
        code: 'REQUIRED_FIELD',
        message: 'Pain point is required for sales outreach',
        received: data.pain_point
      });
    }
  }

  // Validate shared fields
  if (data.outreach_type) {
    if (!data.company_size || (typeof data.company_size === 'string' && !data.company_size.trim())) {
      errors.push({
        field: 'company_size',
        code: 'REQUIRED_FIELD',
        message: 'Company size is required for outreach',
        received: data.company_size
      });
    }

    if (!data.industry || (typeof data.industry === 'string' && !data.industry.trim())) {
      errors.push({
        field: 'industry',
        code: 'REQUIRED_FIELD',
        message: 'Industry is required for outreach',
        received: data.industry
      });
    }

    if (!data.location || (typeof data.location === 'string' && !data.location.trim())) {
      errors.push({
        field: 'location',
        code: 'REQUIRED_FIELD',
        message: 'Location is required for outreach',
        received: data.location
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates if the experience level is one of the allowed values
 */
function isValidExperienceLevel(level: string): level is 'junior' | 'mid' | 'senior' | 'lead' {
  return ['junior', 'mid', 'senior', 'lead'].includes(level);
}

/**
 * Validates the complete campaign creation request
 */
export function validateCampaignRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Check required top-level fields
  if (!data.conversationData) {
    errors.push({
      field: 'conversationData',
      code: 'REQUIRED_FIELD',
      message: 'conversationData is required',
      received: data.conversationData
    });
    
    return { isValid: false, errors };
  }

  // Validate conversation data
  const conversationValidation = validateConversationData(data.conversationData);
  
  // Validate name if provided
  if (data.name && typeof data.name !== 'string') {
    errors.push({
      field: 'name',
      code: 'INVALID_TYPE',
      message: 'Name must be a string',
      received: typeof data.name
    });
  }

  return {
    isValid: conversationValidation.isValid && errors.length === 0,
    errors: [...errors, ...conversationValidation.errors]
  };
}

/**
 * Formats validation errors for API responses
 */
export function formatValidationErrors(errors: ValidationError[]) {
  return {
    error: 'VALIDATION_ERROR',
    message: 'One or more validation errors occurred',
    details: errors
  };
}
