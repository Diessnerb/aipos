-- =====================================================
-- PHASE 1: FIX COMPANY DELETION FUNCTION
-- =====================================================
-- This migration updates delete_company_super_admin to include ALL related tables
-- Fixes: "No company association found for user" error

CREATE OR REPLACE FUNCTION public.delete_company_super_admin(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted_tables text[] := ARRAY[]::text[];
  v_error_details text;
BEGIN
  -- Only super admins can delete companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - not a super admin');
  END IF;
  
  -- Check if company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RETURN json_build_object('success', false, 'error', 'Company not found');
  END IF;

  RAISE LOG 'Starting deletion of company: %', p_company_id;

  BEGIN
    -- ============ NEW DELETIONS (Missing Tables) ============
    
    -- 1. Delete user_roles (CRITICAL - this was causing the error)
    DELETE FROM public.user_roles WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'user_roles');
    
    -- 2. Delete company_subscription_features
    DELETE FROM public.company_subscription_features WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'company_subscription_features');
    
    -- 3. Delete Alisha-related tables
    DELETE FROM public.alisha_user_preferences WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'alisha_user_preferences');
    
    DELETE FROM public.alisha_conversations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'alisha_conversations');
    
    DELETE FROM public.alisha_memory WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'alisha_memory');
    
    DELETE FROM public.alisha_company_settings WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'alisha_company_settings');
    
    -- 4. Delete optimization-related tables
    DELETE FROM public.manual_override_feedback WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'manual_override_feedback');
    
    DELETE FROM public.assignment_history WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'assignment_history');
    
    DELETE FROM public.assignment_rules WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'assignment_rules');
    
    DELETE FROM public.group_seat_mappings WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'group_seat_mappings');
    
    -- 5. Delete analytics tables
    DELETE FROM public.company_growth_metrics WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'company_growth_metrics');
    
    DELETE FROM public.marketing_analytics WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'marketing_analytics');
    
    -- 6. Delete deal-related tables
    DELETE FROM public.deals WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'deals');
    
    DELETE FROM public.deal_types WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'deal_types');
    
    -- 7. Delete link templates
    DELETE FROM public.link_templates WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'link_templates');
    
    -- ============ EXISTING DELETIONS (Keep these) ============
    
    -- Delete order items
    DELETE FROM public.order_items WHERE order_id IN (
      SELECT o.id FROM public.orders o 
      JOIN public.users u ON o.created_by = u.id 
      WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'order_items');
    
    -- Delete payments
    DELETE FROM public.payments WHERE order_id IN (
      SELECT o.id FROM public.orders o 
      JOIN public.users u ON o.created_by = u.id 
      WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'payments');
    
    -- Delete orders
    DELETE FROM public.orders WHERE created_by IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'orders');
    
    -- Delete inventory logs
    DELETE FROM public.inventory_logs WHERE inventory_item_id IN (
      SELECT i.id FROM public.inventory i WHERE i.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'inventory_logs');
    
    -- Delete menu item ingredients
    DELETE FROM public.menu_item_ingredients WHERE menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi WHERE mi.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'menu_item_ingredients');
    
    -- Delete inventory
    DELETE FROM public.inventory WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'inventory');
    
    -- Delete reservations
    DELETE FROM public.reservations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'reservations');
    
    -- Delete tables (CRITICAL - this was missing!)
    DELETE FROM public.tables WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'tables');
    
    -- Delete menu items
    DELETE FROM public.menu_items WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'menu_items');
    
    -- Delete menu categories
    DELETE FROM public.menu_categories WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'menu_categories');
    
    -- Delete customers
    DELETE FROM public.customers WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'customers');
    
    -- Delete locations
    DELETE FROM public.locations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'locations');
    
    -- Delete invoices
    DELETE FROM public.invoices WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'invoices');
    
    -- Delete marketing data
    DELETE FROM public.customer_communications WHERE campaign_id IN (
      SELECT mc.id FROM public.marketing_campaigns mc WHERE mc.company_id = p_company_id
    );
    DELETE FROM public.marketing_campaigns WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'marketing_campaigns');
    
    DELETE FROM public.marketing_permissions WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'marketing_permissions');
    
    -- Delete integrations
    DELETE FROM public.integrations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'integrations');
    
    -- Delete AI and copilot logs
    DELETE FROM public.ai_campaign_logs WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'ai_campaign_logs');
    
    DELETE FROM public.copilot_logs WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'copilot_logs');
    
    -- Delete messaging data
    DELETE FROM public.channel_memberships WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    
    DELETE FROM public.messages WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    
    DELETE FROM public.channels WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'channels');
    
    DELETE FROM public.messenger_notes WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'messenger_notes');
    
    -- Delete HR/holiday data
    DELETE FROM public.holiday_deduction_log WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    
    DELETE FROM public.holiday_requests WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'holiday_requests');
    
    -- Delete shift data
    DELETE FROM public.shift_approval_requests WHERE requester_user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    ) OR reviewed_by_user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    
    DELETE FROM public.shift_swap_requests WHERE requested_by_user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    ) OR original_user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    ) OR accepted_by_user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    ) OR approved_by_user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    
    DELETE FROM public.shift_logs WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'shift_data');
    
    -- Delete off reasons
    DELETE FROM public.off_reasons WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'off_reasons');
    
    -- Delete rota data
    DELETE FROM public.rota_entries WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    DELETE FROM public.rotas WHERE user_id IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    ) OR created_by IN (
      SELECT u.id FROM public.users u WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'rotas');
    
    -- Delete permissions
    DELETE FROM public.company_permission_templates WHERE company_id = p_company_id;
    DELETE FROM public.page_permissions WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'permissions');
    
    -- Delete company settings
    DELETE FROM public.company_settings WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'company_settings');
    
    -- Delete users (this will cascade to user_roles if not already deleted)
    DELETE FROM public.users WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'users');
    
    -- Finally delete the company itself
    DELETE FROM public.companies WHERE id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'companies');
    
    RAISE LOG 'Successfully deleted company % from tables: %', p_company_id, array_to_string(v_deleted_tables, ', ');
    
    RETURN json_build_object(
      'success', true, 
      'message', 'Company and all related data deleted successfully',
      'deleted_from_tables', v_deleted_tables
    );
    
  EXCEPTION WHEN OTHERS THEN
    v_error_details := SQLERRM;
    RAISE LOG 'Error deleting company %: %. Deleted from tables: %', p_company_id, v_error_details, array_to_string(v_deleted_tables, ', ');
    
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to delete company: ' || v_error_details,
      'partially_deleted_from', v_deleted_tables
    );
  END;
END;
$function$;