import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import IntegrationModal from './IntegrationModal';
import ExpandableSettingsCard from './ExpandableSettingsCard';

interface Integration {
  id: string;
  service_name: string;
  connected: boolean;
  auth_token: string | null;
  created_at: string;
  last_synced_at: string | null;
}

interface ServiceConfig {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const SERVICES: Record<string, ServiceConfig> = {
  instagram: {
    name: 'Instagram',
    description: 'Connect your Instagram account for social media management',
    icon: '📷',
    color: 'bg-pink-500'
  },
  mailchimp: {
    name: 'Mailchimp',
    description: 'Sync customer data with your email marketing campaigns',
    icon: '📧',
    color: 'bg-yellow-500'
  },
  stripe: {
    name: 'Stripe',
    description: 'Process payments and manage billing',
    icon: '💳',
    color: 'bg-blue-500'
  },
  google_analytics: {
    name: 'Google Analytics',
    description: 'Track website performance and user behaviour',
    icon: '📊',
    color: 'bg-orange-500'
  },
  slack: {
    name: 'Slack',
    description: 'Send notifications to your team workspace',
    icon: '💬',
    color: 'bg-purple-500'
  }
};

const ExpandableIntegrationsCard = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*');

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('integrations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations' }, () => {
        fetchIntegrations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getIntegrationStatus = (serviceName: string) => {
    const integration = integrations.find(i => i.service_name === serviceName);
    
    if (!integration) {
      return { status: 'not_connected', label: 'Not Connected', variant: 'secondary' as const };
    }
    
    if (integration.connected && integration.auth_token) {
      return { status: 'connected', label: 'Connected', variant: 'default' as const };
    }
    
    if (integration.auth_token && !integration.connected) {
      return { status: 'pending', label: 'Pending', variant: 'outline' as const };
    }
    
    return { status: 'error', label: 'Error', variant: 'destructive' as const };
  };

  const getActionButton = (serviceName: string) => {
    const status = getIntegrationStatus(serviceName).status;
    
    switch (status) {
      case 'connected':
        return { text: 'Manage', variant: 'outline' as const };
      case 'pending':
        return { text: 'Complete Setup', variant: 'default' as const };
      case 'error':
        return { text: 'Reconnect', variant: 'destructive' as const };
      default:
        return { text: 'Connect', variant: 'default' as const };
    }
  };

  const formatLastSynced = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never';
    
    try {
      const date = new Date(timestamp);
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        'day'
      );
    } catch {
      return 'Unknown';
    }
  };

  const handleServiceClick = (serviceName: string) => {
    setSelectedService(serviceName);
  };

  const handleModalClose = () => {
    setSelectedService(null);
  };

  if (loading) {
    return (
      <ExpandableSettingsCard
        title="Third-Party Integrations"
        description="Connect and manage external services"
        icon={<Plug className="w-5 h-5 text-primary" />}
      >
        <div className="text-center py-4">Loading integrations...</div>
      </ExpandableSettingsCard>
    );
  }

  return (
    <ExpandableSettingsCard
      title="Third-Party Integrations"
      description="Connect and manage external services"
      icon={<Plug className="w-5 h-5 text-primary" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your favorite tools and services to streamline your workflow
        </p>

        <div className="grid gap-4">
          {Object.entries(SERVICES).map(([serviceName, config]) => {
            const status = getIntegrationStatus(serviceName);
            const actionButton = getActionButton(serviceName);
            const integration = integrations.find(i => i.service_name === serviceName);

            return (
              <div
                key={serviceName}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center text-white text-lg`}>
                    <span role="img" aria-label={config.name}>{config.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{config.name}</h4>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                    {integration && integration.last_synced_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {formatLastSynced(integration.last_synced_at)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Button
                    variant={actionButton.variant}
                    size="sm"
                    onClick={() => handleServiceClick(serviceName)}
                  >
                    {actionButton.text}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedService && (
          <IntegrationModal
            isOpen={true}
            onClose={handleModalClose}
            serviceName={selectedService}
            serviceConfig={{
              name: SERVICES[selectedService].name,
              description: SERVICES[selectedService].description,
              icon: () => <span role="img" aria-label={SERVICES[selectedService].name}>{SERVICES[selectedService].icon}</span>,
              color: SERVICES[selectedService].color
            }}
            currentIntegration={integrations.find(i => i.service_name === selectedService)}
          />
        )}
      </div>
    </ExpandableSettingsCard>
  );
};

export default ExpandableIntegrationsCard;