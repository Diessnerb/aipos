
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  try {
    console.log('OAuth callback function called');
    console.log('Request URL:', req.url);

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This is the user_id
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('OAuth parameters:', { 
      code: code ? 'present' : 'not present', 
      state, 
      error, 
      errorDescription 
    });

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get('APP_URL') || 'https://aipos.lovable.app';

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      
      // Format more specific error messages for common issues
      let redirectErrorMsg = error;
      let userFriendlyMsg = errorDescription || '';
      
      if (error === 'access_denied') {
        userFriendlyMsg = 'You need to grant permissions to connect Instagram Business';
      } else if (error === 'invalid_request' && errorDescription?.includes('platform')) {
        redirectErrorMsg = 'invalid_platform_app';
        userFriendlyMsg = 'Invalid app configuration. Please check your Meta App settings.';
      } else if (errorDescription?.includes('Permissions')) {
        userFriendlyMsg = 'Required permissions not granted. Please try again and accept all permissions.';
      }
      
      const redirectUrl = `${appUrl}/settings/integrations?oauth_error=${encodeURIComponent(redirectErrorMsg)}&error_description=${encodeURIComponent(userFriendlyMsg)}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl,
        },
      });
    }

    if (!code || !state) {
      console.error('Missing required parameters:', { code: !!code, state: !!state });
      const redirectUrl = `${appUrl}/settings/integrations?oauth_error=missing_parameters`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl,
        },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the Instagram OAuth handler
    try {
      console.log('Calling instagram-oauth function with code and state...');
      
      const { data, error: functionError } = await supabaseClient.functions.invoke('instagram-oauth', {
        body: {
          action: 'handle_callback',
          user_id: state,
          code: code
        }
      });

      console.log('Instagram OAuth function response:', { 
        success: data?.success,
        error: functionError,
        errorDetails: data?.error,
        debug: data?.debug,
        fullData: data
      });

      if (functionError) {
        console.error('Instagram OAuth function call failed:', functionError);
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Unknown error';
        const userMessage = data?.message || '';
        const errorDetails = data?.details ? JSON.stringify(data.details) : '';
        const debugInfo = data?.debug ? JSON.stringify(data.debug) : '';
        
        console.error('Instagram OAuth processing failed:', {
          errorMsg,
          userMessage,
          errorDetails,
          debugInfo
        });
        
        // Provide user-friendly error messages
        let friendlyError = errorMsg;
        let friendlyDescription = userMessage;
        
        if (errorMsg.includes('No Facebook Pages')) {
          friendlyError = 'no_facebook_page';
          friendlyDescription = 'No Facebook Pages found. Please create a Facebook Page first.';
        } else if (errorMsg.includes('No Instagram Business Account')) {
          friendlyError = 'no_instagram_business_account';
          friendlyDescription = 'No Instagram Business Account linked to your Facebook Page.';
        } else if (errorMsg.includes('Token exchange failed')) {
          friendlyError = 'token_exchange_failed';
          friendlyDescription = 'Failed to exchange authorization code for access token.';
        } else if (errorMsg.includes('Database constraint error')) {
          friendlyError = 'database_error';
          friendlyDescription = 'Database configuration error. Please contact support.';
        } else if (errorMsg.includes('Failed to store integration')) {
          friendlyError = 'storage_failed';
          friendlyDescription = 'Failed to save integration. Please try again or contact support.';
        }
        
        throw new Error(`${friendlyError}|||${friendlyDescription || userMessage || errorDetails}`);
      }

      // Redirect back to the integrations page with success
      const redirectUrl = `${appUrl}/settings/integrations?oauth_success=true&service=instagram`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl,
        },
      });

    } catch (processingError) {
      console.error('Error processing OAuth callback:', processingError);
      let errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      let errorType = 'processing_failed';
      
      // Parse custom error format (errorType|||userMessage)
      if (errorMessage.includes('|||')) {
        const [type, msg] = errorMessage.split('|||');
        errorType = type;
        errorMessage = msg;
      } else {
        // Try to provide more specific errors
        if (errorMessage.includes('Client ID')) {
          errorMessage = 'Meta App ID mismatch or invalid';
          errorType = 'invalid_client_id';
        } else if (errorMessage.includes('invalid_platform')) {
          errorMessage = 'Invalid platform app - check app type and redirect URI';
          errorType = 'invalid_platform';
        } else if (errorMessage.includes('permission')) {
          errorMessage = 'Permission denied - check app permissions and status';
          errorType = 'permission_denied';
        } else if (errorMessage.includes('no_facebook_page')) {
          errorType = 'no_facebook_page';
          errorMessage = 'You need a Facebook Page to connect Instagram Business';
        } else if (errorMessage.includes('no_instagram_business_account')) {
          errorType = 'no_instagram_business_account';
          errorMessage = 'Connect an Instagram Business account to your Facebook Page first';
        }
      }
      
      const redirectUrl = `${appUrl}/settings/integrations?oauth_error=${encodeURIComponent(errorType)}&error_description=${encodeURIComponent(errorMessage)}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl,
        },
      });
    }

  } catch (error) {
    console.error('OAuth callback function error:', error);
    const redirectUrl = `${appUrl}/settings/integrations?oauth_error=server_error&error_message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
      },
    });
  }
});
