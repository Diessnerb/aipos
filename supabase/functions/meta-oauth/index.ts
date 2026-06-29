import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { action, permissions } = await req.json()
    
    console.log('Meta OAuth action:', action);

    // Check environment variables
    if (action === 'check_env_vars') {
      const metaAppId = Deno.env.get('META_APP_ID');
      const metaAppSecret = Deno.env.get('META_APP_SECRET');
      const metaRedirectUri = Deno.env.get('META_REDIRECT_URI');

      const configured = !!(metaAppId && metaAppSecret && metaRedirectUri);
      
      console.log('Environment check result:', configured);

      return new Response(
        JSON.stringify({ configured }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate authorization URL
    if (action === 'get_auth_url') {
      const metaAppId = Deno.env.get('META_APP_ID');
      const metaRedirectUri = Deno.env.get('META_REDIRECT_URI');

      if (!metaAppId || !metaRedirectUri) {
        throw new Error('Meta OAuth environment variables not configured');
      }

      // Get current user
      const authHeader = req.headers.get('Authorization')!;
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Define scopes based on permissions
      const scopes = ['pages_manage_posts', 'pages_read_engagement'];
      
      if (permissions?.includes('messaging_access')) {
        scopes.push('pages_messaging');
      }
      if (permissions?.includes('analytics_access')) {
        scopes.push('pages_show_list', 'read_insights');
      }
      if (permissions?.includes('content_creation') || permissions?.includes('post_access')) {
        scopes.push('pages_manage_posts', 'instagram_basic', 'instagram_content_publish');
      }

      const state = btoa(JSON.stringify({
        user_id: user.id,
        permissions: permissions || []
      }));

      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
        `client_id=${metaAppId}&` +
        `redirect_uri=${encodeURIComponent(metaRedirectUri)}&` +
        `scope=${scopes.join(',')}&` +
        `response_type=code&` +
        `state=${state}`;

      console.log('Generated auth URL with scopes:', scopes);

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle OAuth callback
    if (action === 'handle_callback') {
      const { code, state } = await req.json();
      
      const metaAppId = Deno.env.get('META_APP_ID');
      const metaAppSecret = Deno.env.get('META_APP_SECRET');
      const metaRedirectUri = Deno.env.get('META_REDIRECT_URI');

      if (!metaAppId || !metaAppSecret || !metaRedirectUri) {
        throw new Error('Meta OAuth environment variables not configured');
      }

      // Decode state to get user info
      const stateData = JSON.parse(atob(state));
      const { user_id, permissions } = stateData;

      // Exchange code for access token
      const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: metaAppId,
          client_secret: metaAppSecret,
          redirect_uri: metaRedirectUri,
          code: code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get user's Pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${tokenData.access_token}`
      );
      
      if (!pagesResponse.ok) {
        throw new Error('Failed to fetch user pages');
      }

      const pagesData = await pagesResponse.json();
      
      // Get user's company_id
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user_id)
        .single();

      if (!userData?.company_id) {
        throw new Error('User not found or no company associated');
      }

      // Store integration data for each page
      for (const page of pagesData.data) {
        // Get Instagram Business Account if available
        let instagramData = null;
        try {
          const igResponse = await fetch(
            `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
          );
          if (igResponse.ok) {
            const igData = await igResponse.json();
            if (igData.instagram_business_account) {
              // Get Instagram username
              const igAccountResponse = await fetch(
                `https://graph.facebook.com/v19.0/${igData.instagram_business_account.id}?fields=username&access_token=${page.access_token}`
              );
              if (igAccountResponse.ok) {
                const igAccountData = await igAccountResponse.json();
                instagramData = {
                  id: igData.instagram_business_account.id,
                  username: igAccountData.username
                };
              }
            }
          }
        } catch (error) {
          console.log('Instagram account not found for page:', page.name);
        }

        // Store Facebook Page integration
        const { error: fbError } = await supabase
          .from('integrations')
          .upsert({
            user_id,
            company_id: userData.company_id,
            service_name: 'facebook',
            auth_token: page.access_token,
            connected: true,
            metadata: {
              page_id: page.id,
              page_name: page.name,
              instagram_business_account: instagramData
            },
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,service_name,company_id'
          });

        if (fbError) {
          console.error('Error storing Facebook integration:', fbError);
        }

        // Store Instagram integration if available
        if (instagramData) {
          const { error: igError } = await supabase
            .from('integrations')
            .upsert({
              user_id,
              company_id: userData.company_id,
              service_name: 'instagram',
              auth_token: page.access_token,
              connected: true,
              metadata: {
                page_id: page.id,
                page_name: page.name,
                instagram_id: instagramData.id,
                instagram_username: instagramData.username
              },
              last_synced_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,service_name,company_id'
            });

          if (igError) {
            console.error('Error storing Instagram integration:', igError);
          }
        }

        // Store marketing permissions
        if (permissions && permissions.length > 0) {
          const { error: permError } = await supabase
            .from('marketing_permissions')
            .upsert({
              company_id: userData.company_id,
              platform: page.name,
              content_creation: permissions.includes('content_creation'),
              post_access: permissions.includes('post_access'),
              analytics_access: permissions.includes('analytics_access'),
              messaging_access: permissions.includes('messaging_access'),
              automated_posting: permissions.includes('automated_posting')
            }, {
              onConflict: 'company_id,platform'
            });

          if (permError) {
            console.error('Error storing marketing permissions:', permError);
          }
        }
      }

      console.log('Successfully stored integrations for', pagesData.data.length, 'pages');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Integration connected successfully',
          pages_connected: pagesData.data.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Meta OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})