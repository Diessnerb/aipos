import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Integration } from '@/config/integrationsRegistry';

interface GenericApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: Integration;
  currentIntegration?: any;
}

export const GenericApiKeyModal: React.FC<GenericApiKeyModalProps> = ({
  isOpen,
  onClose,
  integration,
  currentIntegration
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, string>>({});

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPassword(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const handleInputChange = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleConnect = async () => {
    if (!integration.fields) return;

    // Validate required fields
    const missingFields = integration.fields
      .filter(field => field.required && !formData[field.name])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) throw new Error('No company found');

      // Store the API key securely
      const { error } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          company_id: userData.company_id,
          service_name: integration.id,
          auth_token: JSON.stringify(formData),
          connected: true,
          last_synced_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name,company_id'
        });

      if (error) throw error;

      toast({
        title: 'Integration Connected',
        description: `${integration.name} has been successfully connected to your account.`
      });

      onClose();
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to the service.',
        variant: 'destructive'
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
          auth_token: null,
          last_synced_at: null
        })
        .eq('id', currentIntegration.id);

      if (error) throw error;

      toast({
        title: 'Integration Disconnected',
        description: `${integration.name} has been disconnected from your account.`
      });

      onClose();
    } catch (error) {
      console.error('Disconnection error:', error);
      toast({
        title: 'Disconnection Failed',
        description: 'Failed to disconnect the service.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const isConnected = currentIntegration?.connected;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <integration.icon className="w-6 h-6" />
            {integration.name} Integration
          </DialogTitle>
          <DialogDescription>
            {isConnected 
              ? `Manage your ${integration.name} integration settings`
              : integration.description
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700">
                    Connected to {integration.name}
                  </span>
                </div>
                {currentIntegration.last_synced_at && (
                  <p className="text-xs text-green-600 mt-1">
                    Last synced: {new Date(currentIntegration.last_synced_at).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleDisconnect}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                >
                  {loading ? 'Disconnecting...' : 'Disconnect'}
                </Button>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {integration.fields?.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      type={field.type === 'password' && !showPassword[field.name] ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      className="pr-10"
                    />
                    {field.type === 'password' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility(field.name)}
                      >
                        {showPassword[field.name] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Need help finding your API keys? Check the {integration.name} documentation.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Connecting...' : 'Connect'}
                </Button>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};