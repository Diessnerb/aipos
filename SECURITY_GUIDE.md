# Company Data Isolation Security Guide

## Overview

This application uses **Row-Level Security (RLS)** to ensure complete data isolation between companies. No user can access data from a company they don't belong to.

## Security Architecture

### 1. Centralized Security Function

All RLS policies use the `allowed_company_ids_for_current_user()` function:

```sql
CREATE OR REPLACE FUNCTION public.allowed_company_ids_for_current_user()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Return company_id from users table for authenticated users
  SELECT u.company_id 
  FROM users u 
  WHERE u.auth_user_id = auth.uid()
  
  UNION
  
  -- Return company_id for company admins logging in with default email
  SELECT c.id 
  FROM companies c 
  WHERE c.default_admin_email IN (
    SELECT au.email 
    FROM auth.users au 
    WHERE au.id = auth.uid()
  );
$$;
```

**Why this is secure:**
- `SECURITY DEFINER` allows it to read from users/companies tables without triggering recursive RLS
- `SET search_path = public` prevents schema poisoning attacks
- Returns ONLY the companies the current user has access to

### 2. Standard RLS Policy Pattern

Every table with company-sensitive data should follow this pattern:

```sql
-- Example for a table with company_id column
CREATE POLICY "company_isolation"
ON public.your_table_name
FOR ALL
TO public
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));
```

### 3. Tables WITHOUT company_id

For tables that reference company data indirectly (e.g., `order_items` → `orders` → `company_id`):

```sql
CREATE POLICY "company_isolation_via_parent"
ON public.order_items
FOR ALL
TO public
USING (
  order_id IN (
    SELECT o.id FROM orders o 
    WHERE o.company_id IN (SELECT allowed_company_ids_for_current_user())
  )
);
```

## Adding a New Table (Security Checklist)

When creating a new table, follow these steps:

### ✅ Step 1: Add company_id Column

```sql
CREATE TABLE public.your_new_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  -- other columns...
  created_at timestamptz DEFAULT now()
);
```

**CRITICAL:** `company_id` should be `NOT NULL` unless there's a specific reason.

### ✅ Step 2: Enable RLS

```sql
ALTER TABLE public.your_new_table ENABLE ROW LEVEL SECURITY;
```

### ✅ Step 3: Create RLS Policies

```sql
CREATE POLICY "company_isolation"
ON public.your_new_table
FOR ALL
TO public
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));
```

### ✅ Step 4: Add Trigger for Auto-Setting company_id

```sql
CREATE TRIGGER set_company_id_trigger
  BEFORE INSERT ON public.your_new_table
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_user();
```

### ✅ Step 5: Test Isolation

Run the isolation test suite:

```typescript
import { runCompanyIsolationTests } from '@/utils/companyIsolationTest';

// In your admin panel or test environment
const report = await runCompanyIsolationTests();
console.log(report);
```

## Security Functions (SECURITY DEFINER)

All `SECURITY DEFINER` functions MUST include `SET search_path = public`:

```sql
CREATE OR REPLACE FUNCTION public.your_function()
RETURNS some_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ⚠️ CRITICAL: Prevents schema poisoning
AS $$
BEGIN
  -- Your function code
END;
$$;
```

**Why this matters:**
- Without `SET search_path`, an attacker could create a malicious schema
- The function would execute in that malicious schema
- This is a **schema poisoning attack**

## Client-Side Best Practices

### DO: Always Filter by Company

```typescript
// ✅ CORRECT: Uses RLS to filter
const { data } = await supabase
  .from('reservations')
  .select('*');
// RLS automatically filters to current user's company
```

### DON'T: Hardcode Company IDs

```typescript
// ❌ WRONG: Hardcoded company ID
const { data } = await supabase
  .from('reservations')
  .select('*')
  .eq('company_id', 'some-uuid');
```

### DO: Use dataGuards for Extra Safety

```typescript
import { validateCompanyId, validateAuthContext } from '@/utils/dataGuards';

// Validates company_id format and authentication
const validCompanyId = validateCompanyId(companyId, 'ReservationForm');
```

## Testing Company Isolation

### Automated Tests

Use the built-in test suite:

```typescript
import { runCompanyIsolationTests } from '@/utils/companyIsolationTest';

const report = await runCompanyIsolationTests();

if (report.overallStatus === 'FAIL') {
  console.error('⚠️ Security issues detected!');
  console.log(report.results);
}
```

### Manual Testing

