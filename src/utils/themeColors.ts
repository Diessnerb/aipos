// Utility to resolve CSS variables to actual color values for Canvas API
export const getThemeColor = (cssVariable: string): string => {
  if (typeof window === 'undefined') return '#000000';
  
  // Get the computed style from the document root
  const style = getComputedStyle(document.documentElement);
  
  // Extract the variable name from the CSS variable syntax
  const variableName = cssVariable.match(/var\((--[^)]+)\)/)?.[1];
  
  if (!variableName) {
    // If it's not a CSS variable, return as is
    return cssVariable;
  }
  
  // Get the HSL values from the CSS variable
  const hslValues = style.getPropertyValue(variableName).trim();
  
  if (!hslValues) {
    console.warn(`CSS variable ${variableName} not found, using fallback`);
    return '#666666'; // Fallback color
  }
  
  // Normalize HSL values to comma-separated format for Canvas compatibility
  const hslComma = hslValues.includes(',') ? hslValues : hslValues.replace(/\s+/g, ', ');
  return `hsl(${hslComma})`;
};

// Pre-resolved theme colors for common canvas operations
export const getCanvasThemeColors = () => ({
  background: getThemeColor('var(--background)'),
  foreground: getThemeColor('var(--foreground)'),
  muted: getThemeColor('var(--muted)'),
  mutedForeground: getThemeColor('var(--muted-foreground)'),
  border: getThemeColor('var(--border)'),
  primary: getThemeColor('var(--primary)'),
  primaryForeground: getThemeColor('var(--primary-foreground)'),
  secondary: getThemeColor('var(--secondary)'),
  destructive: getThemeColor('var(--destructive)'),
});