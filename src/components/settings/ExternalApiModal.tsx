import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Eye, EyeOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExternalApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIntegration?: any;
}

interface ApiToken {
  id: string;
  auth_token: string;
  connected: boolean;
  created_at: string;
}

const ExternalApiModal: React.FC<ExternalApiModalProps> = ({
  isOpen,
  onClose,
  currentIntegration
}) => {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [showToken, setShowToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchTokens = async () => {
    try {
      // Get current user's company_id first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData?.company_id) {
        console.error('Error getting user company:', userError);
        setTokens([]);
        return;
      }

      const { data, error } = await supabase
        .from('integrations')
        .select('id, auth_token, connected, created_at')
        .eq('company_id', userData.company_id)
        .eq('service_name', 'external_api')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast({
        title: "Error",
        description: "Failed to load API tokens",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTokens();
    }
  }, [isOpen]);

  const generateToken = async () => {
    setIsGenerating(true);
    try {
      // Get current user's company_id first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData?.company_id) {
        throw new Error('Unable to determine your company. Please ensure you are properly logged in.');
      }

      // Use the ensure_company_api_token RPC to create token with proper company scoping
      const { data, error } = await supabase.rpc('ensure_company_api_token', {
        p_company_id: userData.company_id
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        error?: string; 
        message?: string;
      };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate token');
      }

      toast({
        title: "Success",
        description: result.message || "API token generated successfully",
      });

      fetchTokens();
    } catch (error) {
      console.error('Error generating token:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate API token",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteToken = async (tokenId: string) => {
    setIsDeleting(tokenId);
    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "API token deleted successfully",
      });

      fetchTokens();
    } catch (error) {
      console.error('Error deleting token:', error);
      toast({
        title: "Error",
        description: "Failed to delete API token",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API token copied to clipboard",
    });
  };

  const toggleShowToken = (tokenId: string) => {
    setShowToken(showToken === tokenId ? null : tokenId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>External API Access</DialogTitle>
          <DialogDescription>
            Generate API tokens to allow external systems to add reservations directly to your database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> Keep your API tokens secure. Anyone with a token can add reservations to your system.
            </AlertDescription>
          </Alert>

          {/* API Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">API Documentation</CardTitle>
              <CardDescription>How to use the external reservation API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Endpoint:</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm">
                  POST https://blsrpowvuxcvhqkeykyi.supabase.co/functions/v1/external-reservation-ingest
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Headers:</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm">
                  Content-Type: application/json<br/>
                  X-Integration-Token: YOUR_API_TOKEN
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Request Body:</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm whitespace-pre-wrap">
{`{
  "reservation": {
    "customer_name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "party_size": 4,
    "date": "2025-01-15",
    "time": "19:00:00",
    "notes": "Anniversary dinner",
    "status": "confirmed"
  },
  "isUpdate": false
}`}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">API Tokens</CardTitle>
                <CardDescription>Manage your integration tokens</CardDescription>
              </div>
              <Button 
                onClick={generateToken} 
                disabled={isGenerating}
                className="shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Token'}
              </Button>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No API tokens generated yet. Click "Generate Token" to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {tokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm">
                            {showToken === token.id ? token.auth_token : '•'.repeat(40)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleShowToken(token.id)}
                          >
                            {showToken === token.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(token.auth_token)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Created: {new Date(token.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={token.connected ? "default" : "secondary"}>
                          {token.connected ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteToken(token.id)}
                          disabled={isDeleting === token.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExternalApiModal;