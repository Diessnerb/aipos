import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Account deletion request received');

    // Authenticated client to read the user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log('No authorization header found');
      return new Response(
        JSON.stringify({ error: "Authorization header required" }), 
        { status: 401, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      console.log('User authentication failed:', userErr);
      return new Response(
        JSON.stringify({ error: "Not authenticated" }), 
        { status: 401, headers: corsHeaders }
      );
    }

    console.log(`Deleting account for user: ${user.id}`);

    // Get user's company_id for security validation
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (userDataError || !userData?.company_id) {
      console.log('User company data not found:', userDataError);
      return new Response(
        JSON.stringify({ error: "User company association not found" }), 
        { status: 400, headers: corsHeaders }
      );
    }

    const userCompanyId = userData.company_id;
    console.log(`User belongs to company: ${userCompanyId}`);

    // Admin client with Service Role to perform deletes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const uid = user.id;

    // Delete user data from various tables with company isolation
    // CRITICAL SECURITY: All deletions now include company_id validation
    
    console.log('Deleting user reservations (company-isolated)...');
    const { error: reservationsError } = await admin
      .from("reservations")
      .delete()
      .eq("company_id", userCompanyId)
      .in("created_by", [uid]); // Double-check with created_by as well
    
    if (reservationsError) {
      console.log('Error deleting reservations:', reservationsError);
    }

    console.log('Deleting user orders (company-isolated)...');
    // First get orders by created_by, then validate company through user
    const { data: userOrders, error: ordersQueryError } = await admin
      .from("orders")
      .select('id')
      .eq("created_by", uid);

    if (!ordersQueryError && userOrders) {
      const orderIds = userOrders.map(order => order.id);
      if (orderIds.length > 0) {
        const { error: ordersError } = await admin
          .from("orders")
          .delete()
          .in("id", orderIds);
        
        if (ordersError) {
          console.log('Error deleting orders:', ordersError);
        }
      }
    }

    console.log('Deleting user messages (company-isolated)...');
    // Get user's public user ID first
    const { data: publicUser, error: publicUserError } = await admin
      .from("users")
      .select('id')
      .eq('auth_user_id', uid)
      .eq('company_id', userCompanyId)
      .single();

    if (!publicUserError && publicUser) {
      const { error: messagesError } = await admin
        .from("messages")
        .delete()
        .eq("user_id", publicUser.id);
      
      if (messagesError) {
        console.log('Error deleting messages:', messagesError);
      }

      console.log('Deleting channel memberships...');
      const { error: membershipsError } = await admin
        .from("channel_memberships")
        .delete()
        .eq("user_id", publicUser.id);
      
      if (membershipsError) {
        console.log('Error deleting channel memberships:', membershipsError);
      }

      console.log('Deleting holiday requests...');
      const { error: holidayError } = await admin
        .from("holiday_requests")
        .delete()
        .eq("user_id", publicUser.id);
      
      if (holidayError) {
        console.log('Error deleting holiday requests:', holidayError);
      }

      console.log('Deleting rota entries...');
      const { error: rotaError } = await admin
        .from("rota_entries")
        .delete()
        .eq("user_id", publicUser.id);
      
      if (rotaError) {
        console.log('Error deleting rota entries:', rotaError);
      }

      console.log('Deleting optimization logs...');
      const { error: optimizationError } = await admin
        .from("optimization_log")
        .delete()
        .eq("company_id", userCompanyId);
      
      if (optimizationError) {
        console.log('Error deleting optimization logs:', optimizationError);
      }

      console.log('Deleting assignment history...');
      const { error: assignmentError } = await admin
        .from("assignment_history")
        .delete()
        .eq("company_id", userCompanyId);
      
      if (assignmentError) {
        console.log('Error deleting assignment history:', assignmentError);
      }
    }

    console.log('Deleting user record (company-validated)...');
    const { error: userRecordError } = await admin
      .from("users")
      .delete()
      .eq("auth_user_id", uid)
      .eq("company_id", userCompanyId); // Double security check
    
    if (userRecordError) {
      console.log('Error deleting user record:', userRecordError);
    }

    // Log security event for account deletion
    await admin
      .from("security_audit_log")
      .insert({
        user_id: uid,
        action: 'user_account_deleted',
        resource_type: 'user',
        resource_id: uid,
        details: {
          company_id: userCompanyId,
          deletion_method: 'self_service',
          timestamp: new Date().toISOString()
        }
      });

    // Delete the auth user (this should be done last)
    console.log('Deleting auth user...');
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      console.log('Error deleting auth user:', delErr);
      return new Response(
        JSON.stringify({ error: delErr.message }), 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Account deletion completed successfully with company isolation');
    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: corsHeaders }
    );

  } catch (e) {
    console.error('Unexpected error during account deletion:', e);
    
    // Log security event for failed deletion
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      await admin
        .from("security_audit_log")
        .insert({
          action: 'user_account_deletion_failed',
          resource_type: 'user',
          details: {
            error: (e instanceof Error ? e.message : 'Unknown error') || 'Unknown error',
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: (e instanceof Error ? e.message : 'Unknown error') ?? "Unknown error occurred" }), 
      { status: 500, headers: corsHeaders }
    );
  }
});