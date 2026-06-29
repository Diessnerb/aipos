
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertTriangle, XCircle, ExternalLink, Info, AlertCircle, Copy, Clock } from 'lucide-react';

interface Integration {
  id: string;
  service_name: string;
  connected: boolean;
  auth_token: string | null;
  created_at: string;
  last_synced_at?: string | null;
}

interface ServiceConfig {
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  serviceConfig: ServiceConfig;
  currentIntegration?: Integration;
}

const IntegrationModal = ({
  isOpen,
  onClose,
  serviceName,
  serviceConfig,
  currentIntegration
}: IntegrationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [envVarsConfigured, setEnvVarsConfigured] = useState(false);
  const { toast } = useToast();

  const IconComponent = serviceConfig.icon;

  // Check if required environment variables are configured
  useEffect(() => {
    const checkEnvVars = async () => {
      if (serviceName === 'instagram') {
        try {
          const { data, error } = await supabase.functions.invoke('instagram-oauth', {
            body: { action: 'check_env_vars' }
          });
          
          if (!error && data?.env_vars_configured) {
            setEnvVarsConfigured(true);
          }
        } catch (error) {
          console.log('Could not check env vars:', error);
        }
      }
    };

    if (isOpen && serviceName === 'instagram') {
      checkEnvVars();
    }
  }, [isOpen, serviceName]);

  const getConnectionStatus = () => {
    if (!currentIntegration) {
      return { status: 'not_connected', label: 'Not Connected', variant: 'secondary' as const, icon: AlertTriangle };
    }

    if (currentIntegration.connected && currentIntegration.auth_token) {
      return { status: 'connected', label: '✓ Connected via Instagram', variant: 'default' as const, icon: CheckCircle };
    }

    if (!currentIntegration.connected && currentIntegration.auth_token) {
      return { status: 'pending', label: '❗ Authorisation Pending', variant: 'destructive' as const, icon: Clock };
    }

    return { status: 'error', label: 'Connection Error', variant: 'destructive' as const, icon: XCircle };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The redirect URI has been copied to your clipboard",
    });
  };

  const handleInstagramOAuth = async () => {
    setLoading(true);
    try {
      // Check if we're in a secure context
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        toast({
          title: "HTTPS Required",
          description: "Instagram OAuth requires a secure HTTPS connection. Please use HTTPS or localhost for development.",
          variant: "destructive",
        });
        return;
      }

      // Get current user to use as company context
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast({
          title: "Error",
          description: "You must be logged in to connect integrations",
          variant: "destructive",
        });
        return;
      }

      // Call our edge function to get the Instagram OAuth URL
      console.log('Calling instagram-oauth edge function...');
      
      const { data, error } = await supabase.functions.invoke('instagram-oauth', {
        body: {
          action: 'get_auth_url',
          user_id: user.id
        }
      });

      if (error) {
        console.error('Error calling instagram-oauth function:', error);
        toast({
          title: "Configuration Error",
          description: "Failed to get Instagram OAuth URL. Please check your Instagram app configuration.",
          variant: "destructive",
        });
        return;
      }

      if (!data?.auth_url) {
        console.error('No auth URL returned from function:', data);
        toast({
          title: "Configuration Error",
          description: data?.debug || "Invalid response from Instagram OAuth service.",
          variant: "destructive",
        });
        return;
      }

      console.log('Got Instagram OAuth URL:', data.auth_url);

      toast({
        title: "Opening Instagram Authorization",
        description: "A new window will open for Instagram authorization.",
      });

      // Open in new window immediately (no delay needed)
      const authWindow = window.open(data.auth_url, '_blank', 'noopener,noreferrer');

      if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        // Popup was blocked - fallback to same window
        toast({
          title: "Popup Blocked",
          description: "Please allow popups and try again, or we'll redirect you now.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.assign(data.auth_url);
        }, 2000);
      }

    } catch (error) {
      console.error('Error initiating Instagram OAuth:', error);
      toast({
        title: "Connection Error",
        description: "Failed to initiate Instagram connection. Please check your Instagram app configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentIntegration) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('integrations')
        .update({
          connected: false,
          auth_token: null
        })
        .eq('id', currentIntegration.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${serviceConfig.name} disconnected successfully`,
      });

      onClose();
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect integration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  // Check if this is Instagram to show OAuth flow
  const isInstagram = serviceName === 'instagram';
  
  // Determine if we should show configuration warnings
  const isSuccessfullyConnected = currentIntegration?.connected && currentIntegration?.auth_token;
  const shouldShowWarnings = isInstagram && !isSuccessfullyConnected && !envVarsConfigured;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-in slide-in-from-bottom-4 fade-in-0">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-lg ${serviceConfig.color} text-white`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">{serviceConfig.name}</DialogTitle>
              <Badge variant={status.variant} className="flex items-center gap-1 w-fit mt-1">
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-sm text-gray-600">
            {serviceConfig.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isInstagram ? (
            <>
              {/* Instagram OAuth Connection */}
              <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50">
                <Button 
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" 
                  onClick={handleInstagramOAuth}
                  disabled={loading || status.status === 'connected'}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {loading ? 'Setting up connection...' : 
                   status.status === 'pending' ? 'Retry OAuth Connection' :
                   status.status === 'connected' ? 'Connected' : 'Connect via Instagram'}
                </Button>
                 <p className="text-xs text-gray-600 mt-2 text-center">
                   You'll be redirected to Instagram to authorise the connection
                 </p>
              </div>

              {/* Show warnings only if not successfully connected and env vars not configured */}
              {shouldShowWarnings && (
                <>
                  {/* Critical Configuration Requirements */}
                  <div className="p-3 border rounded-lg bg-red-50 border-red-200">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-800">
                        <p className="font-medium">Critical: Instagram App Must Be Configured Exactly</p>
                        <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                          <li><strong>App Type:</strong> Must be "Instagram Basic Display" (NOT Graph API)</li>
                          <li><strong>Client ID:</strong> Must be numeric only, no letters or symbols</li>
                          <li><strong>App Status:</strong> Must be "Live" or you must be added as test user</li>
                          <li><strong>Instagram Account:</strong> Must have actual Instagram account (not just Facebook)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Exact Redirect URI */}
                  <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                    <div className="flex items-start space-x-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800 w-full">
                        <p className="font-medium">Exact Redirect URI Required:</p>
                        <div className="bg-blue-100 p-2 rounded mt-1 flex items-center justify-between">
                          <code className="text-xs break-all flex-1">
                            https://blsrpowvuxcvhqkeykyi.functions.supabase.co/oauth-callback
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard('https://blsrpowvuxcvhqkeykyi.functions.supabase.co/oauth-callback')}
                            className="ml-2 h-6 w-6 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs mt-1">
                          Copy this exact URL to your Instagram app's "Valid OAuth Redirect URIs" field
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Troubleshooting Steps */}
                  <div className="p-3 border rounded-lg bg-amber-50 border-amber-200">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">If Still Getting "Invalid Platform App":</p>
                        <ol className="list-decimal list-inside text-xs mt-1 space-y-1">
                          <li>Verify Client ID is purely numeric (check for extra spaces/characters)</li>
                          <li>Ensure app type is "Instagram Basic Display" not "Instagram Graph API"</li>
                          <li>Check app is "Live" in Meta Developer Console</li>
                          <li>Confirm redirect URI matches exactly (case-sensitive)</li>
                          <li>Make sure you have an active Instagram account linked to Facebook</li>
                          <li>Try logging out and back into Facebook/Instagram</li>
                          <li>If you've setup the app with a testing profile, ensure you're listed as tester</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Connection Status & Last Sync - Always show if integration exists */}
              {currentIntegration && (
                <div className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Last attempted sync:</span>
                    <span className="font-medium">
                      {currentIntegration.last_synced_at 
                        ? new Date(currentIntegration.last_synced_at).toLocaleString()
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* OAuth Button (placeholder for other services) */}
              <div className="p-4 border rounded-lg bg-gray-50">
                <Button variant="outline" className="w-full" disabled>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect with OAuth (Coming Soon)
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  OAuth integration will be available in a future update
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            {currentIntegration?.connected && (
              <Button 
                variant="destructive" 
                onClick={handleDisconnect}
                disabled={loading}
              >
                Disconnect
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IntegrationModal;
