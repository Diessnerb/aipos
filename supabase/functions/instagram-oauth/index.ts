
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Instagram OAuth function called with method:', req.method);
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { action, user_id, code } = await req.json();
      console.log('Request body:', { action, user_id, code: code ? 'present' : 'not present' });

      if (action === 'check_env_vars') {
        // Check if all required environment variables are configured
        const clientId = Deno.env.get('INSTAGRAM_CLIENT_ID');
        const clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET');
        const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI');

        const envVarsConfigured = !!(clientId && clientSecret && redirectUri);
        
        return new Response(
          JSON.stringify({ 
            env_vars_configured: envVarsConfigured,
            client_id_valid: clientId ? /^\d+$/.test(clientId) : false
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (action === 'get_auth_url') {
        // Generate Facebook OAuth URL for Instagram Business
        const clientId = Deno.env.get('INSTAGRAM_CLIENT_ID');
        const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI') || 'https://blsrpowvuxcvhqkeykyi.functions.supabase.co/oauth-callback';

        console.log('Environment check:');
        console.log('OAuth Configuration:', {
          clientId: clientId ? `${clientId.substring(0, 5)}...` : 'NOT SET',
          redirectUri,
          scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
        });
        console.log('INSTAGRAM_CLIENT_ID (Meta App ID) exists:', !!clientId);
        console.log('INSTAGRAM_CLIENT_ID length:', clientId?.length || 0);
        
        if (!clientId) {
          console.error('INSTAGRAM_CLIENT_ID not configured in Supabase secrets');
          return new Response(
            JSON.stringify({ 
              error: 'Meta App ID not configured in Supabase secrets',
              debug: 'Please add INSTAGRAM_CLIENT_ID (Meta App ID) to your Supabase project secrets'
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Validate client ID format (Meta App IDs are typically numeric)
        if (!/^\d+$/.test(clientId)) {
          console.error('Invalid Meta App ID format:', clientId);
          return new Response(
            JSON.stringify({ 
              error: 'Invalid Meta App ID format',
              debug: 'Meta App IDs should be numeric only'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log('Using Meta App ID:', clientId);
        console.log('Using Redirect URI:', redirectUri);

        // Use Facebook OAuth with Instagram Business API scopes
        const facebookOAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
        facebookOAuthUrl.searchParams.set('client_id', clientId);
        facebookOAuthUrl.searchParams.set('redirect_uri', redirectUri);
        facebookOAuthUrl.searchParams.set('scope', 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement');
        facebookOAuthUrl.searchParams.set('response_type', 'code');
        facebookOAuthUrl.searchParams.set('state', user_id);

        console.log('Generated Facebook OAuth URL:', facebookOAuthUrl.toString());
        console.log('OAuth URL parameters:', {
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
          response_type: 'code',
          state: user_id
        });

        return new Response(
          JSON.stringify({ 
            auth_url: facebookOAuthUrl.toString(),
            debug_info: {
              client_id: clientId,
              redirect_uri: redirectUri
            }
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (action === 'handle_callback' && code) {
        // Handle the OAuth callback for Instagram Business API
        const clientId = Deno.env.get('INSTAGRAM_CLIENT_ID');
        const clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET');
        const redirectUri = Deno.env.get('INSTAGRAM_REDIRECT_URI') || 'https://blsrpowvuxcvhqkeykyi.functions.supabase.co/oauth-callback';

        console.log('Callback handler - Environment check:');
        console.log('INSTAGRAM_CLIENT_ID (Meta App ID) exists:', !!clientId);
        console.log('INSTAGRAM_CLIENT_SECRET (Meta App Secret) exists:', !!clientSecret);

        if (!clientId || !clientSecret) {
          console.error('Meta credentials not configured');
          return new Response(
            JSON.stringify({ 
              error: 'Meta credentials not configured',
              debug: 'Both INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET must be set in Supabase secrets'
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        try {
          console.log('Attempting token exchange with Facebook Graph API:', {
            client_id: clientId,
            redirect_uri: redirectUri,
            code: code.substring(0, 10) + '...' // Log partial code for debugging
          });

          // Exchange code for access token using Facebook Graph API
          const tokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
          tokenUrl.searchParams.set('client_id', clientId);
          tokenUrl.searchParams.set('client_secret', clientSecret);
          tokenUrl.searchParams.set('redirect_uri', redirectUri);
          tokenUrl.searchParams.set('code', code);

          const tokenFetch = await fetch(tokenUrl.toString());
          const tokenData = await tokenFetch.json();
          
          console.log('Token response status:', tokenFetch.status);
          console.log('Token response:', tokenData);

          if (!tokenFetch.ok || tokenData.error) {
            console.error('Token exchange failed:', tokenData);
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'Token exchange failed', 
                details: tokenData,
                debug: {
                  status: tokenFetch.status,
                  client_id: clientId,
                  redirect_uri: redirectUri
                }
              }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          const accessToken = tokenData.access_token;
          console.log('Successfully obtained access token');

          // Fetch user's Facebook Pages
          console.log('Fetching Facebook Pages...');
          const pagesUrl = new URL('https://graph.facebook.com/v18.0/me/accounts');
          pagesUrl.searchParams.set('access_token', accessToken);
          
          const pagesResponse = await fetch(pagesUrl.toString());
          const pagesData = await pagesResponse.json();

          console.log('Pages response:', pagesData);

          if (!pagesResponse.ok || pagesData.error) {
            console.error('Failed to fetch Facebook Pages:', pagesData);
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'Failed to fetch Facebook Pages',
                details: pagesData,
                message: 'You need a Facebook Page to connect Instagram Business'
              }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          if (!pagesData.data || pagesData.data.length === 0) {
            console.error('No Facebook Pages found');
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'No Facebook Pages found',
                message: 'You need to create a Facebook Page to connect Instagram Business'
              }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          // Find Instagram Business Account for each page
          let instagramAccount = null;
          let pageAccessToken = null;
          let pageName = null;
          let facebookPageId = null;

          for (const page of pagesData.data) {
            console.log(`Checking page: ${page.name} (${page.id})`);
            
            const pageDetailsUrl = new URL(`https://graph.facebook.com/v18.0/${page.id}`);
            pageDetailsUrl.searchParams.set('fields', 'instagram_business_account,name,access_token');
            pageDetailsUrl.searchParams.set('access_token', accessToken);
            
            const pageDetailsResponse = await fetch(pageDetailsUrl.toString());
            const pageDetails = await pageDetailsResponse.json();

            console.log(`Page details for ${page.name}:`, pageDetails);

            if (pageDetails.instagram_business_account) {
              instagramAccount = pageDetails.instagram_business_account.id;
              pageAccessToken = pageDetails.access_token;
              pageName = pageDetails.name;
              facebookPageId = page.id;
              console.log(`Found Instagram Business Account: ${instagramAccount}`);
              break;
            }
          }

          if (!instagramAccount) {
            console.error('No Instagram Business Account found on any Facebook Page');
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'No Instagram Business Account found',
                message: 'Connect an Instagram Business account to your Facebook Page first',
                details: {
                  pages_checked: pagesData.data.length,
                  page_names: pagesData.data.map((p: any) => p.name)
                }
              }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          // Fetch Instagram account details
          console.log('Fetching Instagram account details...');
          const igDetailsUrl = new URL(`https://graph.facebook.com/v18.0/${instagramAccount}`);
          igDetailsUrl.searchParams.set('fields', 'username,profile_picture_url');
          igDetailsUrl.searchParams.set('access_token', pageAccessToken);
          
          const igDetailsResponse = await fetch(igDetailsUrl.toString());
          const igDetails = await igDetailsResponse.json();

          console.log('Instagram account details:', igDetails);

          // Get company_id for the user
          const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('company_id')
            .eq('id', user_id)
            .single();

          if (userError) {
            console.error('Error fetching user company:', userError);
          }

          const companyId = userData?.company_id || user_id;

          console.log('Storing integration in database...', {
            user_id,
            company_id: companyId,
            service: 'instagram'
          });

          // Store the integration in database with metadata
          const { error: dbError } = await supabaseClient
            .from('integrations')
            .upsert({
              user_id: user_id,
              company_id: companyId,
              service_name: 'instagram',
              connected: true,
              auth_token: pageAccessToken, // Use page access token for API calls
              refresh_token: null,
              expires_at: null, // Facebook page tokens don't expire if page is active
              last_synced_at: new Date().toISOString(),
              metadata: {
                instagram_business_account_id: instagramAccount,
                facebook_page_id: facebookPageId,
                facebook_page_name: pageName,
                instagram_username: igDetails.username || null,
                profile_picture_url: igDetails.profile_picture_url || null
              }
            }, {
              onConflict: 'user_id,service_name'
            });

          if (dbError) {
            console.error('Database error:', dbError);
            console.error('Error code:', dbError.code);
            console.error('Error details:', dbError.details);
            console.error('Error message:', dbError.message);
            
            // Provide specific error message based on error code
            let errorMessage = 'Failed to store integration';
            if (dbError.code === '42P10') {
              errorMessage = 'Database constraint error - please contact support';
            } else if (dbError.code === '23505') {
              errorMessage = 'Integration already exists';
            }
            
            return new Response(
              JSON.stringify({ 
                success: false,
                error: errorMessage, 
                details: dbError,
                debug: {
                  user_id,
                  company_id: companyId,
                  service: 'instagram',
                  timestamp: new Date().toISOString()
                }
              }),
              { 
                status: 500, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Instagram Business Account connected successfully',
              data: {
                instagram_username: igDetails.username,
                facebook_page_name: pageName
              }
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );

        } catch (error) {
          console.error('Error in token exchange:', error);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Token exchange failed', 
              details: error instanceof Error ? error.message : 'Unknown error'
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
