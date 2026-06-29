/**
 * Utility functions for formatting names consistently
 */

/**
 * Capitalizes the first letter of each word in a name
 * Handles edge cases like hyphenated names, apostrophes, etc.
 */
export const capitalizeNames = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return word;
      
      // Handle hyphenated names (e.g., "mary-jane" -> "Mary-Jane")
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('-');
      }
      
      // Handle names with apostrophes (e.g., "o'connor" -> "O'Connor")
      if (word.includes("'")) {
        return word
          .split("'")
          .map((part, index) => {
            if (index === 0) {
              return part.charAt(0).toUpperCase() + part.slice(1);
            }
            // Handle cases like O'Connor, D'Angelo
            return part.charAt(0).toUpperCase() + part.slice(1);
          })
          .join("'");
      }
      
      // Regular capitalization
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .trim();
};

/**
 * Formats a full name by capitalizing properly
 */
export const formatCustomerName = (name: string): string => {
  return capitalizeNames(name);
};

/**
 * Validates and formats name input in real-time
 */
export const formatNameInput = (value: string): string => {
  // Allow typing but don't auto-capitalize while typing
  // This will be applied on blur or save
  return value;
};