1. **Login as Company A**
2. **Note your company_id** (check DevTools → Application → localStorage)
3. **Try to query Company B's data:**
   ```typescript
   // This should return 0 results or error
   const { data } = await supabase
     .from('reservations')
     .select('*')
     .eq('company_id', 'different-company-uuid');
   ```
4. **Verify:** You should get no data or an RLS policy violation

## Common Security Mistakes

### ❌ Mistake 1: Nullable company_id with RLS

```sql
-- BAD: company_id can be NULL, bypassing RLS
CREATE TABLE bad_table (
  id uuid PRIMARY KEY,
  company_id uuid  -- ⚠️ Should be NOT NULL
);
```

**Fix:** Make `company_id NOT NULL` or add explicit NULL handling in RLS policy.

### ❌ Mistake 2: Missing RLS on Sensitive Tables

```sql
-- BAD: No RLS means anyone can read all data
CREATE TABLE sensitive_data (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  secret_info text
);
-- Missing: ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;
```

**Fix:** Always enable RLS on tables with company data.

### ❌ Mistake 3: Direct Auth Schema Queries

```sql
-- BAD: RLS policies should never query auth.users directly
CREATE POLICY "bad_policy"
ON public.some_table
USING (
  company_id = (SELECT raw_user_meta_data->>'company_id' FROM auth.users WHERE id = auth.uid())
);
```

**Fix:** Use the `allowed_company_ids_for_current_user()` function.

### ❌ Mistake 4: Service Role in Client

```typescript
// ❌ NEVER expose service_role key in client code
const supabase = createClient(url, SERVICE_ROLE_KEY); // Bypasses RLS!
```

**Fix:** Only use `anon` key in client, `service_role` in secure edge functions.

## Edge Functions Security

Edge functions have access to `service_role` which **bypasses RLS**. Always validate company access:

```typescript
// ✅ CORRECT: Validate company_id in edge function
export async function handler(req: Request) {
  const { companyId } = await req.json();
  
  // Get user's allowed companies
  const { data: user } = await supabaseAdmin.auth.getUser(token);
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single();
  
  // Verify user has access to this company
  if (userData.company_id !== companyId) {
    return new Response('Unauthorized', { status: 403 });
  }
  
  // Now safe to use service_role
  const { data } = await supabaseAdmin
    .from('sensitive_data')
    .select('*')
    .eq('company_id', companyId);
}
```

## Monitoring and Alerts

### What to Monitor

1. **Failed RLS Policy Violations**
   - Check Supabase logs for `permission denied` errors
   - Alert on repeated violations from same user

2. **Cross-Company Access Attempts**
   - Log when `company_id` in request ≠ user's actual company
   - This could indicate an attack attempt

3. **Suspicious Query Patterns**
   - Multiple companies queried in short time
   - Unusual table access patterns

### Setting Up Alerts

In Supabase Dashboard:
1. Go to Logs → Database
2. Filter for: `permission denied for table`
3. Set up webhook alert for > 10 violations/hour

## Additional Security Features

### 1. Enable Leaked Password Protection

**Supabase Dashboard:**
- Go to Authentication → Policies
- Enable "Leaked Password Protection"
- This checks user passwords against known breached passwords

### 2. Enable MFA for Admins

**Recommended for `is_company_admin = true` users:**
```typescript
// Enable TOTP MFA
const { data } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'Company Admin MFA'
});
```

### 3. Audit Logging

Log security events:
```typescript
import { SecurityManager } from '@/utils/securityConfig';

SecurityManager.logSecurityEvent('unauthorized_access_attempt', {
  userId: user.id,
  attemptedCompanyId: attemptedCompanyId,
  actualCompanyId: actualCompanyId
});
```

## Incident Response

If you suspect a data breach:

1. **Immediately:** Review audit logs for unauthorized access
2. **Check:** Run `runCompanyIsolationTests()` to verify RLS is working
3. **Verify:** Check Supabase logs for cross-company queries
4. **If Confirmed:** 
   - Reset API keys
   - Force password reset for affected users
   - Review and strengthen RLS policies
   - Notify affected companies

## Security Audit Schedule

- **Daily:** Automated isolation tests in CI/CD
- **Weekly:** Review failed RLS policy logs
- **Monthly:** Manual security audit of new features
- **Quarterly:** Third-party penetration testing (recommended)

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Security Definer Functions](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [Schema Poisoning Prevention](https://supabase.com/docs/guides/database/database-linter#function-search-path-mutable)

## Questions?

For security-related questions or to report vulnerabilities, contact your security team immediately.

**Last Updated:** 2025-10-09  
**Version:** 1.0
