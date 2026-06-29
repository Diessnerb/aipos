import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Edge Function called - Method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔑 Checking environment variables...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔑 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceRoleKey,
      urlStart: supabaseUrl?.substring(0, 20) + '...',
      keyStart: serviceRoleKey?.substring(0, 20) + '...'
    });
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    // Get authorization header for user authentication
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Auth header check:', {
      hasAuthHeader: !!authHeader,
      authStart: authHeader?.substring(0, 20) + '...'
    });

    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No authorization header provided'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Initialize regular Supabase client with user auth for permission checks
    const supabaseUser = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // Verify user is a super admin using the user client
    console.log('🔍 Checking super admin status...');
    const { data: isSuperAdmin, error: superAdminError } = await supabaseUser.rpc('is_current_user_super_admin');
    
    console.log('🔍 Super admin check result:', {
      isSuperAdmin,
      error: superAdminError?.message
    });

    if (superAdminError) {
      console.error('❌ Error checking super admin status:', superAdminError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to verify super admin status: ${superAdminError.message}`
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!isSuperAdmin) {
      console.error('❌ User is not a super admin');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Super admin access required'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('📥 Reading request body...');
    const requestBody = await req.json();
    console.log('📥 Request body:', requestBody);
    
    const { companyData } = requestBody;
    
    if (!companyData) {
      console.error('❌ No company data provided');
      throw new Error('Company data is required');
    }

    console.log('✅ Company data received:', {
      name: companyData.name,
      subdomain: companyData.subdomain,
      adminEmail: companyData.adminEmail,
      adminFullName: companyData.adminFullName,
      hasOwnerPin: !!companyData.ownerPin,
      hasPassword: !!companyData.adminPassword
    });

    // Step 1: Create auth user using service role with temporary password flag
    console.log('👤 Creating auth user...');
    const authUserRequest = {
      email: companyData.adminEmail,
      password: companyData.adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: companyData.adminFullName,
        role: 'owner',
        password_reset_required: true // Owner must change temporary password on first login
      }
    };
    console.log('👤 Auth user request (without password):', {
      ...authUserRequest,
      password: '[REDACTED]'
    });
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser(authUserRequest);

    if (authError || !authUser.user) {
      console.error('❌ Error creating auth user:', authError);
      console.error('❌ Auth error details:', {
        message: authError?.message,
        status: authError?.status,
        code: authError?.code
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create admin user: ${authError?.message || 'Unknown error'}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Auth user created successfully:', {
      id: authUser.user.id,
      email: authUser.user.email
    });

    // Step 2: Create company manually since RPC function doesn't exist
    console.log('🏢 Creating company and admin user...');
    
    // Insert the company (without storing plaintext owner_pin)
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyData.name,
        subdomain: companyData.subdomain,
        default_admin_email: companyData.adminEmail,
        status: 'active'
        // Note: owner_pin removed for privacy - stored hashed in users.pin_code
      })
      .select()
      .single();

    if (companyError) {
      console.error('❌ Error creating company:', companyError);
      // Clean up auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        console.log('🧹 Cleaned up auth user after company creation failure');
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup auth user:', cleanupError);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create company: ${companyError.message}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Company created:', company);

    // Step 3: Create company_settings record with proper capitalization
    console.log('🎨 Creating company settings...');
    const { error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .insert({
        company_id: company.id,
        company_name: companyData.name.charAt(0).toUpperCase() + companyData.name.slice(1).toLowerCase(),
        logo_url: null,
        auto_assign_tables: true,
        optimization_enabled: true,
        optimization_mode: 'continuous',
        show_allergen_disclaimer: false
      });

    if (settingsError) {
      console.error('❌ Error creating company settings:', settingsError);
      // Don't fail the entire operation for settings creation failure, just log it
      console.log('⚠️ Company created but settings creation failed - settings can be created later');
    } else {
      console.log('✅ Company settings created successfully');
    }

    // Step 4: Create default menu categories for the new company
    console.log('📋 Creating default menu categories...');
    const defaultCategories = [
      { name: 'Breakfast', description: 'Morning dishes and breakfast items', display_order: 1 },
      { name: 'Lunch', description: 'Midday meals and lunch specials', display_order: 2 },
      { name: 'Dinner', description: 'Evening meals and dinner entrees', display_order: 3 },
      { name: 'Beverages', description: 'Hot and cold drinks', display_order: 4 },
      { name: 'Desserts', description: 'Sweet treats and desserts', display_order: 5 },
      { name: 'Appetizers', description: 'Starters and small plates', display_order: 6 }
    ];

    const { error: categoriesError } = await supabaseAdmin
      .from('menu_categories')
      .insert(
        defaultCategories.map(category => ({
          ...category,
          company_id: company.id,
          is_active: true
        }))
      );

    if (categoriesError) {
      console.error('❌ Default categories creation failed:', categoriesError);
      // Continue anyway, don't fail the whole process for categories
      console.log('⚠️ Company created but default categories creation failed - categories can be created later');
    } else {
      console.log('✅ Default menu categories created successfully');
    }

    // Step 5: Create default tables for the new company (10 tables with varied seating)
    console.log('🪑 Creating default tables...');
    const defaultTables = [
      { table_number: 1, seats: 2, accessibility_friendly: false },
      { table_number: 2, seats: 2, accessibility_friendly: true },
      { table_number: 3, seats: 4, accessibility_friendly: false },
      { table_number: 4, seats: 4, accessibility_friendly: false },
      { table_number: 5, seats: 4, accessibility_friendly: true },
      { table_number: 6, seats: 6, accessibility_friendly: false },
      { table_number: 7, seats: 6, accessibility_friendly: false },
      { table_number: 8, seats: 8, accessibility_friendly: true },
      { table_number: 9, seats: 8, accessibility_friendly: false },
      { table_number: 10, seats: 2, accessibility_friendly: false }
    ];

    const { error: tablesError } = await supabaseAdmin
      .from('tables')
      .insert(
        defaultTables.map(table => ({
          ...table,
          company_id: company.id,
          is_active: true
        }))
      );

    if (tablesError) {
      console.error('❌ Default tables creation failed:', tablesError);
      // Continue anyway, don't fail the whole process for tables
      console.log('⚠️ Company created but default tables creation failed - tables can be created later');
    } else {
      console.log('✅ Default tables created successfully');
    }

    // Check if public.users record already exists for this auth_user_id (race condition prevention)
    console.log('🔍 Checking for existing public.users record...');
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, company_id')
      .eq('auth_user_id', authUser.user.id)
      .maybeSingle();

    if (existingUserError) {
      console.error('❌ Error checking for existing user:', existingUserError);
    } else if (existingUser) {
      console.log('⚠️ Existing public.users record found:', existingUser);
      
      // Update existing record instead of inserting
      console.log('🔄 Updating existing public.users record...');
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email: companyData.adminEmail,
          full_name: companyData.adminFullName,
          role: 'admin',
          company_id: company.id,
          is_company_admin: true,
          is_active: true
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating existing admin user:', updateError);
        // Clean up company and auth user
        try {
          await supabaseAdmin.from('companies').delete().eq('id', company.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          console.log('🧹 Cleaned up company and auth user after admin user update failure');
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup after admin user update failure:', cleanupError);
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to update admin user: ${updateError.message}`
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('✅ Admin user updated:', updatedUser);
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Company created and existing admin user updated successfully',
          company_id: company.id,
          admin_user_id: updatedUser.id,
          operation_type: 'update'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // No existing user found, proceed with insert
    console.log('✅ No existing user found, creating new owner user...');
    
    // Hash owner PIN using SHA-256 (Web Crypto API - same as authenticate_by_pin_for_company_secure expects)
    const encoder = new TextEncoder();
    const data = encoder.encode(companyData.ownerPin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPin = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const { data: adminUser, error: adminUserError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_user_id: authUser.user.id,
        email: companyData.adminEmail,
        full_name: companyData.adminFullName,
        role: 'owner', // Changed from 'admin' to 'owner'
        company_id: company.id,
        is_company_admin: true,
        is_active: true,
        pin_code: hashedPin // Store hashed PIN for owner login
      })
      .select()
      .single();

    if (adminUserError) {
      console.error('❌ Error creating admin user:', adminUserError);
      
      // Handle duplicate key constraint specifically
      if (adminUserError.code === '23505' && adminUserError.message.includes('auth_user_id')) {
        console.log('🔄 Race condition detected, attempting to update existing record...');
        
        // Try to find and update the record that was created by the trigger
        const { data: raceUser, error: raceUserError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_user_id', authUser.user.id)
          .single();

        if (!raceUserError && raceUser) {
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              email: companyData.adminEmail,
              full_name: companyData.adminFullName,
              role: 'admin',
              company_id: company.id,
              is_company_admin: true,
              is_active: true
            })
            .eq('id', raceUser.id)
            .select()
            .single();

          if (!updateError) {
            console.log('✅ Successfully recovered from race condition by updating user:', updatedUser);
            
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Company created and admin user updated successfully (race condition recovery)',
                company_id: company.id,
                admin_user_id: updatedUser.id,
                operation_type: 'race_recovery'
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      }
      
      // Clean up company and auth user
      try {
        await supabaseAdmin.from('companies').delete().eq('id', company.id);
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        console.log('🧹 Cleaned up company and auth user after admin user creation failure');
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup after admin user creation failure:', cleanupError);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create admin user: ${adminUserError.message}`,
          error_code: adminUserError.code,
          debug_info: {
            auth_user_id: authUser.user.id,
            company_id: company.id
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Owner user created:', adminUser);

    // Step 6: Insert owner role into user_roles table for role hierarchy
    console.log('👑 Creating owner role in user_roles table...');
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: adminUser.id,
        company_id: company.id,
        role: 'owner'
      });

    if (roleError) {
      console.error('❌ Error creating owner role:', roleError);
      // Don't fail entire operation, but log it
      console.log('⚠️ Owner user created but role hierarchy entry failed - may need manual correction');
    } else {
      console.log('✅ Owner role created in user_roles table');
    }

    console.log('✅ Company and owner user created successfully with role hierarchy');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Company and owner user created successfully',
        company_id: company.id,
        admin_user_id: adminUser.id,
        note: 'Owner must change temporary password on first login'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in create-company-admin function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to create company: ${errorMessage}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});