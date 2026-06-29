
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPinUser, PinUser, clearPinUser } from '@/utils/pinAuth';
import { getBoundCompany } from '@/utils/deviceBinding';
import { PERMISSION_PAGES } from '@/config/permissionPages';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  pinUser: PinUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signOutPin: () => void;
  userRole: string | null;
  companyId: string | null;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  canManageTeam: boolean;
  canAssignRoles: boolean;
  canEditRotas: boolean;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pinUser, setPinUser] = useState<PinUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Initialize companyId synchronously from bound device or stored PIN user
  const [companyId, setCompanyId] = useState<string | null>(() => {
    const boundCompany = getBoundCompany();
    const currentPinUser = getCurrentPinUser();
    
    const initialCompanyId = currentPinUser?.company_id || boundCompany?.company_id || null;
    
    if (initialCompanyId) {
      console.log('⚡ AuthProvider: Initial companyId set immediately:', initialCompanyId);
    }
    
    return initialCompanyId;
  });

  // Batch state updates for PIN user to eliminate multiple rerenders
  const setPinUserBatched = React.useCallback((userData: PinUser | null) => {
    React.startTransition(() => {
      setPinUser(userData);
      setUserRole(userData?.role || null);
      setCompanyId(userData?.company_id || null);
    });
  }, []);

  // Initialize PIN user state immediately - ZERO loading state for device-bound scenarios
  useEffect(() => {
    const currentPinUser = getCurrentPinUser();
    const boundCompany = getBoundCompany();
    
    // For device-bound scenarios, set loading to false immediately to prevent flash
    if (boundCompany) {
      setLoading(false);
    }
    
    if (currentPinUser) {
      console.log('⚡ Setting PIN user on mount (instant):', currentPinUser);
      setPinUserBatched(currentPinUser);
    }
  }, []);

  // Listen for PIN user changes and UI lock changes to update context immediately
  useEffect(() => {
    const handlePinUserChange = () => {
      const currentPinUser = getCurrentPinUser();
      console.log('🔄 AuthProvider PIN user change detected:', currentPinUser);
      
      if (currentPinUser) {
        console.log('⚡ Setting PIN user in AuthProvider context (instant):', currentPinUser.user_id);
        setPinUserBatched(currentPinUser);
        console.log('✅ AuthProvider context updated with PIN user');
        
        // Dispatch confirmation that context is ready for navigation
        window.dispatchEvent(new CustomEvent('pinUserContextReady', { 
          detail: { userId: currentPinUser.user_id } 
        }));
      } else {
        console.log('❌ Clearing PIN user from AuthProvider context');
        setPinUserBatched(null);
      }
    };

    // Handle context check requests for synchronization
    const handleContextCheck = (event: CustomEvent) => {
      const { expectedUserId } = event.detail;
      const currentPinUser = getCurrentPinUser();
      
      console.log('🔍 AuthProvider context check request:', { 
        expectedUserId, 
        currentContextUserId: pinUser?.user_id,
        storageUserId: currentPinUser?.user_id 
      });
      
      // Check if context matches expected user
      if (pinUser?.user_id === expectedUserId) {
        console.log('✅ Context already synchronized');
        window.dispatchEvent(new CustomEvent('pinUserContextChecked', { 
          detail: { userId: expectedUserId } 
        }));
      } else if (currentPinUser?.user_id === expectedUserId) {
        // Context not updated yet, but storage has the user - trigger update
        console.log('🔄 Triggering context update for synchronization');
        handlePinUserChange();
        // Dispatch success after a brief delay to allow state update
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('pinUserContextChecked', { 
            detail: { userId: expectedUserId } 
          }));
        }, 50);
      }
    };

    // Handle UI lock state changes - when UI gets locked/unlocked, re-evaluate PIN user
    const handleUILockChange = () => {
      console.log('🔐 UI lock state changed, re-evaluating PIN user');
      handlePinUserChange();
    };

    // Handle role change events - force logout if current user's role was changed
    const handleRoleChanged = (event: CustomEvent) => {
      const { userId } = event.detail;
      if (pinUser?.user_id === userId) {
        console.log('🔄 Role changed for current user, forcing re-login');
        clearPinUser();
        window.location.href = '/login';
      }
    };

    // Listen for custom PIN change events
    window.addEventListener('pinUserChanged', handlePinUserChange);
    // Listen for UI lock state changes
    window.addEventListener('uiLockChanged', handleUILockChange);
    // Also listen for storage events (cross-tab communication)
    window.addEventListener('storage', handlePinUserChange);
    // Listen for context synchronization checks
    window.addEventListener('checkPinUserContext', handleContextCheck as EventListener);
    // Listen for role change events
    window.addEventListener('roleChanged', handleRoleChanged as EventListener);

    return () => {
      window.removeEventListener('pinUserChanged', handlePinUserChange);
      window.removeEventListener('uiLockChanged', handleUILockChange);
      window.removeEventListener('storage', handlePinUserChange);
      window.removeEventListener('checkPinUserContext', handleContextCheck as EventListener);
      window.removeEventListener('roleChanged', handleRoleChanged as EventListener);
    };
  }, [session]);

  useEffect(() => {
    // Set up auth state listener with session refresh capabilities
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state change:', event, 'session exists:', !!session);
        
        // Check if we're in owner login flow (on /owner-login page)
        const isOwnerLoginFlow = window.location.pathname === '/owner-login';
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('✅ User session detected, isOwnerLoginFlow:', isOwnerLoginFlow);
          
          // User has Supabase session - don't clear PIN user if it exists
          const currentPinUser = getCurrentPinUser();
          if (!currentPinUser) {
            // Only clear PIN state if no PIN user exists
            setPinUser(null);
            
            // Skip profile creation and role fetching during owner login flow
            if (!isOwnerLoginFlow) {
              // Defer Supabase calls to prevent session interference
              setTimeout(async () => {
                try {
                  await supabase.rpc('ensure_user_profile_for_current_auth');
                } catch (e) {
                  console.warn('⚠️ ensure_user_profile_for_current_auth failed:', e);
                }
                fetchUserRole(session.user.id);
              }, 0);
            } else {
              console.log('⏭️ Skipping profile operations during owner login flow');
              setLoading(false); // Set loading to false for owner login
            }
          } else {
            console.log('📌 PIN user exists, preserving PIN state');
          }
          // If PIN user exists, keep PIN state and don't fetch role from DB
        } else {
          console.log('❌ No Supabase session detected');
          // No Supabase session - check for PIN user
          const currentPinUser = getCurrentPinUser();
          if (currentPinUser) {
            setPinUser(currentPinUser);
            setUserRole(currentPinUser.role);
            setCompanyId(currentPinUser.company_id);
            setLoading(false);
          } else {
            setUserRole(null);
            setCompanyId(null);
            setLoading(false);
          }
        }
        
        // Defer session validation to prevent session interference
        if (session && window.location.pathname === '/super-admin') {
          setTimeout(async () => {
            try {
              const { data: sessionValidation } = await supabase.rpc('validate_super_admin_session');
              console.log('🔍 Session validation result:', sessionValidation);
              const validation = sessionValidation as any;
              if (!validation?.valid) {
                console.warn('⚠️ Invalid super admin session, redirecting to login');
                window.location.href = '/super-admin-login';
              }
            } catch (error) {
              console.error('❌ Session validation failed:', error);
            }
          }, 0);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check, session exists:', !!session);
      
      // Check if we're in owner login flow
      const isOwnerLoginFlow = window.location.pathname === '/owner-login';
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('Initial session user found, isOwnerLoginFlow:', isOwnerLoginFlow);
        const currentPinUser = getCurrentPinUser();
        if (!currentPinUser) {
          // Skip profile operations during owner login flow
          if (!isOwnerLoginFlow) {
            try {
              await supabase.rpc('ensure_user_profile_for_current_auth');
            } catch (e) {
              console.warn('ensure_user_profile_for_current_auth failed:', e);
            }
            fetchUserRole(session.user.id);
          } else {
            console.log('Skipping initial profile operations during owner login flow');
            setLoading(false); // Set loading to false for owner login
          }
        }
      } else {
        // Check for PIN user when no Supabase session
        const currentPinUser = getCurrentPinUser();
        if (currentPinUser) {
          setPinUserBatched(currentPinUser);
        } else {
          setUserRole(null);
          setCompanyId(null);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh auth session when network reconnects
  useEffect(() => {
    const handleOnlineReconnection = async () => {
      if (!session) return;
      
      console.log('🌐 Network reconnected - refreshing session');
      
      try {
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('❌ Session refresh failed:', error);
          setSession(null);
          setUser(null);
        } else if (data.session) {
          console.log('✅ Session refreshed after reconnection');
          setSession(data.session);
          setUser(data.session.user);
        }
      } catch (error) {
        console.error('❌ Error refreshing session:', error);
      }
    };
    
    window.addEventListener('online', handleOnlineReconnection);
    return () => window.removeEventListener('online', handleOnlineReconnection);
  }, [session]);

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('Fetching user role for auth_user_id:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select('role, company_id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user role:', error);
        // For owner login flow, don't set default values that could cause issues
        setUserRole(null);
        // Preserve bound company ID if device is bound
        const bound = getBoundCompany();
        setCompanyId(bound?.company_id || null);
      } else if (data) {
        console.log('User role found:', data);
        setUserRole(data.role);
        setCompanyId(data.company_id);
      } else {
        console.log('No user profile found');
        setUserRole(null);
        // Preserve bound company ID if device is bound
        const bound = getBoundCompany();
        setCompanyId(bound?.company_id || null);
      }
    } catch (error) {
      console.error('Exception in fetchUserRole:', error);
      setUserRole(null);
      // Preserve bound company ID if device is bound
      const bound = getBoundCompany();
      setCompanyId(bound?.company_id || null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    
    // Also clear PIN user data
    clearPinUser();
    setPinUser(null);
    setUserRole(null);
    // Preserve bound company ID if device is bound
    const bound = getBoundCompany();
    setCompanyId(bound?.company_id || null);
  };

  const signOutPin = () => {
    try {
      console.info('🔓 Clearing PIN user session (preserving device binding)');
      
      // clearPinUser already handles UI locking and state clearing
      clearPinUser();
      setPinUser(null);
      
      // CRITICAL: Do NOT set companyId to null during PIN logout
      // The bound company should remain available for the data layer
      // The effectiveCompanyId will fall back to boundCompany automatically
      
      // If there's a Supabase session, fetch role from database
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        // DO NOT clear companyId - let it fall back to bound company
        console.log('✅ PIN cleared, companyId preserved for bound device');
      }
    } catch (error) {
      console.error('Error during PIN logout:', error);
      // Still clear PIN state even if there's an error
      setPinUser(null);
      setUserRole(null);
      // DO NOT clear companyId - preserve bound company
    }
  };

  // Ensure page permissions exist for the current company
  useEffect(() => {
    // Get effective company ID
    const boundCompany = getBoundCompany();
    const effectiveCompanyId = pinUser?.company_id || boundCompany?.company_id || companyId;
    
    if (loading || !effectiveCompanyId) return;

    const ensurePermissions = async () => {
      try {
        // Fetch existing permissions for this company
        const { data: existingPermissions, error: fetchError } = await supabase
          .from('page_permissions')
          .select('page_name, access_level')
          .eq('company_id', effectiveCompanyId);

        if (fetchError) {
          console.error('Error fetching existing permissions:', fetchError);
          return;
        }

        // Build set of existing permission keys
        const existingKeys = new Set(
          (existingPermissions || []).map(p => `${p.page_name}|${p.access_level}`)
        );

        // Generate all required permissions from PERMISSION_PAGES
        const requiredPermissions: Array<{
          page_name: string;
          access_level: 'staff' | 'manager' | 'admin';
          permission_type: 'view' | 'growth' | 'edit' | 'admin';
          company_id: string;
        }> = [];

        PERMISSION_PAGES.forEach(page => {
          (['staff', 'manager', 'admin'] as const).forEach(level => {
            const key = `${page.key}|${level}`;
            
            // Only add if this permission doesn't already exist
            if (!existingKeys.has(key)) {
              const permissionType = page.defaults[level];
              
              // Only insert if not 'no_access' (we don't store no_access entries)
              if (permissionType !== 'no_access') {
                requiredPermissions.push({
                  page_name: page.key,
                  access_level: level,
                  permission_type: permissionType,
                  company_id: effectiveCompanyId
                });
              }
            }
          });
        });

        // Insert missing permissions
        if (requiredPermissions.length > 0) {
          console.log(`🔄 Ensuring ${requiredPermissions.length} missing page permissions for company ${effectiveCompanyId}`);
          
          const { error: insertError } = await supabase
            .from('page_permissions')
            .upsert(requiredPermissions, {
              onConflict: 'company_id,page_name,access_level'
            });

          if (insertError) {
            console.error('Error inserting missing permissions:', insertError);
          } else {
            console.log('✅ Successfully ensured page permissions');
          }
        }
      } catch (error) {
        console.error('Error in ensurePermissions:', error);
      }
    };

    ensurePermissions();
  }, [companyId, pinUser?.company_id, loading]);

  // Define role-based permissions - use PIN user role if available, otherwise use database role
  const effectiveRole = pinUser?.role || userRole;
  
  // CRITICAL: Prioritize bound company for device-based access
  const boundCompany = getBoundCompany();
  const effectiveCompanyId = pinUser?.company_id || boundCompany?.company_id || companyId;
  
  // Check if user is owner (has unrestricted access)
  const isOwner = pinUser?.is_owner || false;
  
  // Debug logging
  console.log('AuthProvider state:', {
    pinUser: pinUser ? { role: pinUser.role, company_id: pinUser.company_id, is_owner: pinUser.is_owner } : null,
    boundCompany: boundCompany ? { company_id: boundCompany.company_id, company_name: boundCompany.company_name } : null,
    userRole,
    companyId,
    effectiveRole,
    effectiveCompanyId,
    isOwner
  });
  
  const isAdmin = effectiveRole === 'admin' || isOwner;
  const isManager = effectiveRole === 'manager' || isAdmin;
  const isStaff = effectiveRole === 'staff' || isManager;
  
  // Define specific permissions based on roles (owners have all permissions)
  const canManageTeam = isAdmin; // Only admins can manage team members
  const canAssignRoles = isAdmin; // Only admins can assign roles
  const canEditRotas = isAdmin || isManager; // Admins and managers can edit rotas

  // Memoized role-based permissions to avoid recalculation
  const memoizedPermissions = React.useMemo(() => ({
    isAdmin,
    isManager,
    isStaff,
    canManageTeam,
    canAssignRoles,
    canEditRotas,
    isOwner
  }), [isAdmin, isManager, isStaff, canManageTeam, canAssignRoles, canEditRotas, isOwner]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      pinUser,
      loading, 
      signOut, 
      signOutPin,
      userRole: effectiveRole,
      companyId: effectiveCompanyId,
      ...memoizedPermissions
    }}>
      {children}
    </AuthContext.Provider>
  );
};
