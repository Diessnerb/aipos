/**
 * UK Phone Number Utilities
 * Handles normalization, validation, and formatting of UK phone numbers
 */

/**
 * Normalizes UK phone number to 11-digit format with no spaces
 * @param phone - Input phone number in any format
 * @returns 11-digit UK phone number or empty string if invalid
 */
export function normalizeUKPhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Convert +44 or 44 to 0
  if (cleaned.startsWith('44')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  // Must be exactly 11 digits starting with 07, 01, or 02
  if (cleaned.length === 11 && /^0[127]/.test(cleaned)) {
    return cleaned;
  }
  
  // Invalid UK phone - return empty string
  return '';
}

/**
 * Validates if a phone number is a valid UK number
 * @param phone - Phone number to validate
 * @returns true if valid UK phone number
 */
export function validateUKPhone(phone: string): boolean {
  const normalized = normalizeUKPhone(phone);
  
  if (normalized.length !== 11) return false;
  
  // Check if it starts with valid UK prefixes
  return (
    normalized.startsWith('07') ||  // Mobile
    normalized.startsWith('01') ||  // Geographic landline
    normalized.startsWith('02')     // Geographic landline
  );
}

/**
 * Formats phone number for display with spaces (UI only - never store this format)
 * @param phone - Phone number to format
 * @returns Formatted phone number with spaces for readability
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizeUKPhone(phone);
  
  if (!normalized || normalized.length !== 11) {
    return phone; // Return original if can't normalize
  }
  
  // Format mobile numbers: 07700 123 456
  if (normalized.startsWith('07')) {
    return `${normalized.substring(0, 5)} ${normalized.substring(5, 8)} ${normalized.substring(8)}`;
  }
  
  // Format landline numbers: 01234 567 890 or 020 1234 5678
  if (normalized.startsWith('01')) {
    return `${normalized.substring(0, 5)} ${normalized.substring(5, 8)} ${normalized.substring(8)}`;
  }
  
  if (normalized.startsWith('02')) {
    return `${normalized.substring(0, 3)} ${normalized.substring(3, 7)} ${normalized.substring(7)}`;
  }
  
  return normalized;
}

/**
 * Gets a user-friendly error message for invalid phone numbers
 * @param phone - Phone number that failed validation
 * @returns Error message explaining the issue
 */
export function getPhoneValidationError(phone: string): string {
  if (!phone || phone.trim() === '') {
    return 'Phone number is required';
  }
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 10) {
    return 'Phone number is too short';
  }
  
  if (digits.length > 13) {
    return 'Phone number is too long';
  }
  
  if (!validateUKPhone(phone)) {
    return 'Please enter a valid UK phone number (07xxx, 01xxx, or 02xxx)';
  }
  
  return '';
}