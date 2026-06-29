import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Key, RefreshCw, AlertTriangle, TestTube, CheckCircle, XCircle, Wrench, Zap, Workflow } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { N8nGuideModal } from './N8nGuideModal';

interface ApiAccessManagementProps {
  companyId: string;
  companyName: string;
}

interface ApiToken {
  id: string;
  auth_token: string;
  created_at: string;
  last_synced_at?: string;
}

export const ApiAccessManagement = ({ companyId, companyName }: ApiAccessManagementProps) => {
  const [token, setToken] = useState<ApiToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [runningGlobalHealthCheck, setRunningGlobalHealthCheck] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [globalHealthResult, setGlobalHealthResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showN8nGuide, setShowN8nGuide] = useState(false);

  // Wait for valid session before making queries
  const waitForSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session available, waiting...');
        return false;
      }
      console.log('Session ready, can proceed with queries');
      return true;
    } catch (error) {
      console.error('Error checking session:', error);
      return false;
    }
  };

  const fetchToken = async (retryCount = 0) => {
    try {
      setError(null);
      
      // Ensure we have a valid session before querying
      if (!sessionReady) {
        const hasSession = await waitForSession();
        if (!hasSession) {
          if (retryCount < 3) {
            console.log(`Session not ready, retrying in 1s (attempt ${retryCount + 1}/3)`);
            setTimeout(() => fetchToken(retryCount + 1), 1000);
            return;
          } else {
            throw new Error('Session not available after 3 attempts');
          }
        } else {
          setSessionReady(true);
        }
      }

      // Use the secure RPC function to get API token
      const { data, error } = await supabase.rpc('admin_get_company_api_token', {
        p_company_id: companyId
      });

      if (error) {
        throw error;
      }

      // Type the data properly
      const result = data as { 
        success: boolean; 
        error?: string; 
        token_exists?: boolean;
        token?: string;
        id?: string;
        created_at?: string;
        last_synced_at?: string;
      };

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch token');
      }

      if (result.token_exists) {
        setToken({
          id: result.id || '',
          auth_token: result.token || '',
          created_at: result.created_at || '',
          last_synced_at: result.last_synced_at
        });
        console.log('✅ Token fetched successfully: Found');
      } else {
        setToken(null);
        console.log('✅ Token query successful: Not found');
      }
    } catch (error) {
      console.error('❌ Error fetching API token:', error);
      setError(`Failed to load API token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Don't show toast for "no data" cases - that's expected
      if (error instanceof Error && !error.message.includes('No rows returned')) {
        toast.error('Failed to load API token');
      }
    } finally {
      setLoading(false);
    }
  };

  const rotateToken = async () => {
    setRotating(true);
    try {
      // First get the current token, then ensure/recreate it
      const { data, error } = await supabase.rpc('ensure_company_api_token', {
        p_company_id: companyId
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to rotate token');
      }

      await fetchToken();
      toast.success('API token rotated successfully');
    } catch (error) {
      console.error('Error rotating token:', error);
      toast.error(`Failed to rotate token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRotating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const testToken = async () => {
    if (!token) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const healthEndpoint = `https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-api-health`;
      
      const response = await fetch(healthEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-Token': token.auth_token
        }
      });

      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        toast.success('API token test successful!');
        // Refresh token data to update last_synced_at
        await fetchToken();
      } else {
        toast.error(`Token test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing token:', error);
      const errorResult = {
        success: false,
        error: 'Network error - could not reach API endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      setTestResult(errorResult);
      toast.error('Failed to test API token');
    } finally {
      setTesting(false);
    }
  };

  // Monitor session state changes
  useEffect(() => {
    const checkInitialSession = async () => {
      const hasSession = await waitForSession();
      if (hasSession) {
        setSessionReady(true);
        fetchToken();
      } else {
        // Try again after delay
        setTimeout(() => fetchToken(), 1000);
      }
    };

    checkInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session ? 'session exists' : 'no session');
      if (session && !sessionReady) {
        setSessionReady(true);
        await fetchToken();
      } else if (!session) {
        setSessionReady(false);
        setToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [companyId]);

  const ensureToken = async () => {
    if (!companyId) return;
    
    setRepairing(true);
    try {
      const { data, error } = await supabase.rpc('ensure_company_api_token', {
        p_company_id: companyId
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        error?: string; 
        token?: string;
        company_name?: string;
        action?: string;
        message?: string;
      };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to ensure token');
      }

      toast.success(result.message || 'API token ensured successfully');
      console.log('✅ Token ensured:', result.action);
      
      // Refresh token display
      await fetchToken();
    } catch (error) {
      console.error('❌ Error ensuring token:', error);
      toast.error(`Failed to ensure token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRepairing(false);
    }
  };

  const runGlobalHealthCheck = async () => {
    setRunningGlobalHealthCheck(true);
    setGlobalHealthResult(null);
    
    try {
      const { data, error } = await supabase.rpc('run_health_check_all_companies');

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        total_companies?: number;
        healthy_companies?: number;
        results?: any[];
      };
      
      if (!result.success) {
        throw new Error(result.error || 'Health check failed');
      }

      setGlobalHealthResult(result);
      toast.success(`Health check complete: ${result.healthy_companies}/${result.total_companies} companies healthy`);
    } catch (error) {
      console.error('❌ Error running global health check:', error);
      toast.error(`Global health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunningGlobalHealthCheck(false);
    }
  };

  if (loading || !sessionReady) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <h4 className="font-medium">
            {loading ? 'Loading API Access...' : 'Waiting for authentication...'}
          </h4>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-destructive">API Token Not Found</h4>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={ensureToken}
              disabled={repairing}
            >
              <Wrench className={`h-4 w-4 mr-2 ${repairing ? 'animate-spin' : ''}`} />
              {repairing ? 'Creating...' : 'Create Token'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runGlobalHealthCheck}
              disabled={runningGlobalHealthCheck}
            >
              <Zap className={`h-4 w-4 mr-2 ${runningGlobalHealthCheck ? 'animate-pulse' : ''}`} />
              Global Health Check
            </Button>
          </div>
        </div>
        
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No API token found for {companyName}. Click "Create Token" to generate one automatically, 
            or run a global health check to see the status of all companies.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Error details: {error}
            </AlertDescription>
          </Alert>
        )}

        {globalHealthResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Global Health Check Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Summary:</strong> {globalHealthResult.healthy_companies}/{globalHealthResult.total_companies} companies have healthy API tokens
                </p>
                {globalHealthResult.results && globalHealthResult.results.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {globalHealthResult.results.map((company: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-xs p-2 rounded border">
                        <span>{company.company_name}</span>
                        <Badge variant={company.status === 'healthy' ? 'default' : 'destructive'}>
                          {company.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Still show endpoint documentation even without token */}
        <div className="opacity-75">
          <h5 className="font-medium text-sm mb-2">Integration Endpoints</h5>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Health Check: https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-api-health</p>
            <p>Reservation Ingest: https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-reservation-ingest</p>
          </div>
        </div>
      </div>
    );
  }

  const endpoint = `https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-reservation-ingest`;

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">External API Access</h4>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">
                Active
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowN8nGuide(true)}
              >
                <Workflow className="h-4 w-4 mr-2" />
                n8n Guide
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={runGlobalHealthCheck}
                disabled={runningGlobalHealthCheck}
              >
                <Zap className={`h-4 w-4 mr-2 ${runningGlobalHealthCheck ? 'animate-pulse' : ''}`} />
                Global Check
              </Button>
            </div>
          </div>

      {/* API Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-token">Integration Token</Label>
            <div className="flex items-center gap-2">
              <Input
                id="api-token"
                value={token.auth_token}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(token.auth_token)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={rotateToken}
                disabled={rotating}
              >
                <RefreshCw className={`h-4 w-4 ${rotating ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={testToken}
                disabled={testing}
              >
                <TestTube className={`h-4 w-4 ${testing ? 'animate-pulse' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={ensureToken}
                disabled={repairing}
                title="Repair or recreate token if needed"
              >
                <Wrench className={`h-4 w-4 ${repairing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Created: {new Date(token.created_at).toLocaleDateString()}
              {token.last_synced_at && (
                <> • Last used: {new Date(token.last_synced_at).toLocaleDateString()}</>
              )}
            </p>

            {/* Test Result Display */}
            {testResult && (
              <div className={`p-3 rounded-md border ${
                testResult.success 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {testResult.success ? 'Token Test Successful' : 'Token Test Failed'}
                  </span>
                </div>
                <p className="text-xs mt-1">
                  {testResult.success 
                    ? `✅ API is ready - Company: ${testResult.integration?.company_name || companyName} | Last synced: ${testResult.integration?.last_synced_at ? new Date(testResult.integration.last_synced_at).toLocaleString() : 'Just now'}`
                    : `❌ Error: ${testResult.error}`
                  }
                </p>
                {testResult.details && (
                  <p className="text-xs mt-1 opacity-75">{testResult.details}</p>
                )}
                {testResult.success && testResult.endpoints && (
                  <div className="text-xs mt-2 space-y-1">
                    <p><strong>Available endpoints:</strong></p>
                    <p>• Health: {testResult.endpoints.health_check}</p>
                    <p>• Ingest: {testResult.endpoints.reservation_ingest}</p>
                  </div>
                )}
              </div>
            )}

            {/* Global Health Check Results */}
            {globalHealthResult && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Global Health Check Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded bg-muted">
                      <span className="font-medium">System Overview</span>
                      <Badge variant={globalHealthResult.healthy_companies === globalHealthResult.total_companies ? 'default' : 'destructive'}>
                        {globalHealthResult.healthy_companies}/{globalHealthResult.total_companies} Healthy
                      </Badge>
                    </div>
                    
                    {globalHealthResult.results && globalHealthResult.results.length > 0 && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        <h6 className="text-xs font-medium mb-2">Company Status Details:</h6>
                        {globalHealthResult.results.map((company: any, index: number) => (
                          <div key={index} className="flex items-center justify-between text-xs p-2 rounded border bg-background">
                            <div className="flex flex-col">
                              <span className="font-medium">{company.company_name}</span>
                              {company.last_synced && (
                                <span className="text-muted-foreground">Last sync: {new Date(company.last_synced).toLocaleString()}</span>
                              )}
                            </div>
                            <Badge variant={company.status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                              {company.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Integration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Health Check Endpoint (for testing)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={`https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-api-health`}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-api-health`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={endpoint}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(endpoint)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Headers Required</Label>
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm">
                Content-Type: application/json<br/>
                X-Integration-Token: {token.auth_token}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Request Body Example</Label>
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm whitespace-pre-wrap">
{JSON.stringify({
  reservation: {
    customer_name: "John Doe",
    phone: "555-1234", // Optional
    party_size: 2,
    date: "2024-01-15",
    time: "19:00:00",
    status: "confirmed", // Optional, defaults to "confirmed"
    notes: "Birthday celebration" // Optional
  },
  isUpdate: false // Set to true with reservation.id for updates
}, null, 2)}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <Label>cURL Example</Label>
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm whitespace-pre-wrap">
{`curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Integration-Token: ${token.auth_token}' \\
  -d '{
    "reservation": {
      "customer_name": "John Doe",
      "party_size": 2,
      "date": "2024-01-15",
      "time": "19:00:00"
    }
  }'`}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Node.js Example</Label>
            <div className="bg-muted p-3 rounded-md">
              <code className="text-sm whitespace-pre-wrap">
{`const axios = require('axios');

const createReservation = async () => {
  try {
    const response = await axios.post('${endpoint}', {
      reservation: {
        customer_name: 'John Doe',
        party_size: 2,
        date: '2024-01-15',
        time: '19:00:00'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Integration-Token': '${token.auth_token}'
      }
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
};`}
              </code>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Note:</strong> Keep your API token secure. It provides direct access to create reservations for {companyName}. 
              If compromised, use the rotate button to generate a new token.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* n8n Guide Modal */}
      <N8nGuideModal
        isOpen={showN8nGuide}
        onClose={() => setShowN8nGuide(false)}
        companyName={companyName}
        integrationToken={token.auth_token}
      />
    </div>
  );
};