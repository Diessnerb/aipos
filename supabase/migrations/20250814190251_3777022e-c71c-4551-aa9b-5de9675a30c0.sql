-- Drop and recreate the delete_company_super_admin function with comprehensive table deletion
DROP FUNCTION IF EXISTS public.delete_company_super_admin(uuid);

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

  -- Log the deletion attempt
  RAISE LOG 'Starting deletion of company: %', p_company_id;

  BEGIN
    -- Delete in proper order to handle foreign key constraints
    
    -- 1. Delete order items (depends on orders and menu items)
    DELETE FROM public.order_items WHERE order_id IN (
      SELECT id FROM public.orders o 
      JOIN public.users u ON o.created_by = u.id 
      WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'order_items');
    
    -- 2. Delete payments (depends on orders)
    DELETE FROM public.payments WHERE order_id IN (
      SELECT id FROM public.orders o 
      JOIN public.users u ON o.created_by = u.id 
      WHERE u.company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'payments');
    
    -- 3. Delete orders (depends on users/customers)
    DELETE FROM public.orders WHERE created_by IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'orders');
    
    -- 4. Delete inventory logs (depends on inventory)
    DELETE FROM public.inventory_logs WHERE inventory_item_id IN (
      SELECT id FROM public.inventory WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'inventory_logs');
    
    -- 5. Delete menu item ingredients (depends on menu items and inventory)
    DELETE FROM public.menu_item_ingredients WHERE menu_item_id IN (
      SELECT id FROM public.menu_items WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'menu_item_ingredients');
    
    -- 6. Delete inventory (depends on menu items)
    DELETE FROM public.inventory WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'inventory');
    
    -- 7. Delete reservations (may reference tables)
    DELETE FROM public.reservations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'reservations');
    
    -- 8. Delete tables (CRITICAL - this was missing!)
    DELETE FROM public.tables WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'tables');
    
    -- 9. Delete menu items
    DELETE FROM public.menu_items WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'menu_items');
    
    -- 10. Delete menu categories
    DELETE FROM public.menu_categories WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'menu_categories');
    
    -- 11. Delete customers
    DELETE FROM public.customers WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'customers');
    
    -- 12. Delete locations
    DELETE FROM public.locations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'locations');
    
    -- 13. Delete invoices
    DELETE FROM public.invoices WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'invoices');
    
    -- 14. Delete marketing campaigns and communications
    DELETE FROM public.customer_communications WHERE campaign_id IN (
      SELECT id FROM public.marketing_campaigns WHERE company_id = p_company_id
    );
    DELETE FROM public.marketing_campaigns WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'marketing_campaigns');
    
    -- 15. Delete integrations
    DELETE FROM public.integrations WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'integrations');
    
    -- 16. Delete AI campaign logs
    DELETE FROM public.ai_campaign_logs WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'ai_campaign_logs');
    
    -- 17. Delete copilot logs
    DELETE FROM public.copilot_logs WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'copilot_logs');
    
    -- 18. Delete channel memberships for company users
    DELETE FROM public.channel_memberships WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    
    -- 19. Delete messages from company users
    DELETE FROM public.messages WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    
    -- 20. Delete channels
    DELETE FROM public.channels WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'channels');
    
    -- 21. Delete messenger notes
    DELETE FROM public.messenger_notes WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'messenger_notes');
    
    -- 22. Delete holiday deduction logs for company users
    DELETE FROM public.holiday_deduction_log WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    
    -- 23. Delete holiday requests for company users
    DELETE FROM public.holiday_requests WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'holiday_requests');
    
    -- 24. Delete shift-related data
    DELETE FROM public.shift_approval_requests WHERE requester_user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    ) OR reviewed_by_user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    
    DELETE FROM public.shift_swap_requests WHERE requested_by_user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    ) OR original_user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    ) OR accepted_by_user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    ) OR approved_by_user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    
    DELETE FROM public.shift_logs WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'shift_data');
    
    -- 25. Delete off reasons
    DELETE FROM public.off_reasons WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'off_reasons');
    
    -- 26. Delete rota entries and rotas
    DELETE FROM public.rota_entries WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    DELETE FROM public.rotas WHERE user_id IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    ) OR created_by IN (
      SELECT id FROM public.users WHERE company_id = p_company_id
    );
    v_deleted_tables := array_append(v_deleted_tables, 'rotas');
    
    -- 27. Delete page permissions and templates
    DELETE FROM public.company_permission_templates WHERE company_id = p_company_id;
    DELETE FROM public.page_permissions WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'permissions');
    
    -- 28. Delete company settings
    DELETE FROM public.company_settings WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'company_settings');
    
    -- 29. Delete users (before deleting company)
    DELETE FROM public.users WHERE company_id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'users');
    
    -- 30. Finally delete the company itself
    DELETE FROM public.companies WHERE id = p_company_id;
    v_deleted_tables := array_append(v_deleted_tables, 'companies');
    
    -- Log successful deletion
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