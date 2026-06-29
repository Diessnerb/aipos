import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';
import { clearPinUserByUserId } from '@/utils/pinAuth';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  company_id: string | null;
  created_at: string;
  auth_user_id: string | null;
  pin_code: string | null;
  is_active: boolean;
  deleted_at: string | null;
  is_company_admin?: boolean;
  is_owner?: boolean;
}

interface PasswordUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Helper function to determine role priority for sorting
const getRolePriority = (role: string, isOwner?: boolean): number => {
  if (isOwner) return 0; // Owner at the top
  switch (role?.toLowerCase()) {
    case 'admin':
      return 1;
    case 'manager':
      return 2;
    case 'staff':
      return 3;
    default:
      return 4; // Unknown roles go to the bottom
  }
};

// Helper function to sort team members by role hierarchy and name
const sortTeamMembers = (members: TeamMember[]): TeamMember[] => {
  return [...members].sort((a, b) => {
    // Primary sort: by role priority
    const priorityDiff = getRolePriority(a.role, a.is_owner) - getRolePriority(b.role, b.is_owner);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Secondary sort: alphabetically by name
    return a.full_name.localeCompare(b.full_name);
  });
};

export const useTeamMembers = () => {
  const queryClient = useQueryClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const deviceLive = useDeviceLiveLayer();

  const fetchTeamMembers = async (opts?: { forceNetwork?: boolean }) => {
    try {
      console.log('Fetching team members...', opts?.forceNetwork ? '(force network)' : '');
      
      // Import bound device utilities
      const { getBoundCompany, isDeviceBound } = await import('@/utils/deviceBinding');
      const boundCompany = getBoundCompany();
      
      // For bound devices, use edge function instead of web auth
      if (boundCompany?.company_id && isDeviceBound()) {
        console.log('🔧 Bound device detected, using edge function for team members');
        
        if (deviceLive.isActive && !opts?.forceNetwork) {
          const cachedMembers = queryClient.getQueryData<TeamMember[]>(['users', boundCompany.company_id]) || [];
          if (cachedMembers.length > 0) {
            const sortedCachedMembers = sortTeamMembers(cachedMembers);
            console.log('👥 Using cached team members from device live layer');
            setMembers(sortedCachedMembers);
            setLoading(false);
            return;
          }
        }
        
        // Fetch via edge function (bypasses RLS)
        const { data, error } = await supabase.functions.invoke('pin-users-fetch', {
          body: { companyId: boundCompany.company_id, isDeviceBound: true }
        });
        
        if (error || !data?.success) {
          console.error('❌ Failed to fetch team members via edge function:', error);
          throw new Error('Failed to fetch team members');
        }
        
        const sortedMembers = sortTeamMembers(data.users || []);
        setMembers(sortedMembers);
        queryClient.setQueryData(['users', boundCompany.company_id], data.users);
        console.log(`✅ Fetched ${data.users?.length || 0} team members via edge function`);
        setLoading(false);
        return;
      }
      
      // Web auth flow for non-bound users
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get current user's company_id first for company isolation
      const { data: currentUserData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching current user:', userError);
        throw new Error('Unable to determine your company');
      }

      if (!currentUserData?.company_id) {
        throw new Error('You are not associated with a company');
      }

      // If device live and not forcing network, use cached data
      if (deviceLive.isActive && !opts?.forceNetwork) {
        const cachedMembers = queryClient.getQueryData<TeamMember[]>(['users', currentUserData.company_id]) || [];
        if (cachedMembers.length > 0) {
          const sortedCachedMembers = sortTeamMembers(cachedMembers);
          console.log('👥 Using cached team members from device live layer');
          setMembers(sortedCachedMembers);
          setLoading(false);
          return;
        }
        // If cache is empty, fall through to network fetch
        console.log('Cache empty, fetching from network');
      }

      // Fetch via edge function (bypasses RLS, consistent with bound devices)
      const { data: functionData, error } = await supabase.functions.invoke('pin-users-fetch', {
        body: { companyId: currentUserData.company_id, isDeviceBound: false }
      });

      if (error || !functionData?.success) {
        console.error('Error fetching team members:', error);
        throw new Error('Failed to fetch team members');
      }
      
      const data = functionData.users || [];
      
      // Sort members by role hierarchy (Owner → Admin → Manager → Staff) and then alphabetically
      const sortedMembers = sortTeamMembers(data || []);
      
      console.log('Fetched team members:', sortedMembers);
      setMembers(sortedMembers);
      
      // Update cache for device live layer with sorted data
      queryClient.setQueryData(['users', currentUserData.company_id], sortedMembers);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error",
        description: "Failed to fetch team members. Please check your permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const inviteTeamMember = async (memberData: { full_name: string; role: string; pin_code: string }): Promise<void> => {
    try {
      console.log('Adding PIN-only team member:', { ...memberData, pin_code: '[HIDDEN]' });
      
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Generate a unique email for PIN-only users
      const email = `${memberData.full_name.toLowerCase().replace(/\s+/g, '.')}.${memberData.pin_code}@internal.staff`;
      
      // Use the new invite_team_member_with_pin function
      const { data, error } = await supabase.rpc('invite_team_member_with_pin', {
        p_email: email,
        p_full_name: memberData.full_name,
        p_role: memberData.role,
        p_pin: memberData.pin_code
      });

      if (error) {
        console.error('Error creating PIN user:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Failed to add team member');
      }

      const response = data as unknown as PasswordUpdateResponse;
      if (!response.success) {
        // Handle specific errors
        if (response.error?.includes('PIN is already in use')) {
          throw new Error('This PIN is already in use. Please choose a different PIN.');
        } else if (response.error?.includes('PIN must be exactly 4 digits')) {
          throw new Error('PIN must be exactly 4 digits.');
        } else {
          throw new Error(response.error || 'Failed to add team member');
        }
      }

      console.log('PIN-only team member added successfully:', data);
      
      toast({
        title: "Success",
        description: `${memberData.full_name} has been added to the team with PIN access.`,
      });
      
      // Refresh the list to show the new member - force network fetch to bypass cache
      await fetchTeamMembers({ forceNetwork: true });
    } catch (error: any) {
      console.error('Error adding team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeTeamMember = async (memberId: string) => {
    try {
      console.log('Soft deleting team member:', memberId);
      
      // Get the current user to prevent self-deletion
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get current user's company_id for cache invalidation
      const { data: currentUserData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      // Get the member to find their auth_user_id
      const { data: member, error: fetchError } = await supabase
        .from('users')
        .select('auth_user_id, email')
        .eq('id', memberId)
        .single();

      if (fetchError) {
        console.error('Error fetching member:', fetchError);
        throw fetchError;
      }

      // Prevent self-deletion
      if (member.auth_user_id === user.id) {
        throw new Error('You cannot remove yourself from the team');
      }

      // Optimistically update local state
      setMembers(prev => prev.filter(m => m.id !== memberId));

      // Use company-specific soft delete function
      const { data, error } = await supabase.rpc('soft_delete_company_user', {
        user_id_param: memberId
      });

      if (error) {
        console.error('Error soft deleting team member:', error);
        // Rollback optimistic update
        await fetchTeamMembers();
        throw error;
      }

      const response = data as { success: boolean; message?: string; error?: string };
      if (!response?.success) {
        // Rollback optimistic update
        await fetchTeamMembers();
        throw new Error(response?.error || 'Failed to remove team member');
      }
      
      console.log('Team member soft deleted successfully');
      
      // Invalidate React Query cache
      if (currentUserData?.company_id) {
        queryClient.invalidateQueries({ queryKey: ['users', currentUserData.company_id] });
      }
      
      // Don't show toast here - let the parent component handle it
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
      throw error;
    }
  };

  const reactivateTeamMember = async (memberId: string) => {
    try {
      console.log('Reactivating team member:', memberId);
      
      // Use company-specific reactivate function
      const { data, error } = await supabase.rpc('reactivate_company_user', {
        user_id_param: memberId
      });

      if (error) {
        console.error('Error reactivating team member:', error);
        throw error;
      }

      const response = data as { success: boolean; message?: string; error?: string };
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to reactivate team member');
      }
      
      console.log('Team member reactivated successfully');
      
      toast({
        title: "Success",
        description: "Team member reactivated successfully",
      });
      
      // Refresh the list
      await fetchTeamMembers();
    } catch (error: any) {
      console.error('Error reactivating team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate team member",
        variant: "destructive",
      });
      throw error;
    }
  };

  const fetchInactiveTeamMembers = async () => {
    try {
      console.log('Fetching inactive team members...');
      
      // Get the current user first to check if they have permission
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get current user's company_id first for company isolation
      const { data: currentUserData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching current user:', userError);
        throw new Error('Unable to determine your company');
      }

      if (!currentUserData?.company_id) {
        throw new Error('You are not associated with a company');
      }

      // Fetch inactive users from the same company only
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id', currentUserData.company_id)
        .eq('is_active', false)
        .order('deleted_at', { ascending: false });

      if (error) {
        console.error('Error fetching inactive team members:', error);
        throw error;
      }
      
      console.log('Fetched inactive team members:', data);
      return data || [];
    } catch (error) {
      console.error('Error fetching inactive team members:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inactive team members.",
        variant: "destructive",
      });
      return [];
    }
  };

  const changeTeamMemberPassword = async (memberEmail: string, newPassword: string) => {
    try {
      console.log('Changing password for:', memberEmail);
      
      // Use the database function to update the password
      const { data, error } = await supabase.rpc('update_user_password', {
        user_email: memberEmail,
        new_password: newPassword
      });

      if (error) {
        console.error('Error updating password:', error);
        throw error;
      }

      // First cast to unknown, then to our interface to avoid type errors
      const response = data as unknown as PasswordUpdateResponse;

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to update password');
      }
      
      console.log('Password updated successfully for:', memberEmail);
      
      toast({
        title: "Success",
        description: "Team member password updated successfully",
      });
    } catch (error: any) {
      console.error('Error changing team member password:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change team member password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const changeTeamMemberPin = async (memberId: string, newPin: string, ownerPin?: string) => {
    try {
      console.log('Changing PIN for member:', memberId);
      
      // Get current user's company_id for cache management
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: currentUserData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();
      
      // Use the new change_team_member_pin function
      const { data, error } = await supabase.rpc('change_team_member_pin', {
        p_member_id: memberId,
        p_new_pin: newPin,
        p_owner_pin: ownerPin || ''
      });

      if (error) {
        console.error('Error updating PIN:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Failed to update PIN');
      }

      const response = data as unknown as PasswordUpdateResponse;
      if (!response.success) {
        throw new Error(response.error || 'Failed to update PIN');
      }
      
      console.log('PIN updated successfully for member:', memberId);
      
      toast({
        title: "Success",
        description: "Team member PIN updated successfully",
      });
      
      // Dispatch custom event with new PIN for instant UI update
      window.dispatchEvent(new CustomEvent('pinUpdated', {
        detail: { memberId, pin: newPin }
      }));
      
      // Clear only the target user's PIN session (not current admin)
      clearPinUserByUserId(memberId);
      
      // Invalidate cache - DeviceDataManager handles realtime updates
      if (currentUserData?.company_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['users', currentUserData.company_id],
          refetchType: 'none' // Rely on realtime updates, no hard refresh
        });
      }
    } catch (error: any) {
      console.error('Error changing team member PIN:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change team member PIN",
        variant: "destructive",
      });
      throw error;
    }
  };

  const changeTeamMemberRole = async (memberId: string, newRole: string) => {
    try {
      console.log('Changing role for member:', memberId, 'to:', newRole);
      
      // Get current user's company_id for cache management
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: currentUserData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();
      
      // Use the database function to update the role
      const { data, error } = await supabase.rpc('update_user_role', {
        p_target_user_id: memberId,
        p_new_role: newRole
      });

      if (error) {
        console.error('Error updating role:', error);
        throw error;
      }

      // First cast to unknown, then to our interface to avoid type errors
      const response = data as unknown as PasswordUpdateResponse;

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to update role');
      }
      
      console.log('Role updated successfully for member:', memberId);
      
      // Clear the affected user's cached PIN session to force re-login with new role
      clearPinUserByUserId(memberId);
      
      // Immediately update cache and local state for instant UI feedback
      if (currentUserData?.company_id) {
        // Update React Query cache
        queryClient.setQueryData<TeamMember[]>(
          ['users', currentUserData.company_id],
          (old) => sortTeamMembers((old || []).map(m => 
            m.id === memberId ? { ...m, role: newRole } : m
          ))
        );
        
        // Update local state
        setMembers(prev => sortTeamMembers(prev.map(m => 
          m.id === memberId ? { ...m, role: newRole } : m
        )));
      }
      
      // Force fresh data fetch from database
      await fetchTeamMembers({ forceNetwork: true });
    } catch (error: any) {
      console.error('Error changing team member role:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [deviceLive]);

  return {
    members,
    loading,
    inviteTeamMember,
    removeTeamMember,
    reactivateTeamMember,
    fetchInactiveTeamMembers,
    changeTeamMemberPassword,
    changeTeamMemberPin,
    changeTeamMemberRole,
    refetch: fetchTeamMembers
  };
};

export type { TeamMember };
