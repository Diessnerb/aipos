-- Create comprehensive super admin company deletion function
CREATE OR REPLACE FUNCTION public.delete_company_super_admin(p_company_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only super admins can delete companies
  IF NOT public.is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized - only super admins can delete companies');
  END IF;
  
  -- Check if company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RETURN json_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  -- Delete related data in correct order to avoid foreign key constraints
  -- Delete dependent records first, then parent records
  
  -- Delete order items (depends on orders and menu items)
  DELETE FROM public.order_items WHERE order_id IN (
    SELECT id FROM public.orders WHERE EXISTS (
      SELECT 1 FROM public.users WHERE company_id = p_company_id AND auth_user_id = public.orders.created_by
    )
  );
  
  -- Delete payments (depends on orders)
  DELETE FROM public.payments WHERE order_id IN (
    SELECT id FROM public.orders WHERE EXISTS (
      SELECT 1 FROM public.users WHERE company_id = p_company_id AND auth_user_id = public.orders.created_by
    )
  );
  
  -- Delete orders
  DELETE FROM public.orders WHERE EXISTS (
    SELECT 1 FROM public.users WHERE company_id = p_company_id AND auth_user_id = public.orders.created_by
  );
  
  -- Delete menu item ingredients (depends on menu items)
  DELETE FROM public.menu_item_ingredients WHERE menu_item_id IN (
    SELECT id FROM public.menu_items WHERE company_id = p_company_id
  );
  
  -- Delete inventory logs (depends on inventory)
  DELETE FROM public.inventory_logs WHERE inventory_item_id IN (
    SELECT id FROM public.inventory WHERE company_id = p_company_id
  );
  
  -- Delete supplier order items (depends on supplier orders)
  DELETE FROM public.supplier_order_items WHERE supplier_order_id IN (
    SELECT id FROM public.supplier_orders WHERE company_id = p_company_id
  );
  
  -- Delete supplier orders
  DELETE FROM public.supplier_orders WHERE company_id = p_company_id;
  
  -- Delete inventory
  DELETE FROM public.inventory WHERE company_id = p_company_id;
  
  -- Delete menu items (depends on menu categories)
  DELETE FROM public.menu_items WHERE company_id = p_company_id;
  
  -- Delete menu categories
  DELETE FROM public.menu_categories WHERE company_id = p_company_id;
  
  -- Delete reservations
  DELETE FROM public.reservations WHERE company_id = p_company_id;
  
  -- Delete customer communications (depends on customers)
  DELETE FROM public.customer_communications WHERE customer_id IN (
    SELECT id FROM public.customers WHERE company_id = p_company_id
  );
  
  -- Delete customers
  DELETE FROM public.customers WHERE company_id = p_company_id;
  
  -- Delete invoices
  DELETE FROM public.invoices WHERE company_id = p_company_id;
  
  -- Delete marketing campaigns
  DELETE FROM public.marketing_campaigns WHERE company_id = p_company_id;
  
  -- Delete channel memberships (depends on channels and users)
  DELETE FROM public.channel_memberships WHERE channel_id IN (
    SELECT id FROM public.channels WHERE company_id = p_company_id
  );
  
  -- Delete messages (depends on channels and users)
  DELETE FROM public.messages WHERE channel_id IN (
    SELECT id FROM public.channels WHERE company_id = p_company_id
  );
  
  -- Delete channels
  DELETE FROM public.channels WHERE company_id = p_company_id;
  
  -- Delete messenger notes
  DELETE FROM public.messenger_notes WHERE company_id = p_company_id;
  
  -- Delete AI campaign logs
  DELETE FROM public.ai_campaign_logs WHERE company_id = p_company_id;
  
  -- Delete copilot logs
  DELETE FROM public.copilot_logs WHERE company_id = p_company_id;
  
  -- Delete integration records
  DELETE FROM public.integrations WHERE company_id = p_company_id;
  
  -- Delete holiday requests (depends on users)
  DELETE FROM public.holiday_requests WHERE user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  -- Delete shift-related records (depends on users)
  DELETE FROM public.shift_approval_requests WHERE requester_user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  DELETE FROM public.shift_swap_requests WHERE original_user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  DELETE FROM public.shift_logs WHERE user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  -- Delete off reasons (depends on users)
  DELETE FROM public.off_reasons WHERE user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  -- Delete rota entries (depends on users and rotas)
  DELETE FROM public.rota_entries WHERE user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  -- Delete rotas (depends on users)
  DELETE FROM public.rotas WHERE user_id IN (
    SELECT id FROM public.users WHERE company_id = p_company_id
  );
  
  -- Delete users in the company
  DELETE FROM public.users WHERE company_id = p_company_id;
  
  -- Delete company settings
  DELETE FROM public.company_settings WHERE company_id = p_company_id;
  
  -- Delete page permissions
  DELETE FROM public.page_permissions WHERE company_id = p_company_id;
  
  -- Delete company permission templates
  DELETE FROM public.company_permission_templates WHERE company_id = p_company_id;
  
  -- Delete locations
  DELETE FROM public.locations WHERE company_id = p_company_id;
  
  -- Delete the company itself
  DELETE FROM public.companies WHERE id = p_company_id;
  
  RETURN json_build_object('success', true, 'message', 'Company and all related data deleted successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;