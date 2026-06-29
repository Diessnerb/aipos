// Defensive programming utilities to prevent data corruption and undefined states

export const validateCompanyId = (companyId: string | null | undefined, context: string): string => {
  if (!companyId || companyId === 'undefined' || companyId === 'null') {
    console.error(`🚨 CRITICAL: Invalid company ID in ${context}:`, companyId);
    throw new Error(`Invalid company access. Please re-authenticate.`);
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(companyId)) {
    console.error(`🚨 CRITICAL: Invalid company ID format in ${context}:`, companyId);
    throw new Error(`Invalid company access. Please re-authenticate.`);
  }
  
  return companyId;
};

export const validateAuthContext = (
  user: any, 
  pinUser: any, 
  companyId: string | null | undefined,
  context: string
): { validCompanyId: string; isPinMode: boolean } => {
  // Check if pinUser is invalid (missing required fields)
  const isInvalidPinUser = pinUser && (!pinUser.user_id || !pinUser.company_id);
  
  // If we have a valid Supabase user session AND invalid pinUser, ignore the pinUser
  // (This handles the transition period after owner login when pinUser might be stale)
  if (user && isInvalidPinUser) {
    console.warn(`⚠️ Ignoring incomplete PIN user in ${context}, using Supabase auth`);
    pinUser = null; // Treat as non-PIN mode
  }
  
  // Must have either user or valid pinUser authentication
  if (!user && !pinUser) {
    console.error(`🚨 CRITICAL: No authentication in ${context}`);
    throw new Error('No authentication found. Please log in.');
  }
  
  // If no Supabase user but invalid pinUser, that's a real error
  if (!user && isInvalidPinUser) {
    console.error(`🚨 CRITICAL: Invalid PIN user in ${context}:`, pinUser);
    throw new Error('PIN authentication corrupted. Please log in again.');
  }
  
  // Must have a valid company ID
  const validCompanyId = validateCompanyId(companyId, context);
  
  return {
    validCompanyId,
    isPinMode: !!pinUser
  };
};

export const createSafeQuery = (baseQuery: any, companyId: string | null | undefined, context: string) => {
  const validCompanyId = validateCompanyId(companyId, context);
  return baseQuery.eq('company_id', validCompanyId);
};

export const logDataAccess = (operation: string, table: string, companyId: string, result: any) => {
  console.log(`📊 DATA ACCESS: ${operation} on ${table} for company ${companyId}:`, {
    success: !result.error,
    recordCount: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0),
    error: result.error?.message
  });
};