import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, platform, data_type } = await req.json();

    console.log(`Processing marketing sync for company ${company_id}, platform ${platform}`);

    // Check if company has marketing permissions
    const { data: permissions, error: permError } = await supabase
      .from('marketing_permissions')
      .select('*')
      .eq('company_id', company_id)
      .eq('platform', platform)
      .eq('analytics_access', true)
      .single();

    if (permError || !permissions) {
      console.log(`No permissions found for company ${company_id} on ${platform}`);
      return new Response(
        JSON.stringify({ error: 'No analytics permissions for this platform' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get integration details
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('company_id', company_id)
      .eq('service_name', platform)
      .eq('connected', true)
      .single();

    if (intError || !integration) {
      console.log(`No connected integration found for ${platform}`);
      return new Response(
        JSON.stringify({ error: 'Platform not connected' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync data based on platform
    let syncResult;
    switch (platform) {
      case 'instagram':
        syncResult = await syncInstagramData(integration, company_id);
        break;
      case 'facebook':
        syncResult = await syncFacebookData(integration, company_id);
        break;
      case 'email':
        syncResult = await syncEmailData(integration, company_id);
        break;
      case 'sms':
        syncResult = await syncSmsData(integration, company_id);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`Sync completed for ${platform}:`, syncResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        platform,
        synced_records: syncResult?.count || 0,
        message: 'Marketing data synced successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Marketing sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncInstagramData(integration: any, companyId: string) {
  console.log('Syncing Instagram data for company:', companyId);
  
  const accessToken = integration.auth_token;
  const metadata = integration.metadata;
  const instagramBusinessAccountId = metadata?.instagram_business_account_id;
  
  if (!accessToken) {
    throw new Error('No access token found for Instagram');
  }
  
  if (!instagramBusinessAccountId) {
    throw new Error('No Instagram Business Account ID found');
  }

  console.log('Fetching data for Instagram account:', instagramBusinessAccountId);

  try {
    // 1. Fetch account insights (impressions, reach, profile views) - last 28 days aggregate
    // Note: Instagram API uses period=days_28 for 28-day totals (no since/until params)
    const insightsUrl = `https://graph.instagram.com/${instagramBusinessAccountId}/insights?metric=impressions,reach,profile_views&period=days_28&access_token=${accessToken}`;
    
    const insightsResponse = await fetch(insightsUrl);
    
    if (!insightsResponse.ok) {
      const errorText = await insightsResponse.text();
      console.error('Instagram Insights API error:', insightsResponse.status, errorText);
      
      if (insightsResponse.status === 401) {
        throw new Error('Instagram token expired. Please reconnect your Instagram account.');
      }
      if (insightsResponse.status === 429) {
        throw new Error('Instagram rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`Instagram API error: ${insightsResponse.statusText}`);
    }
    
    const insightsData = await insightsResponse.json();
    console.log('Instagram insights fetched:', insightsData);

    // 2. Fetch recent media (last 25 posts)
    const mediaUrl = `https://graph.instagram.com/${instagramBusinessAccountId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${accessToken}`;
    
    const mediaResponse = await fetch(mediaUrl);
    
    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error('Instagram Media API error:', mediaResponse.status, errorText);
      throw new Error(`Failed to fetch Instagram media: ${mediaResponse.statusText}`);
    }
    
    const mediaData = await mediaResponse.json();
    console.log('Instagram media fetched:', mediaData.data?.length || 0, 'posts');

    // 3. Fetch account info (followers count)
    const accountUrl = `https://graph.instagram.com/${instagramBusinessAccountId}?fields=followers_count,media_count&access_token=${accessToken}`;
    
    const accountResponse = await fetch(accountUrl);
    
    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error('Instagram Account API error:', accountResponse.status, errorText);
      throw new Error(`Failed to fetch Instagram account: ${accountResponse.statusText}`);
    }
    
    const accountData = await accountResponse.json();
    console.log('Instagram account fetched:', accountData);

    // Store posts
    if (mediaData.data && mediaData.data.length > 0) {
      const postsToInsert = mediaData.data.map((post: any) => ({
        company_id: companyId,
        platform: 'instagram',
        post_id: post.id,
        content: post.caption || '',
        image_urls: post.media_url ? [post.media_url] : [],
        posted_at: post.timestamp,
        likes_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
        shares_count: 0,
        impressions_count: 0, // Will be calculated from insights
      }));

      const { error: postsError } = await supabase
        .from('social_media_posts')
        .upsert(postsToInsert, { onConflict: 'post_id' });

      if (postsError) {
        console.error('Error storing Instagram posts:', postsError);
        throw postsError;
      }
      
      console.log('Stored', postsToInsert.length, 'Instagram posts');
    }

    // Store insights
    if (insightsData.data && insightsData.data.length > 0) {
      const insightsToInsert: any[] = [];
      const todayDate = new Date().toISOString().split('T')[0];
      
      for (const insight of insightsData.data) {
        if (insight.values && insight.values.length > 0) {
          // Get the most recent value for each metric
          const latestValue = insight.values[insight.values.length - 1];
          
          insightsToInsert.push({
            company_id: companyId,
            platform: 'instagram',
            date: todayDate,
            metric_type: insight.name,
            metric_value: latestValue.value || 0,
          });
        }
      }
      
      // Add followers count as a metric
      if (accountData.followers_count) {
        insightsToInsert.push({
          company_id: companyId,
          platform: 'instagram',
          date: todayDate,
          metric_type: 'followers_count',
          metric_value: accountData.followers_count,
        });
      }

      if (insightsToInsert.length > 0) {
        const { error: insightsError } = await supabase
          .from('marketing_analytics')
          .upsert(insightsToInsert, { 
            onConflict: 'company_id,platform,date,metric_type' 
          });

        if (insightsError) {
          console.error('Error storing Instagram insights:', insightsError);
          throw insightsError;
        }
        
        console.log('Stored', insightsToInsert.length, 'Instagram insights');
      }
    }

    // Update last_synced_at
    await supabase
      .from('integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', integration.id);

    const totalRecords = (mediaData.data?.length || 0) + (insightsData.data?.length || 0);
    return { count: totalRecords };
    
  } catch (error) {
    console.error('Instagram sync error:', error);
    throw error;
  }
}

async function syncFacebookData(integration: any, companyId: string) {
  console.log('Syncing Facebook data for company:', companyId);
  
  // Mock Facebook API call - replace with actual Facebook Graph API
  const mockData = {
    posts: [
      {
        id: 'fb_post_1',
        message: 'Join us tonight for our special dinner menu!',
        created_time: new Date().toISOString(),
        likes: { summary: { total_count: 89 } },
        comments: { summary: { total_count: 15 } },
        shares: { count: 12 },
      }
    ],
    insights: [
      { metric: 'reach', value: 1800 },
      { metric: 'impressions', value: 2400 },
      { metric: 'likes', value: 89 },
      { metric: 'shares', value: 12 },
    ]
  };

  // Store posts
  for (const post of mockData.posts) {
    await supabase.from('social_media_posts').upsert({
      company_id: companyId,
      platform: 'facebook',
      post_id: post.id,
      content: post.message,
      posted_at: post.created_time,
      likes_count: post.likes?.summary?.total_count || 0,
      comments_count: post.comments?.summary?.total_count || 0,
      shares_count: post.shares?.count || 0,
    });
  }

  // Store analytics
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  
  for (const insight of mockData.insights) {
    await supabase.from('marketing_analytics').upsert({
      company_id: companyId,
      platform: 'facebook',
      metric_type: insight.metric,
      metric_value: insight.value,
      date: today,
      hour: currentHour,
    });
  }

  return { count: mockData.posts.length + mockData.insights.length };
}

async function syncEmailData(integration: any, companyId: string) {
  console.log('Syncing Email data for company:', companyId);
  
  // Mock email analytics - replace with actual email provider API
  const mockData = {
    campaigns: [
      {
        id: 'email_1',
        subject: 'Weekly Special Menu',
        sent_at: new Date().toISOString(),
        opens: 245,
        clicks: 67,
        delivered: 500,
      }
    ],
    insights: [
      { metric: 'views', value: 245 },
      { metric: 'clicks', value: 67 },
      { metric: 'reach', value: 500 },
    ]
  };

  // Store email campaigns as posts
  for (const campaign of mockData.campaigns) {
    await supabase.from('social_media_posts').upsert({
      company_id: companyId,
      platform: 'email',
      post_id: campaign.id,
      content: campaign.subject,
      posted_at: campaign.sent_at,
      views_count: campaign.opens || 0,
      clicks_count: campaign.clicks || 0,
    });
  }

  // Store analytics
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  
  for (const insight of mockData.insights) {
    await supabase.from('marketing_analytics').upsert({
      company_id: companyId,
      platform: 'email',
      metric_type: insight.metric,
      metric_value: insight.value,
      date: today,
      hour: currentHour,
    });
  }

  return { count: mockData.campaigns.length + mockData.insights.length };
}

async function syncSmsData(integration: any, companyId: string) {
  console.log('Syncing SMS data for company:', companyId);
  
  // Mock SMS analytics - replace with actual SMS provider API
  const mockData = {
    campaigns: [
      {
        id: 'sms_1',
        message: 'Last chance for tonight\'s special! Book now.',
        sent_at: new Date().toISOString(),
        delivered: 150,
        clicks: 23,
      }
    ],
    insights: [
      { metric: 'reach', value: 150 },
      { metric: 'clicks', value: 23 },
    ]
  };

  // Store SMS campaigns as posts
  for (const campaign of mockData.campaigns) {
    await supabase.from('social_media_posts').upsert({
      company_id: companyId,
      platform: 'sms',
      post_id: campaign.id,
      content: campaign.message,
      posted_at: campaign.sent_at,
      clicks_count: campaign.clicks || 0,
    });
  }

  // Store analytics
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  
  for (const insight of mockData.insights) {
    await supabase.from('marketing_analytics').upsert({
      company_id: companyId,
      platform: 'sms',
      metric_type: insight.metric,
      metric_value: insight.value,
      date: today,
      hour: currentHour,
    });
  }

  return { count: mockData.campaigns.length + mockData.insights.length };
}