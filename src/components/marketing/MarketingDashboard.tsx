import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share, Users, Phone, Upload } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import { useMarketingAnalytics, useSocialMediaPosts, useConnectedPlatforms, useSubscriptionFeatures } from '@/hooks/useMarketingAnalytics';
import { TEST_MARKETING_DATA } from '@/utils/testData';
import { BulkImageUpload } from './BulkImageUpload';

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

const dateRanges: DateRange[] = [
  { start: subDays(new Date(), 7), end: new Date(), label: '1 Week' },
  { start: subDays(new Date(), 30), end: new Date(), label: '1 Month' },
  { start: subDays(new Date(), 90), end: new Date(), label: '3 Months' },
  { start: subYears(new Date(), 1), end: new Date(), label: '1 Year' },
];

const platformColors = {
  facebook: '#1877f2',
  instagram: '#E4405F',
  email: '#34A853',
  sms: '#FF6B6B'
};

interface MarketingDashboardProps {
  isPremium: boolean;
}

export function MarketingDashboard({ isPremium }: MarketingDashboardProps) {
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(dateRanges[1]); // Default to 1 month
  const [activeView, setActiveView] = useState<'overview' | string>('overview');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  
  const connectedPlatforms = useConnectedPlatforms();
  const { data: analytics } = useMarketingAnalytics(selectedDateRange);
  const { data: posts } = useSocialMediaPosts(activeView === 'overview' ? undefined : activeView);
  const { data: subscriptionFeatures } = useSubscriptionFeatures();

  // Use test data for preview when not premium, real data when premium
  const displayPosts = isPremium ? (posts || []) : TEST_MARKETING_DATA.socialPosts;

  // Calculate performance indicators
  const getPerformanceColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change >= -5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  // Show empty state if no platforms connected (only for premium users)
  if (connectedPlatforms.length === 0 && isPremium) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>No Integrations Connected</CardTitle>
          <CardDescription>
            Connect your social media accounts and marketing platforms to see analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Get started by connecting your first marketing platform
            </p>
            <Button>
              Connect Platform
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show blurred preview for non-premium users
  if (!isPremium) {
    return (
      <div className="space-y-6">
        {/* Show test data for preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEST_MARKETING_DATA.socialPosts.slice(0, 3).map((post, index) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <Badge variant="outline" className="mb-2 capitalize">
                  {post.platform}
                </Badge>
                <p className="text-sm mb-3 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" /> {post.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {post.comments}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share className="w-3 h-3" /> {post.shares}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Sample Campaign Performance</CardTitle>
            <CardDescription>Example of campaign analytics you'll see with connected platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEST_MARKETING_DATA.campaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{campaign.name}</h4>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Reach: {campaign.reach.toLocaleString()}</p>
                    <p>Engagement: {campaign.engagement}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <MarketingDashboardContent 
      selectedDateRange={selectedDateRange}
      setSelectedDateRange={setSelectedDateRange}
      activeView={activeView}
      setActiveView={setActiveView}
      connectedPlatforms={connectedPlatforms}
      analytics={analytics}
      getPerformanceColor={getPerformanceColor}
      getPerformanceIcon={getPerformanceIcon}
      posts={displayPosts}
      showBulkUpload={showBulkUpload}
      setShowBulkUpload={setShowBulkUpload}
    />
  );
}

interface MarketingDashboardContentProps {
  selectedDateRange: DateRange;
  setSelectedDateRange: (range: DateRange) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  connectedPlatforms: string[];
  analytics: any;
  getPerformanceColor: (change: number) => string;
  getPerformanceIcon: (change: number) => React.ReactNode;
  posts: any[];
  showBulkUpload: boolean;
  setShowBulkUpload: (show: boolean) => void;
}

function MarketingDashboardContent({
  selectedDateRange,
  setSelectedDateRange,
  activeView,
  setActiveView,
  connectedPlatforms,
  analytics,
  getPerformanceColor,
  getPerformanceIcon,
  posts,
  showBulkUpload,
  setShowBulkUpload,
}: MarketingDashboardContentProps) {
  
  // Only show real data when we have it
  const hasAnalyticsData = analytics?.data && analytics.data.length > 0;
  const hasPostsData = posts && posts.length > 0;
  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Marketing Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Track your social media performance and reservations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload Images
          </Button>
          
          <Select 
            value={selectedDateRange.label} 
            onValueChange={(value) => {
              const range = dateRanges.find(r => r.label === value);
              if (range) setSelectedDateRange(range);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map(range => (
                <SelectItem key={range.label} value={range.label}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Platform Toggle */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {connectedPlatforms.map(platform => (
            <TabsTrigger key={platform} value={platform} className="capitalize">
              {platform}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {!hasAnalyticsData && !hasPostsData ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">No Data Available</h3>
                    <p className="text-muted-foreground">
                      Connect your marketing platforms to start tracking performance
                    </p>
                  </div>
                  <Button>Connect Platform</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Only show metrics if we have real data */}
              {hasAnalyticsData && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Real metrics would be calculated from analytics.data */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Real Data</p>
                          <p className="text-lg">Available when connected</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Platform Performance Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        Real performance charts will appear here once platforms are connected and have data
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Social Feed Preview - only if we have posts */}
              {hasPostsData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Posts</CardTitle>
                    <CardDescription>Interactive social media feed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {posts.slice(0, 6).map((post, index) => (
                        <div key={post.id || index} className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer">
                          {post.image_urls?.[0] && (
                            <img 
                              src={post.image_urls[0]} 
                              alt="Post" 
                              className="w-full h-32 object-cover rounded-md mb-3" 
                            />
                          )}
                          <Badge variant="outline" className="mb-2 capitalize">
                            {post.platform}
                          </Badge>
                          <p className="text-sm mb-2 line-clamp-2">{post.content}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" /> {post.likes_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" /> {post.comments_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share className="w-3 h-3" /> {post.shares_count || 0}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {connectedPlatforms.map(platform => (
          <TabsContent key={platform} value={platform} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{platform} Analytics</CardTitle>
                <CardDescription>
                  Detailed performance metrics for {platform}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Platform-specific analytics for {platform} would be displayed here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <BulkImageUpload 
        isOpen={showBulkUpload} 
        onClose={() => setShowBulkUpload(false)} 
      />
    </div>
  );
}