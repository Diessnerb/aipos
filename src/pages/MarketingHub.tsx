import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { UnifiedDashboard } from '@/components/marketing/UnifiedDashboard';
import { AssetsLibrary } from '@/components/marketing/AssetsLibrary';
import { BrandKit } from '@/components/marketing/BrandKit';
import { ApprovalQueue } from '@/components/marketing/ApprovalQueue';
import { IntegrationSetupPrompt } from '@/components/marketing/IntegrationSetupPrompt';
import { useCompanyFeatures } from '@/hooks/useCompanyFeatures';
import { useIntegrationsCheck } from '@/hooks/useIntegrationsCheck';
import { usePendingApprovals } from '@/hooks/useMarketingData';
import { Sparkles, Plus, Instagram, Facebook, Image, Palette, CheckSquare, Users, BarChart3 } from 'lucide-react';

// Lazy load heavy components
const CampaignCreator = lazy(() => import('@/components/marketing/CampaignCreator').then(m => ({ default: m.CampaignCreator })));
const MarketingAnalytics = lazy(() => import('@/components/marketing/MarketingAnalytics').then(m => ({ default: m.MarketingAnalytics })));

export default function MarketingHub() {
  const navigate = useNavigate();
  const { hasFeature, features } = useCompanyFeatures();
  const { isServiceConnected, hasAnyIntegrations, getConnectedPlatforms, loading: integrationsLoading } = useIntegrationsCheck();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCampaignCreator, setShowCampaignCreator] = useState(false);

  const isPremium = hasFeature('marketing');
  
  // Debug logging for marketing feature check
  console.log('🎯 Marketing Hub Feature Check:', {
    isPremium,
    allFeatures: features,
    marketingFeature: features?.find(f => f.feature_name === 'marketing')
  });
  const hasInstagram = isServiceConnected('instagram');
  const hasFacebook = isServiceConnected('facebook');
  const hasAnySocial = hasInstagram || hasFacebook;
  const connectedPlatforms = getConnectedPlatforms();
  
  const { data: pendingApprovals } = usePendingApprovals();
  const pendingCount = pendingApprovals?.length || 0;

  // Show integration setup prompt if premium but no integrations
  const showIntegrationPrompt = isPremium && !hasAnySocial && !integrationsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Hub"
        subtitle="AI-powered marketing campaigns and analytics"
      >
        {isPremium && (
          <Button onClick={() => setShowCampaignCreator(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        )}
      </PageHeader>

      {/* Plan Status Badge */}
      {isPremium && (
        <div className="flex gap-2">
          <Badge variant="default" className="text-sm bg-purple-600">
            <Sparkles className="h-3 w-3 mr-1" />
            Premium Plan
          </Badge>
          {hasInstagram && (
            <Badge variant="outline" className="gap-1 text-sm">
              <Instagram className="h-3 w-3" />
              Instagram Connected
            </Badge>
          )}
          {hasFacebook && (
            <Badge variant="outline" className="gap-1 text-sm">
              <Facebook className="h-3 w-3" />
              Facebook Connected
            </Badge>
          )}
        </div>
      )}

      {/* Upgrade Prompt for non-premium users */}
      {!isPremium && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Unlock Marketing Hub
            </CardTitle>
            <CardDescription>
              Upgrade to access advanced marketing features including automated campaigns, 
              customer segmentation, and detailed analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/settings?tab=billing')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Integration Setup Prompt */}
      {showIntegrationPrompt && (
        <IntegrationSetupPrompt 
          hasIntegrations={hasAnyIntegrations} 
          connectedPlatforms={connectedPlatforms.map(p => p.service_name)} 
        />
      )}

      {/* Premium Content */}
      {isPremium && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="assets">
              <Image className="w-4 h-4 mr-2" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="brand">
              <Palette className="w-4 h-4 mr-2" />
              Brand Kit
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <CheckSquare className="w-4 h-4 mr-2" />
              Approvals
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="customers">
              <Users className="w-4 h-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <UnifiedDashboard onCreateCampaign={() => setShowCampaignCreator(true)} />
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            <AssetsLibrary />
          </TabsContent>

          <TabsContent value="brand" className="space-y-4">
            <BrandKit />
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <ApprovalQueue />
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>
                  Create and manage your marketing campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowCampaignCreator(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Campaign
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Database</CardTitle>
                <CardDescription>
                  Manage segments and track customer engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Customer management features coming soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Suspense fallback={<div>Loading analytics...</div>}>
              <MarketingAnalytics />
            </Suspense>
          </TabsContent>
        </Tabs>
      )}

      {/* Campaign Creator Modal */}
      {showCampaignCreator && (
        <Suspense fallback={<div>Loading...</div>}>
          <CampaignCreator
            isOpen={showCampaignCreator}
            onClose={() => setShowCampaignCreator(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
