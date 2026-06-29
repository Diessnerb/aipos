/**
 * Company Isolation Test Panel
 * 
 * Admin UI for running company isolation tests
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, CheckCircle, XCircle, AlertTriangle, Play } from 'lucide-react';
import { runCompanyIsolationTests, formatTestReport, type IsolationTestReport } from '@/utils/companyIsolationTest';
import { useToast } from '@/hooks/use-toast';

export const CompanyIsolationTestPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<IsolationTestReport | null>(null);
  const { toast } = useToast();

  const handleRunTests = async () => {
    setIsRunning(true);
    setReport(null);

    try {
      const testReport = await runCompanyIsolationTests();
      setReport(testReport);

      // Log formatted report to console
      console.log(formatTestReport(testReport));

      if (testReport.overallStatus === 'PASS') {
        toast({
          title: '✅ All Tests Passed',
          description: `Company isolation is working correctly (${testReport.passedTests}/${testReport.totalTests} tests passed)`,
        });
      } else {
        toast({
          title: '⚠️ Security Issues Detected',
          description: `${testReport.failedTests} test(s) failed. Check console for details.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Test Error',
        description: error instanceof Error ? error.message : 'Failed to run tests',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Company Isolation Security Tests</CardTitle>
        </div>
        <CardDescription>
          Verify that company data isolation is working correctly. Tests ensure users cannot access data from other companies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleRunTests}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>Running Tests...</>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Isolation Tests
            </>
          )}
        </Button>

        {report && (
          <div className="space-y-3">
            <div className={`p-4 rounded-lg border ${
              report.overallStatus === 'PASS' 
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {report.overallStatus === 'PASS' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <span className="font-semibold">
                  {report.overallStatus === 'PASS' ? 'All Tests Passed' : 'Security Issues Detected'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {report.passedTests}/{report.totalTests} tests passed
              </p>
            </div>

            <div className="space-y-2">
              {report.results.map((result, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border text-sm ${
                    result.passed
                      ? 'bg-card border-border'
                      : 'bg-destructive/10 border-destructive/20'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{result.testName}</div>
                      <div className="text-muted-foreground mt-1">{result.details}</div>
                      {result.error && (
                        <div className="text-destructive text-xs mt-1">Error: {result.error}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              Test run: {new Date(report.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg">
          <p className="font-medium mb-1">What these tests verify:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Users can only access their own company's data</li>
            <li>Cross-company data access is blocked</li>
            <li>RLS policies are working correctly</li>
            <li>Reservations, customers, settings, menu, and tables are isolated</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
