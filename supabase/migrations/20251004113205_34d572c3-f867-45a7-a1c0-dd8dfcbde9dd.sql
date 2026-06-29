-- Update the update_user_role function to properly handle role hierarchy
-- Owner can change any role, Admins manage staff+managers, Managers manage staff only

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
  v_is_owner boolean;
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

    -- Owners can change ANY user to ANY role (staff, manager, admin)
    UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
    RETURN json_build_object('success', true, 'message', 'Role updated successfully (owner)');
  END IF;

  -- Authenticated path: check requester permissions
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT role, company_id, is_company_admin, is_owner
  INTO v_requester_role, v_requester_company_id, v_is_company_admin, v_is_owner
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_requester_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Requester not linked to a company');
  END IF;

  IF v_requester_company_id <> v_target_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot manage users from another company');
  END IF;

  -- Owner can change any role (authenticated owner path)
  IF v_is_owner THEN
    UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
    RETURN json_build_object('success', true, 'message', 'Role updated successfully (authenticated owner)');
  END IF;

  -- Admin path: can manage staff and manager roles
  IF v_requester_role = 'admin' OR v_is_company_admin THEN
    -- Admins cannot change other admins
    IF v_target_current_role = 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'Cannot change admin roles');
    END IF;

    -- Admins cannot promote to admin
    IF p_new_role = 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'Admins cannot promote users to admin role');
    END IF;

    -- Admins can promote staff to manager
    IF p_new_role = 'manager' AND v_target_current_role = 'staff' THEN
      UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
      RETURN json_build_object('success', true, 'message', 'Role updated successfully');
    END IF;

    -- Admins can demote manager to staff
    IF p_new_role = 'staff' AND v_target_current_role = 'manager' THEN
      UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
      RETURN json_build_object('success', true, 'message', 'Role updated successfully');
    END IF;

    -- Admins can change staff role (staff to staff is valid for updates)
    IF p_new_role = 'staff' AND v_target_current_role = 'staff' THEN
      UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
      RETURN json_build_object('success', true, 'message', 'Role updated successfully');
    END IF;

    RETURN json_build_object('success', false, 'error', 'Invalid role change for admin');
  END IF;

  -- Manager path: can only change staff roles
  IF v_requester_role = 'manager' THEN
    -- Managers cannot change non-staff roles
    IF v_target_current_role != 'staff' THEN
      RETURN json_build_object('success', false, 'error', 'Managers can only manage staff roles');
    END IF;

    -- Managers can only set role to staff
    IF p_new_role = 'staff' THEN
      UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;
      RETURN json_build_object('success', true, 'message', 'Role updated successfully (manager)');
    END IF;

    RETURN json_build_object('success', false, 'error', 'Managers can only set staff role');
  END IF;

  -- If we get here, requester doesn't have permission
  RETURN json_build_object('success', false, 'error', 'Insufficient permissions to change roles');
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;