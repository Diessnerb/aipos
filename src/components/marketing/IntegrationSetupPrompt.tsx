import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettingsPermissions } from '@/hooks/useSettingsPermissions';
import { useRestaurantOwner } from '@/hooks/useRestaurantOwner';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Instagram, 
  Mail, 
  Globe, 
  Zap,
  CheckCircle,
  ArrowRight,
  Lock
} from 'lucide-react';

interface IntegrationSetupPromptProps {
  hasIntegrations: boolean;
  connectedPlatforms: string[];
}

const PLATFORM_CONFIGS = {
  instagram: { name: 'Instagram', icon: Instagram, color: 'from-purple-500 to-pink-500' },
  mailchimp: { name: 'Mailchimp', icon: Mail, color: 'from-yellow-500 to-orange-500' },
  meta_ads: { name: 'Meta Ads', icon: Globe, color: 'from-blue-500 to-blue-600' },
  twilio: { name: 'Twilio', icon: Zap, color: 'from-red-500 to-red-600' }
};

export const IntegrationSetupPrompt: React.FC<IntegrationSetupPromptProps> = ({
  hasIntegrations,
  connectedPlatforms
}) => {
  const { canAccessIntegrations } = useSettingsPermissions();
  const { ownerName, loading: ownerLoading } = useRestaurantOwner();
  const navigate = useNavigate();

  const handleNavigateToSettings = () => {
    if (canAccessIntegrations) {
      navigate('/settings/integrations');
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/5 backdrop-blur-[2px]">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Settings className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Connect Your Platforms</CardTitle>
          <CardDescription className="text-base">
            To unlock the power of Marketing Hub, connect your social media and marketing platforms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          {hasIntegrations && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Connected Platforms</h4>
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.map((platform) => {
                  const config = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];
                  if (!config) return null;
                  
                  const IconComponent = config.icon;
                  return (
                    <Badge key={platform} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                      <IconComponent className="w-4 h-4" />
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      {config.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform Grid */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">
              {hasIntegrations ? 'Available Platforms' : 'Connect These Platforms'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PLATFORM_CONFIGS).map(([key, config]) => {
                const IconComponent = config.icon;
                const isConnected = connectedPlatforms.includes(key);
                
                return (
                  <div 
                    key={key}
                    className={`p-3 rounded-lg border transition-all ${
                      isConnected ? 'bg-green-50 border-green-200' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded bg-gradient-to-r ${config.color} text-white`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{config.name}</span>
                          {isConnected && <CheckCircle className="w-4 h-4 text-green-600" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connection Steps */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Quick Setup Steps:</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Click "Go to Integrations" below</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Choose your platform and click "Connect"</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Authorise the connection in the popup</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Return here to access your Marketing Hub</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex gap-3">
            {canAccessIntegrations ? (
              <Button 
                onClick={handleNavigateToSettings}
                className="flex-1 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Go to Integrations
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                disabled
                className="flex-1 flex items-center gap-2"
                variant="secondary"
              >
                <Lock className="w-4 h-4" />
                {ownerLoading 
                  ? "Contact Restaurant Owner" 
                  : `You don't have access - Contact ${ownerName}`
                }
              </Button>
            )}
          </div>

          {!canAccessIntegrations && (
            <p className="text-xs text-muted-foreground text-center">
              {ownerLoading 
                 ? "Only authorised staff can configure integrations. Contact the restaurant owner to set up platform connections."
                 : `Only authorised staff can configure integrations. Contact ${ownerName} to set up platform connections.`
              }
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};