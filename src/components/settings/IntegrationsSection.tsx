
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import IntegrationModal from './IntegrationModal';
import ExternalApiModal from './ExternalApiModal';
import { IntegrationsGuard } from './IntegrationsGuard';
import { 
  Instagram, 
  Mail, 
  Youtube,
  Zap,
  Globe,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock
} from 'lucide-react';

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

const SERVICES: Record<string, ServiceConfig> = {
  // Marketing & Social
  external_api: {
    name: 'External API Access',
    description: 'Generate API tokens to allow external systems to add reservations directly to your database.',
    icon: Globe,
    color: 'bg-slate-600'
  },
  instagram: {
    name: 'Instagram',
    description: 'Connect to Instagram to automatically post content and engage with your audience.',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500'
  },
  mailchimp: {
    name: 'Mailchimp',
    description: 'Send newsletters and automated email campaigns directly from your Marketing Hub.',
    icon: Mail,
    color: 'bg-yellow-500'
  },
  twilio: {
    name: 'Twilio',
    description: 'Send SMS notifications and marketing messages to your customers.',
    icon: Zap,
    color: 'bg-red-500'
  },
  meta_ads: {
    name: 'Meta Ads',
    description: 'Create and manage Facebook and Instagram advertising campaigns.',
    icon: Globe,
    color: 'bg-blue-600'
  },
  google_my_business: {
    name: 'Google My Business',
    description: 'Manage your business listing, reviews, and local search presence.',
    icon: Youtube,
    color: 'bg-green-600'
  }
};

const IntegrationsSection = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchIntegrations = async () => {
    try {
      console.log('Fetching integrations...');
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching integrations:', error);
        throw error;
      }

      console.log('Fetched integrations:', data);
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    // Set up real-time subscription for integrations table
    const channel = supabase
      .channel('integrations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'integrations'
        },
        (payload) => {
          console.log('Integration updated:', payload);
          fetchIntegrations(); // Refresh the list when integrations change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getIntegrationStatus = (serviceName: string) => {
    const integration = integrations.find(i => i.service_name === serviceName);
    
    if (!integration) {
      return { status: 'not_connected', label: 'Not Connected', variant: 'secondary' as const, icon: AlertTriangle };
    }

    if (integration.connected && integration.auth_token) {
      return { status: 'connected', label: 'Connected', variant: 'default' as const, icon: CheckCircle };
    }

    if (!integration.connected && integration.auth_token) {
      return { status: 'pending', label: 'Authorization Pending', variant: 'destructive' as const, icon: Clock };
    }

    return { status: 'error', label: 'Connection Error', variant: 'destructive' as const, icon: XCircle };
  };

  const getActionButton = (serviceName: string) => {
    const integration = integrations.find(i => i.service_name === serviceName);
    const status = getIntegrationStatus(serviceName);

    if (status.status === 'connected') {
      return { text: 'Manage', variant: 'outline' as const };
    } else if (status.status === 'pending') {
      return { text: 'Retry Connection', variant: 'destructive' as const };
    } else if (status.status === 'error') {
      return { text: 'Reconnect', variant: 'destructive' as const };
    }
    return { text: 'Connect', variant: 'default' as const };
  };

  const formatLastSynced = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never synced';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Synced recently';
    if (diffInHours < 24) return `Synced ${diffInHours}h ago`;
    return `Synced ${Math.floor(diffInHours / 24)}d ago`;
  };

  const handleServiceClick = (serviceName: string) => {
    setSelectedService(serviceName);
  };

  const handleModalClose = () => {
    setSelectedService(null);
    // The real-time subscription will handle refreshing data automatically
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Loading integrations...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <IntegrationsGuard>
      <Card>
        <CardHeader>
          <CardTitle>Third-Party Integrations</CardTitle>
          <CardDescription>
            Connect your favorite tools and services to power automations in your Marketing Hub
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(SERVICES).map(([serviceKey, service]) => {
              const status = getIntegrationStatus(serviceKey);
              const action = getActionButton(serviceKey);
              const integration = integrations.find(i => i.service_name === serviceKey);
              const IconComponent = service.icon;
              const StatusIcon = status.icon;

              return (
                <Card 
                  key={serviceKey}
                  className="transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer min-w-[320px]"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${service.color} text-white`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{service.name}</CardTitle>
                        </div>
                      </div>
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm mb-3 min-h-[2.5rem]">
                      {service.description}
                    </CardDescription>
                    
                    <div className="border-t pt-3 space-y-3">
                      {integration?.created_at && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatLastSynced(integration.created_at)}
                        </div>
                      )}
                      
                      <Button
                        variant={action.variant}
                        size="sm"
                        className="w-full"
                        onClick={() => handleServiceClick(serviceKey)}
                      >
                        {action.text}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedService && selectedService === 'external_api' && (
        <ExternalApiModal
          isOpen={!!selectedService}
          onClose={handleModalClose}
          currentIntegration={integrations.find(i => i.service_name === selectedService)}
        />
      )}

      {selectedService && selectedService !== 'external_api' && (
        <IntegrationModal
          isOpen={!!selectedService}
          onClose={handleModalClose}
          serviceName={selectedService}
          serviceConfig={SERVICES[selectedService]}
          currentIntegration={integrations.find(i => i.service_name === selectedService)}
        />
      )}
    </IntegrationsGuard>
  );
};

export default IntegrationsSection;
