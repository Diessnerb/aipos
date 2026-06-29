import { useCompanyLocation } from '@/hooks/useCompanyLocation';

// Currency mapping based on country/location
const CURRENCY_MAP: Record<string, { code: string; symbol: string; locale: string }> = {
  'GB': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'UK': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'United Kingdom': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'England': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'Scotland': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'Wales': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'Northern Ireland': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'US': { code: 'USD', symbol: '$', locale: 'en-US' },
  'USA': { code: 'USD', symbol: '$', locale: 'en-US' },
  'United States': { code: 'USD', symbol: '$', locale: 'en-US' },
  'CA': { code: 'CAD', symbol: '$', locale: 'en-CA' },
  'Canada': { code: 'CAD', symbol: '$', locale: 'en-CA' },
  'AU': { code: 'AUD', symbol: '$', locale: 'en-AU' },
  'Australia': { code: 'AUD', symbol: '$', locale: 'en-AU' },
  'FR': { code: 'EUR', symbol: '€', locale: 'fr-FR' },
  'France': { code: 'EUR', symbol: '€', locale: 'fr-FR' },
  'DE': { code: 'EUR', symbol: '€', locale: 'de-DE' },
  'Germany': { code: 'EUR', symbol: '€', locale: 'de-DE' },
  'ES': { code: 'EUR', symbol: '€', locale: 'es-ES' },
  'Spain': { code: 'EUR', symbol: '€', locale: 'es-ES' },
  'IT': { code: 'EUR', symbol: '€', locale: 'it-IT' },
  'Italy': { code: 'EUR', symbol: '€', locale: 'it-IT' },
};

// Default to GBP for fallback
const DEFAULT_CURRENCY = { code: 'GBP', symbol: '£', locale: 'en-GB' };

/**
 * Determines currency settings based on company location
 */
export const getCurrencyFromLocation = (location?: any) => {
  if (!location?.country) {
    return DEFAULT_CURRENCY;
  }

  // Check for exact matches first
  const exactMatch = CURRENCY_MAP[location.country];
  if (exactMatch) {
    return exactMatch;
  }

  // Check for partial matches in country name
  const countryLower = location.country.toLowerCase();
  for (const [key, currency] of Object.entries(CURRENCY_MAP)) {
    if (countryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(countryLower)) {
      return currency;
    }
  }

  // If address contains UK indicators, default to GBP
  const address = location.address?.toLowerCase() || '';
  const postcode = location.postcode?.toLowerCase() || '';
  
  if (address.includes('uk') || address.includes('britain') || address.includes('england') || 
      postcode.match(/^[a-z]{1,2}\d{1,2}[a-z]?\s?\d[a-z]{2}$/i)) {
    return DEFAULT_CURRENCY;
  }

  return DEFAULT_CURRENCY;
};

/**
 * Formats currency based on company location
 */
export const formatCurrency = (amount: number, location?: any): string => {
  const currency = getCurrencyFromLocation(location);
  
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to manual formatting if Intl fails
    return `${currency.symbol}${amount.toFixed(2)}`;
  }
};

/**
 * Get just the currency symbol based on location
 */
export const getCurrencySymbol = (location?: any): string => {
  const currency = getCurrencyFromLocation(location);
  return currency.symbol;
};

/**
 * React hook for currency formatting
 */
export const useCurrencyFormatter = () => {
  const { location } = useCompanyLocation();
  
  const formatAmount = (amount: number): string => {
    return formatCurrency(amount, location);
  };

  const getSymbol = (): string => {
    return getCurrencySymbol(location);
  };

  return {
    formatCurrency: formatAmount,
    getCurrencySymbol: getSymbol,
    currencyCode: getCurrencyFromLocation(location).code,
    locale: getCurrencyFromLocation(location).locale,
  };
};