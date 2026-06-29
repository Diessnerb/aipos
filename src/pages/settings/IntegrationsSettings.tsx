import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Search, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { integrationsRegistry, INTEGRATION_CATEGORIES, Integration } from '@/config/integrationsRegistry';
import { GenericApiKeyModal } from '@/components/settings/GenericApiKeyModal';
import { EnhancedIntegrationModal } from '@/components/settings/EnhancedIntegrationModal';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useOAuthCallback } from '@/hooks/useOAuthCallback';

const IntegrationsSettings = () => {
  const navigate = useNavigate();
  const deviceLive = useDeviceLiveLayer();
  const { integrations, loading, connectIntegration, disconnectIntegration, getIntegrationStatus } = useIntegrations();
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Handle OAuth callback after redirect
  useOAuthCallback();

  const getActionButton = (integrationId: string, integration: Integration) => {
    const statusInfo = getIntegrationStatus(integrationId);
    
    if (!integration.isActive) {
      return { text: 'Coming Soon', variant: 'outline' as const, disabled: true };
    }
    
    switch (statusInfo.status) {
      case 'connected':
        return { text: 'Connected', variant: 'default' as const, disabled: false, connected: true };
      case 'pending':
        return { text: 'Complete', variant: 'outline' as const, disabled: false, connected: false };
      case 'error':
        return { text: 'Reconnect', variant: 'destructive' as const, disabled: false, connected: false };
      default:
        return { text: 'Connect', variant: 'outline' as const, disabled: false, connected: false };
    }
  };

  const handleIntegrationClick = (integration: any) => {
    if (!integration.isActive) return;
    setSelectedIntegration(integration);
  };

  const handleModalClose = () => {
    setSelectedIntegration(null);
  };

  const handleConnect = async (integrationId: string, credentials: any) => {
    const result = await connectIntegration(integrationId, credentials);
    if (result.success) {
      setSelectedIntegration(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    const result = await disconnectIntegration(integrationId);
    if (result.success) {
      setSelectedIntegration(null);
    }
  };

  const filteredIntegrations = integrationsRegistry.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Object.values(INTEGRATION_CATEGORIES)];

  if (loading && !deviceLive) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold">Third-Party Integrations</h1>
          <p className="text-muted-foreground">Connect and manage external services</p>
        </div>

        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Button>
      </div>

      <PageHeader 
        title="Third-Party Integrations" 
        subtitle="Connect and manage external services to enhance your workflow" 
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Integrations Grid - 5 columns on large screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredIntegrations.map((integration) => {
          const actionButton = getActionButton(integration.id, integration);
          const IconComponent = integration.icon;
          
          // Create brand-specific styling
          const cardStyle = integration.brandGradient ? {
            background: integration.brandGradient,
            padding: '2px',
            borderRadius: '12px'
          } : {};
          
          const borderStyle = integration.brandColor && !integration.brandGradient ? {
            borderColor: integration.brandColor,
            borderWidth: '2px'
          } : {};

          const buttonStyle = integration.brandColor ? {
            backgroundColor: integration.brandColor,
            borderColor: integration.brandColor,
            color: integration.brandTextColor || (integration.brandColor === '#FFE01B' || integration.brandColor === '#FFCC22' ? '#000000' : '#FFFFFF')
          } : {};

          const logoContainerStyle = integration.logoBg ? {
            backgroundColor: integration.logoBg,
            borderRadius: '8px',
            padding: '4px'
          } : {};

          return (
            <div key={integration.id} style={cardStyle}>
              <Card 
                className={`group relative p-4 transition-all duration-300 hover:shadow-lg ${
                  integration.isActive ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-60'
                } ${actionButton.connected ? 'ring-2 ring-opacity-30' : ''} ${
                  integration.brandGradient ? 'bg-card border-0' : ''
                }`}
                style={integration.brandGradient ? {} : borderStyle}
                onClick={() => handleIntegrationClick(integration)}
              >
                <CardContent className="p-0 flex flex-col items-center text-center space-y-3">
                  {/* Logo Container */}
                  <div className="w-16 h-16 flex items-center justify-center" style={logoContainerStyle}>
                    {integration.logo ? (
                      <img 
                        src={integration.logo} 
                        alt={`${integration.name} logo`}
                        className="w-12 h-12 object-contain"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <IconComponent 
                      className={`w-12 h-12 ${integration.logo ? 'hidden' : 'block'}`}
                      style={{ color: integration.brandColor || 'currentColor' }}
                    />
                  </div>

                  {/* Status Badge */}
                  {actionButton.connected && (
                    <div className="absolute -top-1 -right-1">
                      <div className="rounded-full p-1" style={{ backgroundColor: integration.brandColor || 'hsl(var(--primary))' }}>
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Coming Soon Badge */}
                  {integration.comingSoon && (
                    <Badge variant="secondary" className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1">
                      Soon
                    </Badge>
                  )}

                  {/* Integration Name - Always Visible */}
                  <div className="mt-2 min-h-[2.5rem] flex items-center">
                    <h3 className="text-xs font-semibold text-center leading-tight text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                      {integration.name}
                    </h3>
                  </div>

                  {/* Connect Button */}
                  <Button
                    variant={actionButton.connected ? 'default' : 'outline'}
                    size="sm"
                    className="w-full text-xs font-medium transition-all hover:scale-105 mt-2"
                    style={!actionButton.connected && integration.brandColor ? buttonStyle : {}}
                    disabled={actionButton.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIntegrationClick(integration);
                    }}
                  >
                    {actionButton.text}
                  </Button>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {selectedIntegration && selectedIntegration.connectionType === 'api_key' && (
        <GenericApiKeyModal
          isOpen={true}
          onClose={handleModalClose}
          integration={selectedIntegration}
          currentIntegration={getIntegrationStatus(selectedIntegration.id).integration}
        />
      )}

      {selectedIntegration && selectedIntegration.connectionType === 'oauth' && (
        <EnhancedIntegrationModal
          isOpen={true}
          onClose={handleModalClose}
          service={selectedIntegration.id}
          serviceName={selectedIntegration.name}
          isConnected={getIntegrationStatus(selectedIntegration.id).status === 'connected'}
          onConnect={() => handleConnect(selectedIntegration.id, {})}
          onDisconnect={() => handleDisconnect(selectedIntegration.id)}
        />
      )}

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No integrations found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default IntegrationsSettings;