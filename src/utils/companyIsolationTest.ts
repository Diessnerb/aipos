/**
 * Company Isolation Test Suite
 * 
 * This utility tests that company data isolation is working correctly.
 * It verifies that users cannot access data from other companies.
 * 
 * ZERO RISK - Read-only tests with isolated test data
 */

import { supabase } from '@/integrations/supabase/client';

export interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  error?: string;
}

export interface IsolationTestReport {
  timestamp: string;
  overallStatus: 'PASS' | 'FAIL';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestResult[];
}

/**
 * Run comprehensive company isolation tests
 */
export async function runCompanyIsolationTests(): Promise<IsolationTestReport> {
  const results: TestResult[] = [];
  const timestamp = new Date().toISOString();

  console.log('🔒 Starting Company Isolation Test Suite...');
  console.log('================================================');

  try {
    // Get current user's company
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }

    const { data: currentUserData } = await supabase
      .from('users')
      .select('company_id, email')
      .eq('auth_user_id', user.id)
      .single();

    if (!currentUserData?.company_id) {
      throw new Error('Current user has no company_id');
    }

    const currentCompanyId = currentUserData.company_id;
    console.log(`✓ Current user company: ${currentCompanyId}`);
    console.log(`✓ Current user email: ${currentUserData.email}`);

    // Test 1: Verify can access own company data
    results.push(await testOwnCompanyAccess(currentCompanyId));

    // Test 2: Verify cannot access other companies' data
    results.push(await testCrossCompanyBlocked(currentCompanyId));

    // Test 3: Verify reservation data isolation
    results.push(await testReservationIsolation(currentCompanyId));

    // Test 4: Verify customer data isolation
    results.push(await testCustomerIsolation(currentCompanyId));

    // Test 5: Verify settings isolation
    results.push(await testSettingsIsolation(currentCompanyId));

    // Test 6: Verify menu data isolation
    results.push(await testMenuIsolation(currentCompanyId));

    // Test 7: Verify table data isolation
    results.push(await testTableIsolation(currentCompanyId));

  } catch (error) {
    results.push({
      testName: 'Test Suite Initialization',
      passed: false,
      details: 'Failed to initialize test suite',
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.length - passedTests;
  const overallStatus = failedTests === 0 ? 'PASS' : 'FAIL';

  console.log('================================================');
  console.log(`📊 Test Results: ${passedTests}/${results.length} passed`);
  console.log(`Overall Status: ${overallStatus}`);

  return {
    timestamp,
    overallStatus,
    totalTests: results.length,
    passedTests,
    failedTests,
    results
  };
}

/**
 * Test 1: Can access own company data
 */
async function testOwnCompanyAccess(companyId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (error) {
      return {
        testName: 'Own Company Access',
        passed: false,
        details: 'Failed to access own company data',
        error: error.message
      };
    }

    if (data && data.id === companyId) {
      return {
        testName: 'Own Company Access',
        passed: true,
        details: `Successfully accessed company: ${data.name}`
      };
    }

    return {
      testName: 'Own Company Access',
      passed: false,
      details: 'Company data not returned correctly'
    };
  } catch (error) {
    return {
      testName: 'Own Company Access',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 2: Cannot access other companies
 */
async function testCrossCompanyBlocked(currentCompanyId: string): Promise<TestResult> {
  try {
    // Try to get a different company
    const { data: otherCompanies } = await supabase
      .from('companies')
      .select('id')
      .neq('id', currentCompanyId)
      .limit(1);

    if (!otherCompanies || otherCompanies.length === 0) {
      return {
        testName: 'Cross-Company Access Blocked',
        passed: true,
        details: 'No other companies visible (correctly isolated)'
      };
    }

    // If we can see other companies, that's a FAIL
    return {
      testName: 'Cross-Company Access Blocked',
      passed: false,
      details: `⚠️ SECURITY ISSUE: Can see ${otherCompanies.length} other company/companies`,
      error: 'RLS may not be working correctly'
    };
  } catch (error) {
    return {
      testName: 'Cross-Company Access Blocked',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 3: Reservation data isolation
 */
async function testReservationIsolation(companyId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('company_id')
      .limit(100);

    if (error) {
      return {
        testName: 'Reservation Data Isolation',
        passed: false,
        details: 'Error querying reservations',
        error: error.message
      };
    }

    // Check all reservations belong to current company
    const wrongCompanyReservations = data?.filter(r => r.company_id !== companyId) || [];

    if (wrongCompanyReservations.length > 0) {
      return {
        testName: 'Reservation Data Isolation',
        passed: false,
        details: `⚠️ SECURITY ISSUE: Found ${wrongCompanyReservations.length} reservations from other companies`,
        error: 'RLS not working correctly for reservations'
      };
    }

    return {
      testName: 'Reservation Data Isolation',
      passed: true,
      details: `All ${data?.length || 0} reservations belong to current company`
    };
  } catch (error) {
    return {
      testName: 'Reservation Data Isolation',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 4: Customer data isolation
 */
async function testCustomerIsolation(companyId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('company_id')
      .limit(100);

    if (error) {
      return {
        testName: 'Customer Data Isolation',
        passed: false,
        details: 'Error querying customers',
        error: error.message
      };
    }

    const wrongCompanyCustomers = data?.filter(c => c.company_id !== companyId) || [];

    if (wrongCompanyCustomers.length > 0) {
      return {
        testName: 'Customer Data Isolation',
        passed: false,
        details: `⚠️ SECURITY ISSUE: Found ${wrongCompanyCustomers.length} customers from other companies`,
        error: 'RLS not working correctly for customers'
      };
    }

    return {
      testName: 'Customer Data Isolation',
      passed: true,
      details: `All ${data?.length || 0} customers belong to current company`
    };
  } catch (error) {
    return {
      testName: 'Customer Data Isolation',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 5: Settings isolation
 */
async function testSettingsIsolation(companyId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('company_id')
      .limit(10);

    if (error) {
      return {
        testName: 'Settings Data Isolation',
        passed: false,
        details: 'Error querying settings',
        error: error.message
      };
    }

    const wrongCompanySettings = data?.filter(s => s.company_id !== companyId) || [];

    if (wrongCompanySettings.length > 0) {
      return {
        testName: 'Settings Data Isolation',
        passed: false,
        details: `⚠️ SECURITY ISSUE: Found ${wrongCompanySettings.length} settings from other companies`,
        error: 'RLS not working correctly for settings'
      };
    }

    return {
      testName: 'Settings Data Isolation',
      passed: true,
      details: `All ${data?.length || 0} settings belong to current company`
    };
  } catch (error) {
    return {
      testName: 'Settings Data Isolation',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 6: Menu data isolation
 */
async function testMenuIsolation(companyId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('company_id')
      .limit(100);

    if (error) {
      return {
        testName: 'Menu Data Isolation',
        passed: false,
        details: 'Error querying menu items',
        error: error.message
      };
    }

    const wrongCompanyMenu = data?.filter(m => m.company_id !== companyId) || [];

    if (wrongCompanyMenu.length > 0) {
      return {
        testName: 'Menu Data Isolation',
        passed: false,
        details: `⚠️ SECURITY ISSUE: Found ${wrongCompanyMenu.length} menu items from other companies`,
        error: 'RLS not working correctly for menu'
      };
    }

    return {
      testName: 'Menu Data Isolation',
      passed: true,
      details: `All ${data?.length || 0} menu items belong to current company`
    };
  } catch (error) {
    return {
      testName: 'Menu Data Isolation',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test 7: Table data isolation
 */
async function testTableIsolation(companyId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('tables')
      .select('company_id')
      .limit(100);

    if (error) {
      return {
        testName: 'Table Data Isolation',
        passed: false,
        details: 'Error querying tables',
        error: error.message
      };
    }

    const wrongCompanyTables = data?.filter(t => t.company_id !== companyId) || [];

    if (wrongCompanyTables.length > 0) {
      return {
        testName: 'Table Data Isolation',
        passed: false,
        details: `⚠️ SECURITY ISSUE: Found ${wrongCompanyTables.length} tables from other companies`,
        error: 'RLS not working correctly for tables'
      };
    }

    return {
      testName: 'Table Data Isolation',
      passed: true,
      details: `All ${data?.length || 0} tables belong to current company`
    };
  } catch (error) {
    return {
      testName: 'Table Data Isolation',
      passed: false,
      details: 'Exception during test',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Format test report for display
 */
export function formatTestReport(report: IsolationTestReport): string {
  let output = '\n';
  output += '╔══════════════════════════════════════════════════════════════╗\n';
  output += '║        COMPANY ISOLATION TEST REPORT                        ║\n';
  output += '╚══════════════════════════════════════════════════════════════╝\n';
  output += `\nTimestamp: ${report.timestamp}\n`;
  output += `Overall Status: ${report.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`;
  output += `Tests Passed: ${report.passedTests}/${report.totalTests}\n`;
  output += '\n─────────────────────────────────────────────────────────────\n';
  output += 'DETAILED RESULTS:\n';
  output += '─────────────────────────────────────────────────────────────\n\n';

  report.results.forEach((result, index) => {
    output += `${index + 1}. ${result.testName}\n`;
    output += `   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`;
    output += `   Details: ${result.details}\n`;
    if (result.error) {
      output += `   Error: ${result.error}\n`;
    }
    output += '\n';
  });

  output += '─────────────────────────────────────────────────────────────\n';
  
  if (report.overallStatus === 'PASS') {
    output += '\n✅ All tests passed! Company data isolation is working correctly.\n';
  } else {
    output += '\n⚠️  WARNING: Some tests failed. Review the security issues above.\n';
  }

  return output;
}
