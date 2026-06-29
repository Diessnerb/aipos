import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, TestTube, CheckCircle, XCircle, AlertTriangle, Workflow } from 'lucide-react';
import { toast } from 'sonner';

interface N8nGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  integrationToken: string;
}

interface ApiToken {
  auth_token: string;
}

export const N8nGuideModal = ({ isOpen, onClose, companyName, integrationToken }: N8nGuideModalProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const healthEndpoint = 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-api-health';
  const ingestEndpoint = 'https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-reservation-ingest';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const testHealthEndpoint = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch(healthEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-Token': integrationToken
        }
      });

      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        toast.success('n8n connection test successful!');
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      const errorResult = {
        success: false,
        error: 'Network error - could not reach API endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      setTestResult(errorResult);
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const downloadN8nTemplate = () => {
    const template = {
      "name": `${companyName} Reservation Integration`,
      "nodes": [
        {
          "parameters": {
            "url": ingestEndpoint,
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "sendHeaders": true,
            "headerParameters": {
              "parameters": [
                {
                  "name": "X-Integration-Token",
                  "value": integrationToken
                }
              ]
            },
            "sendBody": true,
            "contentType": "json",
            "body": {
              "reservation": {
                "customer_name": "={{ $json.customer_name }}",
                "phone": "={{ $json.phone }}",
                "party_size": "={{ $json.party_size }}",
                "date": "={{ $json.date }}",
                "time": "={{ $json.time }}",
                "status": "confirmed",
                "notes": "={{ $json.notes }}"
              },
              "isUpdate": false,
              "external_id": "={{ $json.external_id }}"
            }
          },
          "id": "create-reservation-node",
          "name": "Create Reservation",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 4.1,
          "position": [820, 300]
        }
      ],
      "connections": {},
      "createdAt": new Date().toISOString(),
      "id": "reservation-template",
      "meta": {
        "instanceId": "n8n-template"
      },
      "staticData": null,
      "tags": ["reservation", "integration", companyName.toLowerCase()],
      "triggerCount": 0,
      "updatedAt": new Date().toISOString(),
      "versionId": "1"
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n-${companyName.toLowerCase().replace(/\s+/g, '-')}-reservation-template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('n8n template downloaded successfully');
  };

  const createExample = `curl -X POST '${ingestEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Integration-Token: ${integrationToken}' \\
  -d '{
    "reservation": {
      "customer_name": "John Smith",
      "phone": "555-0123",
      "party_size": 4,
      "date": "2024-01-20",
      "time": "19:30:00",
      "status": "confirmed",
      "notes": "Anniversary dinner"
    },
    "external_id": "booking-12345"
  }'`;

  const updateExample = `curl -X POST '${ingestEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Integration-Token: ${integrationToken}' \\
  -d '{
    "reservation": {
      "customer_name": "John Smith",
      "phone": "555-0123",
      "party_size": 6,
      "date": "2024-01-20",
      "time": "20:00:00",
      "status": "confirmed",
      "notes": "Changed party size and time"
    },
    "isUpdate": true,
    "external_id": "booking-12345"
  }'`;

  const deleteExample = `curl -X DELETE '${ingestEndpoint}?external_id=booking-12345' \\
  -H 'X-Integration-Token: ${integrationToken}'`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            n8n Integration Guide - {companyName}
          </DialogTitle>
          <DialogDescription>
            Complete setup guide for integrating n8n workflows with your reservation system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Connection Test
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testHealthEndpoint}
                  disabled={testing}
                >
                  <TestTube className={`h-4 w-4 mr-2 ${testing ? 'animate-pulse' : ''}`} />
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResult && (
                <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                      {testResult.success 
                        ? '✅ Connection successful! Your integration token is working properly.'
                        : `❌ Connection failed: ${testResult.error}`
                      }
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* API Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Health Check Endpoint (for testing)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={healthEndpoint}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(healthEndpoint)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reservation Ingest Endpoint</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={ingestEndpoint}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(ingestEndpoint)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Integration Token</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={integrationToken}
                    readOnly
                    className="font-mono text-sm"
                    type="password"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(integrationToken)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* n8n Template */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                n8n Workflow Template
                <Button
                  variant="default"
                  size="sm"
                  onClick={downloadN8nTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Download this preconfigured n8n workflow template with HTTP Request node already set up for {companyName}. 
                  Import it into n8n and customize the field mappings for your use case.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Integration Examples</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="create">Create Reservation</TabsTrigger>
                  <TabsTrigger value="update">Update Reservation</TabsTrigger>
                  <TabsTrigger value="delete">Delete Reservation</TabsTrigger>
                </TabsList>
                
                <TabsContent value="create" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>cURL Example - Create New Reservation</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(createExample)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <code className="text-sm whitespace-pre-wrap">{createExample}</code>
                    </div>
                  </div>
                  <Alert>
                    <AlertDescription>
                      <strong>Key fields:</strong> Use <code>external_id</code> to track reservations from your system. 
                      Leave <code>isUpdate: false</code> (or omit) for new reservations.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
                
                <TabsContent value="update" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>cURL Example - Update Existing Reservation</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(updateExample)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <code className="text-sm whitespace-pre-wrap">{updateExample}</code>
                    </div>
                  </div>
                  <Alert>
                    <AlertDescription>
                      <strong>Updates:</strong> Set <code>isUpdate: true</code> and provide either <code>external_id</code> or internal <code>id</code> to update existing reservations.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
                
                <TabsContent value="delete" className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>cURL Example - Delete Reservation</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(deleteExample)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <code className="text-sm whitespace-pre-wrap">{deleteExample}</code>
                    </div>
                  </div>
                  <Alert>
                    <AlertDescription>
                      <strong>Deletion:</strong> Use DELETE method with <code>external_id</code> or <code>id</code> as query parameter.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* n8n Setup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">n8n Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">1</Badge>
                  <div>
                    <strong>Create HTTP Request Node:</strong> Add an HTTP Request node to your n8n workflow
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">2</Badge>
                  <div>
                    <strong>Set Method:</strong> POST for create/update, DELETE for deletion
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">3</Badge>
                  <div>
                    <strong>Set URL:</strong> Use the ingest endpoint URL above
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">4</Badge>
                  <div>
                    <strong>Add Headers:</strong> Include <code>X-Integration-Token</code> header with your token
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">5</Badge>
                  <div>
                    <strong>Map Fields:</strong> Map your workflow data to reservation fields using expressions like <code>{`{{ $json.customer_name }}`}</code>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs">6</Badge>
                  <div>
                    <strong>Test:</strong> Use the connection test above to verify your setup
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security:</strong> Keep your integration token secure. Rate limits apply (100 requests per minute). 
              Always use HTTPS endpoints. For production use, implement proper error handling and retry logic in your n8n workflows.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
};