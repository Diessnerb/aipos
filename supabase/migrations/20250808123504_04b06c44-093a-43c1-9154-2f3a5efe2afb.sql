CREATE OR REPLACE FUNCTION public.update_user_role(
  p_target_user_id uuid,
  p_new_role text,
  p_owner_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requester_role text;
  v_requester_company_id uuid;
  v_target_company_id uuid;
  v_target_current_role text;
  v_is_company_admin boolean;
  v_owner_company_id uuid;
BEGIN
  -- Validate role format
  IF p_new_role NOT IN ('staff', 'manager', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role. Must be staff, manager, or admin');
  END IF;

  -- Load target user
  SELECT company_id, role
  INTO v_target_company_id, v_target_current_role
  FROM public.users
  WHERE id = p_target_user_id AND is_active = true
  LIMIT 1;

  IF v_target_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Target user not found or inactive');
  END IF;

  -- Owner path: allow using owner PIN without auth session
  IF p_owner_pin IS NOT NULL THEN
    SELECT id INTO v_owner_company_id
    FROM public.companies
    WHERE owner_pin = p_owner_pin AND status = 'active'
    LIMIT 1;

    IF v_owner_company_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Invalid owner PIN');
    END IF;

    IF v_target_company_id <> v_owner_company_id THEN
      RETURN json_build_object('success', false, 'error', 'Owner can only manage users in their company');
    END IF;

    -- Owners can promote staff to admin
    IF p_new_role = 'admin' AND v_target_current_role = 'staff' THEN
      UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
      RETURN json_build_object('success', true, 'message', 'Role updated successfully (owner)');
    ELSIF p_new_role IN ('staff', 'manager') THEN
      UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
      RETURN json_build_object('success', true, 'message', 'Role updated successfully (owner)');
    ELSE
      RETURN json_build_object('success', false, 'error', 'Invalid role change');
    END IF;
  END IF;

  -- Authenticated path: requester must be admin/company admin in same company
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT role, company_id, is_company_admin
  INTO v_requester_role, v_requester_company_id, v_is_company_admin
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_requester_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Requester not linked to a company');
  END IF;

  IF v_requester_company_id <> v_target_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot manage users from another company');
  END IF;

  -- Only admins/company admins can change roles
  IF NOT (v_requester_role = 'admin' OR v_is_company_admin) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Admins can promote staff to manager
  IF v_requester_role = 'admin' AND p_new_role = 'manager' AND v_target_current_role = 'staff' THEN
    UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
    RETURN json_build_object('success', true, 'message', 'Role updated successfully');
  END IF;

  -- Admins can demote staff/managers
  IF v_requester_role = 'admin' AND p_new_role = 'staff' THEN
    UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
    RETURN json_build_object('success', true, 'message', 'Role updated successfully');
  END IF;

  -- Admins cannot promote managers to admin
  IF v_requester_role = 'admin' AND p_new_role = 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Admins cannot promote users to admin role');
  END IF;

  -- Admins cannot change other admins' roles
  IF v_target_current_role = 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot change admin roles');
  END IF;

  RETURN json_build_object('success', false, 'error', 'Invalid role change');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;