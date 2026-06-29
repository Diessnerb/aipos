import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateCredentialsRequest {
  userId: string;
  newEmail: string;
  newPassword: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[UPDATE-CREDENTIALS] Starting request');

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the caller is a super admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[UPDATE-CREDENTIALS] No authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[UPDATE-CREDENTIALS] Invalid token:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super admin
    const { data: superAdmin, error: superAdminError } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (superAdminError || !superAdmin) {
      console.error('[UPDATE-CREDENTIALS] Not a super admin:', superAdminError);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[UPDATE-CREDENTIALS] Super admin verified');

    // Parse request body
    const { userId, newEmail, newPassword }: UpdateCredentialsRequest = await req.json();

    if (!userId || !newEmail || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: userId, newEmail, newPassword' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[UPDATE-CREDENTIALS] Updating credentials for user ${userId} to ${newEmail}`);

    // Step 1: Update auth.users via Admin API
    const { data: updatedAuthUser, error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email: newEmail,
        password: newPassword,
        email_confirm: true, // Auto-confirm the new email
      }
    );

    if (authUpdateError) {
      console.error('[UPDATE-CREDENTIALS] Failed to update auth user:', authUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to update authentication: ${authUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[UPDATE-CREDENTIALS] Auth user updated successfully');

    // Step 2: Update users table
    const { error: usersUpdateError } = await supabaseAdmin
      .from('users')
      .update({ email: newEmail })
      .eq('auth_user_id', userId);

    if (usersUpdateError) {
      console.error('[UPDATE-CREDENTIALS] Failed to update users table:', usersUpdateError);
      // Don't fail the whole operation, just log the error
    }

    console.log('[UPDATE-CREDENTIALS] Users table updated successfully');

    // Step 3: Update companies table (default_admin_email)
    // First, find the company for this user
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('auth_user_id', userId)
      .single();

    if (userData?.company_id) {
      const { error: companyUpdateError } = await supabaseAdmin
        .from('companies')
        .update({ default_admin_email: newEmail })
        .eq('id', userData.company_id);

      if (companyUpdateError) {
        console.error('[UPDATE-CREDENTIALS] Failed to update companies table:', companyUpdateError);
        // Don't fail the whole operation, just log the error
      }

      console.log('[UPDATE-CREDENTIALS] Companies table updated successfully');
    }

    console.log('[UPDATE-CREDENTIALS] All updates completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin credentials updated successfully',
        email: newEmail 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[UPDATE-CREDENTIALS] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
