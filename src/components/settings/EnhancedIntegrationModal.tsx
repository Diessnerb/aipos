import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, AlertTriangle, Facebook, Instagram, Mail, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

interface Permission {
  key: 'post_access' | 'analytics_access' | 'content_creation' | 'automated_posting';
  label: string;
  description: string;
  required: boolean;
}

const platformPermissions: Record<string, Permission[]> = {
  facebook: [
    { key: 'post_access', label: 'Read Posts', description: 'View your Facebook posts and content', required: true },
    { key: 'analytics_access', label: 'Analytics Data', description: 'Access engagement metrics and insights', required: true },
    { key: 'content_creation', label: 'Content Creation', description: 'Create and schedule posts on your behalf', required: false },
    { key: 'automated_posting', label: 'Automated Posting', description: 'Automatically post generated content', required: false },
  ],
  instagram: [
    { key: 'post_access', label: 'Read Posts', description: 'View your Instagram posts and stories', required: true },
    { key: 'analytics_access', label: 'Analytics Data', description: 'Access engagement metrics and insights', required: true },
    { key: 'content_creation', label: 'Content Creation', description: 'Create and schedule posts on your behalf', required: false },
    { key: 'automated_posting', label: 'Automated Posting', description: 'Automatically post generated content', required: false },
  ],
  email: [
    { key: 'analytics_access', label: 'Campaign Analytics', description: 'View email campaign performance', required: true },
    { key: 'content_creation', label: 'Create Campaigns', description: 'Create and send email campaigns', required: false },
    { key: 'automated_posting', label: 'Automated Emails', description: 'Automatically send generated emails', required: false },
  ],
  sms: [
    { key: 'analytics_access', label: 'SMS Analytics', description: 'View SMS campaign performance', required: true },
    { key: 'content_creation', label: 'Create SMS', description: 'Create and send SMS campaigns', required: false },
    { key: 'automated_posting', label: 'Automated SMS', description: 'Automatically send generated SMS', required: false },
  ],
};

const platformIcons = {
  facebook: Facebook,
  instagram: Instagram,
  email: Mail,
  sms: MessageSquare,
};

interface EnhancedIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: string;
  serviceName: string;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function EnhancedIntegrationModal({
  isOpen,
  onClose,
  service,
  serviceName,
  isConnected,
  onConnect,
  onDisconnect,
}: EnhancedIntegrationModalProps) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const servicePermissions = platformPermissions[service.toLowerCase()] || [];
  const IconComponent = platformIcons[service.toLowerCase() as keyof typeof platformIcons];

  // Initialize permissions when modal opens
  useEffect(() => {
    if (isOpen && servicePermissions.length > 0) {
      const initialPermissions: Record<string, boolean> = {};
      servicePermissions.forEach(permission => {
        // Required permissions are checked by default, optional start as false
        initialPermissions[permission.key] = permission.required;
      });
      setPermissions(initialPermissions);
    }
  }, [isOpen, service]);

  const handlePermissionChange = (key: string, enabled: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: enabled }));
  };

  const handleConnect = async () => {
    const isOAuthService = service.toLowerCase() === 'instagram' || service.toLowerCase() === 'facebook';
    
    if (isOAuthService) {
      // For Instagram/Facebook: Store permissions and redirect to OAuth
      setIsUpdating(true);
      try {
        if (!user) {
          toast({
            title: "Error",
            description: "You must be logged in to connect integrations",
            variant: "destructive",
          });
          return;
        }

        // Store permissions in localStorage for after OAuth redirect
        localStorage.setItem(`pending_permissions_${service.toLowerCase()}`, JSON.stringify(permissions));
        
        // Call edge function to get OAuth URL
        const { data, error } = await supabase.functions.invoke('instagram-oauth', {
          body: {
            action: 'get_auth_url',
            user_id: user.id
          }
        });

        if (error || !data?.auth_url) {
          console.error('Error getting OAuth URL:', error);
          toast({
            title: "Configuration Error",
            description: "Failed to get Instagram OAuth URL. Please check configuration.",
            variant: "destructive",
          });
          setIsUpdating(false);
          return;
        }

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
        console.error('Error initiating OAuth:', error);
        toast({
          title: "Connection Error",
          description: "Failed to initiate connection. Please try again.",
          variant: "destructive",
        });
        setIsUpdating(false);
      }
    } else {
      // For non-OAuth services: Direct connection
      setIsUpdating(true);
      try {
        await onConnect();
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Save permissions to database
        const { error } = await supabase
          .from('marketing_permissions')
          .upsert({
            company_id: user.id,
            platform: service.toLowerCase(),
            ...permissions
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: `${serviceName} connected successfully.`,
        });

        onClose();
      } catch (error) {
        console.error('Error connecting integration:', error);
        toast({
          title: "Error",
          description: "Failed to connect integration. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleDisconnect = async () => {
    setIsUpdating(true);
    try {
      await onDisconnect();
      
      if (user?.id) {
        // Remove permissions from database
        const { error } = await supabase
          .from('marketing_permissions')
          .delete()
          .eq('company_id', user.id)
          .eq('platform', service.toLowerCase());

        if (error) throw error;
      }

      toast({
        title: "Integration Disconnected",
        description: `${serviceName} has been disconnected.`,
      });
      
      onClose();
    } catch (error) {
      console.error('Disconnection error:', error);
      toast({
        title: "Disconnection Error",
        description: "Failed to disconnect integration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {IconComponent && <IconComponent className="w-6 h-6" />}
            {serviceName} Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Status</span>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <><Check className="w-3 h-3 mr-1" /> Connected</>
              ) : (
                <><X className="w-3 h-3 mr-1" /> Disconnected</>
              )}
            </Badge>
          </div>

          {!isConnected && (
            <>
              <Separator />
              
              {/* Permission Request */}
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm">Permissions Required</h4>
                    <p className="text-sm text-muted-foreground">
                      Please grant the following permissions to enable our marketing features:
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {servicePermissions.map(permission => (
                    <div key={permission.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium">
                              {permission.label}
                            </Label>
                            {permission.required && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {permission.description}
                          </p>
                        </div>
                        <Switch
                          checked={permissions[permission.key] || false}
                          onCheckedChange={(enabled) => handlePermissionChange(permission.key, enabled)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Privacy Notice:</strong> We only access data necessary for marketing analytics 
                    and content creation. Your data is never shared with third parties.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isUpdating}>
              Cancel
            </Button>
            {isConnected ? (
              <Button 
                variant="destructive" 
                onClick={handleDisconnect}
                disabled={isUpdating}
              >
                {isUpdating ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            ) : (
              <Button 
                onClick={handleConnect}
                disabled={isUpdating || servicePermissions.some(p => p.required && !permissions[p.key])}
              >
                {isUpdating ? 'Connecting...' : 'Connect & Grant Permissions'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}