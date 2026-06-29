import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useMenuItems } from '@/hooks/useMenuItems';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useAuth } from '@/components/AuthProvider';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export const SmokeTest = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  
  const { companyId, loading: authLoading } = useAuth();
  const { categories, isLoading: categoriesLoading } = useMenuCategories();
  const { menuItems, loading: menuItemsLoading } = useMenuItems();
  const { tables, loading: tablesLoading } = useTablesQuery();

  const runSmokeTests = async () => {
    setRunning(true);
    const testResults: TestResult[] = [];

    // Test 1: Authentication & Company Context
    testResults.push({
      name: 'Authentication & Company Context',
      status: authLoading ? 'pending' : companyId ? 'success' : 'error',
      message: authLoading ? 'Loading...' : companyId ? `Company ID: ${companyId}` : 'No company context found',
      details: companyId ? 'User is properly authenticated and linked to company' : 'Authentication or company linking issue'
    });

    // Test 2: Menu Categories Loading
    testResults.push({
      name: 'Menu Categories',
      status: categoriesLoading ? 'pending' : categories.length >= 0 ? 'success' : 'error',
      message: categoriesLoading ? 'Loading...' : `Found ${categories.length} categories`,
      details: `Categories are ${categoriesLoading ? 'still loading' : 'loaded successfully'}`
    });

    // Test 3: Menu Items Loading
    testResults.push({
      name: 'Menu Items',
      status: menuItemsLoading ? 'pending' : menuItems.length >= 0 ? 'success' : 'error',
      message: menuItemsLoading ? 'Loading...' : `Found ${menuItems.length} menu items`,
      details: `Menu items are ${menuItemsLoading ? 'still loading' : 'loaded successfully'}`
    });

    // Test 4: Tables Loading
    testResults.push({
      name: 'Tables Management',
      status: tablesLoading ? 'pending' : tables.length >= 0 ? 'success' : 'error',
      message: tablesLoading ? 'Loading...' : `Found ${tables.length} tables`,
      details: `Tables are ${tablesLoading ? 'still loading' : 'loaded successfully'}`
    });

    // Test 5: Data Consistency
    const orphanedItems = menuItems.filter(item => 
      item.category_id && !categories.some(cat => 
        cat.id === item.category_id || 
        cat.subcategories?.some(sub => sub.id === item.category_id)
      )
    );
    
    testResults.push({
      name: 'Data Consistency',
      status: orphanedItems.length === 0 ? 'success' : 'warning',
      message: orphanedItems.length === 0 ? 'All data is consistent' : `${orphanedItems.length} orphaned menu items found`,
      details: orphanedItems.length === 0 ? 'No orphaned menu items detected' : 'Some menu items reference non-existent categories'
    });

    setTests(testResults);
    setRunning(false);
  };

  useEffect(() => {
    if (!authLoading && companyId) {
      runSmokeTests();
    }
  }, [authLoading, companyId, categoriesLoading, menuItemsLoading, tablesLoading]);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const overallStatus = tests.length === 0 ? 'pending' : 
    tests.some(t => t.status === 'error') ? 'error' :
    tests.some(t => t.status === 'warning') ? 'warning' : 'success';

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            System Health Check
            {getStatusIcon(overallStatus)}
          </CardTitle>
          <Button 
            onClick={runSmokeTests} 
            disabled={running}
            size="sm"
            variant="outline"
          >
            {running ? 'Running...' : 'Run Tests'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Click "Run Tests" to check system health
          </div>
        ) : (
          tests.map((test, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getStatusColor(test.status)}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(test.status)}
                  <span className="font-medium">{test.name}</span>
                </div>
                <Badge variant={test.status === 'success' ? 'default' : 
                              test.status === 'error' ? 'destructive' :
                              test.status === 'warning' ? 'secondary' : 'outline'}>
                  {test.status}
                </Badge>
              </div>
              <p className="text-sm font-medium">{test.message}</p>
              {test.details && (
                <p className="text-xs opacity-75 mt-1">{test.details}</p>
              )}
            </div>
          ))
        )}
        
        {tests.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Tests completed: {tests.filter(t => t.status !== 'pending').length}/{tests.length}
              </span>
              <div className="flex gap-2">
                <span className="text-green-600">
                  ✓ {tests.filter(t => t.status === 'success').length}
                </span>
                <span className="text-yellow-600">
                  ⚠ {tests.filter(t => t.status === 'warning').length}
                </span>
                <span className="text-red-600">
                  ✗ {tests.filter(t => t.status === 'error').length}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};