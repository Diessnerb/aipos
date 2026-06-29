import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Key, Shield, User, Crown, PenTool, Hash, Eye, EyeOff, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  auth_user_id: string | null;
  pin_code: string | null;
  is_active: boolean;
  deleted_at: string | null;
  is_company_admin?: boolean;
  is_owner?: boolean;
}

interface CurrentUser {
  id: string;
  role: string;
  is_owner?: boolean;
}

interface TeamMembersTableProps {
  members: TeamMember[];
  onRemoveMember: (memberId: string) => void;
  onChangePassword: (memberEmail: string, memberName: string) => void;
  onChangePin: (memberId: string, memberName: string) => void;
  onChangeRole: (memberId: string, newRole: string) => void;
  loading: boolean;
  canChangeRole: boolean;
  currentUser: CurrentUser | null;
  removingMemberIds?: Set<string>;
  changingRoleMemberIds?: Set<string>;
}

const TeamMembersTable = ({ 
  members, 
  onRemoveMember, 
  onChangePassword, 
  onChangePin,
  onChangeRole,
  loading,
  canChangeRole,
  currentUser,
  removingMemberIds = new Set(),
  changingRoleMemberIds = new Set()
}: TeamMembersTableProps) => {
  const [visiblePins, setVisiblePins] = useState<Set<string>>(new Set());
  const [decryptedPins, setDecryptedPins] = useState<Record<string, string | null>>({});

  // Clear decrypted PINs cache when members data changes
  useEffect(() => {
    setDecryptedPins({});
    setVisiblePins(new Set());
  }, [members]);

  // Listen for PIN update events for instant display
  useEffect(() => {
    const handlePinUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ memberId: string; pin: string }>;
      const { memberId, pin } = customEvent.detail;
      
      // Immediately update the decrypted PIN and show it
      setDecryptedPins(prev => ({ ...prev, [memberId]: pin }));
      setVisiblePins(prev => new Set(prev).add(memberId));
    };

    window.addEventListener('pinUpdated', handlePinUpdate);
    return () => window.removeEventListener('pinUpdated', handlePinUpdate);
  }, []);

  const togglePinVisibility = async (memberId: string) => {
    const isCurrentlyVisible = visiblePins.has(memberId);
    
    if (!isCurrentlyVisible && decryptedPins[memberId] === undefined) {
      // Fetch decrypted PIN
      try {
        const { data, error } = await supabase.rpc('get_decrypted_pin', {
          user_id_param: memberId
        });
        
        if (error) {
          console.error('Error fetching decrypted PIN:', error);
          setDecryptedPins(prev => ({ ...prev, [memberId]: null }));
          return;
        }
        
        setDecryptedPins(prev => ({ ...prev, [memberId]: data || null }));
      } catch (error) {
        console.error('Error decrypting PIN:', error);
        setDecryptedPins(prev => ({ ...prev, [memberId]: null }));
        return;
      }
    }
    
    setVisiblePins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const canViewPin = (member: TeamMember): boolean => {
    if (!member.pin_code || !currentUser) return false;
    
    // Owner can view all PINs
    if (currentUser.is_owner) return true;
    
    // Admins can view staff and manager PINs
    if (currentUser.role === 'admin' && ['staff', 'manager'].includes(member.role)) {
      return true;
    }
    
    // Managers can view staff PINs only
    if (currentUser.role === 'manager' && member.role === 'staff') {
      return true;
    }
    
    return false;
  };

  const getRoleIcon = (role: string, isOwner?: boolean) => {
    if (isOwner) return <Crown className="w-4 h-4" />;
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'manager':
        return <UserCog className="w-4 h-4" />;
      case 'staff':
        return <User className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string, isOwner?: boolean) => {
    if (isOwner) return 'bg-amber-100 text-amber-800 border-amber-200';
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccessTypeInfo = (member: TeamMember) => {
    if (member.pin_code && !member.auth_user_id) {
      return {
        type: 'PIN Only',
        icon: <Key className="w-4 h-4" />,
        color: 'bg-purple-100 text-purple-800 border-purple-200'
      };
    } else if (member.auth_user_id) {
      return {
        type: 'Full Access',
        icon: <Shield className="w-4 h-4" />,
        color: 'bg-green-100 text-green-800 border-green-200'
      };
    } else {
      return {
        type: 'No Access',
        icon: <User className="w-4 h-4" />,
        color: 'bg-gray-100 text-gray-800 border-gray-200'
      };
    }
  };

  const getAvailableRoles = (currentUserRole: string, currentUserIsOwner: boolean, targetRole: string, targetIsOwner: boolean) => {
    const allRoles = ['staff', 'manager', 'admin'];
    
    // Cannot change owner role
    if (targetIsOwner) {
      return [];
    }
    
    // Owners can set any role
    if (currentUserIsOwner) {
      return allRoles;
    }
    
    // Admins can only change staff and manager roles
    if (currentUserRole === 'admin') {
      if (targetRole === 'admin') {
        return []; // Cannot change other admins
      }
      return ['staff', 'manager'];
    }
    
    // Managers can only change staff roles
    if (currentUserRole === 'manager') {
      if (targetRole === 'staff') {
        return ['staff'];
      }
      return [];
    }
    
    return [];
  };

  const canEditRole = (member: TeamMember) => {
    if (!canChangeRole || !currentUser) return false;
    
    // Cannot edit own role
    if (member.id === currentUser.id) return false;
    
    // Cannot edit owner role
    if (member.is_owner) return false;
    
    // Owner can edit anyone (except themselves)
    if (currentUser.is_owner) {
      return true;
    }
    
    // Admins cannot edit other admins or owners
    if (currentUser.role === 'admin') {
      return ['staff', 'manager'].includes(member.role);
    }
    
    // Managers can only edit staff
    if (currentUser.role === 'manager') {
      return member.role === 'staff';
    }
    
    return false;
  };

  const canChangePin = (member: TeamMember): boolean => {
    if (!member.pin_code || !currentUser) return false;
    
    // Cannot change own PIN through this interface
    if (member.id === currentUser.id) return false;
    
    // Cannot change owner PIN
    if (member.is_owner) return false;
    
    // Owner can change all PINs
    if (currentUser.is_owner) return true;
    
    // Admins can change staff and manager PINs
    if (currentUser.role === 'admin' && ['staff', 'manager'].includes(member.role)) {
      return true;
    }
    
    // Managers can change staff PINs only
    if (currentUser.role === 'manager' && member.role === 'staff') {
      return true;
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading team members...</p>
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center p-8">
        <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
        <p className="text-gray-500">Add your first team member to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40 min-w-[10rem]">Name</TableHead>
            <TableHead className="w-32 min-w-[8rem]">Role</TableHead>
            <TableHead className="w-32 min-w-[8rem]">Access Type</TableHead>
            <TableHead className="w-24 min-w-[6rem]">PIN</TableHead>
            <TableHead className="w-28 min-w-[7rem]">Added</TableHead>
            <TableHead className="w-48 min-w-[12rem] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const accessInfo = getAccessTypeInfo(member);
            const isRemoving = removingMemberIds.has(member.id);
            const isChangingRole = changingRoleMemberIds.has(member.id);
            
            return (
              <TableRow key={member.id} className={isRemoving || isChangingRole ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  {member.full_name}
                </TableCell>
                <TableCell>
                  {canEditRole(member) ? (
                    <Select
                      value={member.role}
                      onValueChange={(newRole) => onChangeRole(member.id, newRole)}
                      disabled={isChangingRole}
                    >
                      <SelectTrigger className="w-32" disabled={isChangingRole}>
                        <SelectValue>
                          <div className="flex items-center gap-1">
                            {getRoleIcon(member.role, member.is_owner)}
                            {member.is_owner ? 'Owner' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRoles(
                          currentUser?.role || '', 
                          currentUser?.is_owner || false,
                          member.role,
                          member.is_owner || false
                        ).map((role) => (
                          <SelectItem key={role} value={role}>
                            <div className="flex items-center gap-1">
                              {getRoleIcon(role)}
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className={`flex items-center gap-1 w-fit ${getRoleBadgeColor(member.role, member.is_owner)}`}
                    >
                      {getRoleIcon(member.role, member.is_owner)}
                      {member.is_owner ? 'Owner' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`flex items-center gap-1 w-fit ${accessInfo.color}`}
                  >
                    {accessInfo.icon}
                    {accessInfo.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.pin_code ? (
                    <div className="flex items-center gap-2">
                      {decryptedPins[member.id] === null ? (
                        <span className="text-xs text-muted-foreground">
                          Legacy PIN - Change to view
                        </span>
                      ) : (
                        <>
                          <span className="font-mono text-sm">
                            {canViewPin(member) && visiblePins.has(member.id) 
                              ? (decryptedPins[member.id] || '****')
                              : '****'
                            }
                          </span>
                          {canViewPin(member) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePinVisibility(member.id)}
                              className="h-6 w-6 p-0"
                            >
                              {visiblePins.has(member.id) 
                                ? <EyeOff className="w-3 h-3" /> 
                                : <Eye className="w-3 h-3" />
                              }
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">No PIN</span>
                  )}
                </TableCell>
              <TableCell className="text-gray-600">
                {member.created_at 
                  ? format(new Date(member.created_at), 'MMM d, yyyy')
                  : 'N/A'
                }
              </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {member.auth_user_id && !member.is_owner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onChangePassword(member.email, member.full_name)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Key className="w-4 h-4 mr-1" />
                        Change Password
                      </Button>
                    )}
                    {member.pin_code && canChangePin(member) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onChangePin(member.id, member.full_name)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        <Hash className="w-4 h-4 mr-1" />
                        Change PIN
                      </Button>
                    )}
                    {!member.is_owner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRemoveMember(member.id)}
                        disabled={isRemoving}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {isRemoving ? 'Removing...' : 'Remove'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TeamMembersTable;
