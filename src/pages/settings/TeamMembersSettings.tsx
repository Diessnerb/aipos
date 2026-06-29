import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import TeamMembersTable from '@/components/settings/TeamMembersTable';
import DeletedUsersTable from '@/components/settings/DeletedUsersTable';
import InviteTeamMemberModal from '@/components/settings/InviteTeamMemberModal';
import ChangePasswordModal from '@/components/settings/ChangePasswordModal';
import ChangePinModal from '@/components/settings/ChangePinModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/AuthProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { useToast } from '@/hooks/use-toast';

const TeamMembersSettings = () => {
  const navigate = useNavigate();
  const deviceLive = useDeviceLiveLayer();
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const { 
    members: teamMembers, 
    loading, 
    inviteTeamMember, 
    removeTeamMember, 
    reactivateTeamMember,
    fetchInactiveTeamMembers,
    changeTeamMemberPassword,
    changeTeamMemberPin,
    changeTeamMemberRole,
    refetch 
  } = useTeamMembers();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ email: string; name: string } | null>(null);
  const [selectedPinMember, setSelectedPinMember] = useState<{ id: string; name: string; requiresOwnerPin: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletedMembers, setDeletedMembers] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [removingMemberIds, setRemovingMemberIds] = useState<Set<string>>(new Set());
  const [changingRoleMemberIds, setChangingRoleMemberIds] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<'active' | 'deleted'>('active');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    // Optimistic UI: immediately mark as removing
    setRemovingMemberIds(prev => new Set(prev).add(memberId));
    
    try {
      await removeTeamMember(memberId);
      
      // Auto-refresh deleted members list
      await loadDeletedMembers();
      
      // Show success with option to view
      toast({
        title: "Member Removed",
        description: "Team member has been moved to deleted members.",
        action: currentTab === 'active' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentTab('deleted')}
          >
            View
          </Button>
        ) : undefined
      });
    } catch (error) {
      // Error handling is done in useTeamMembers
      console.error('Error removing member:', error);
    } finally {
      // Remove from optimistic state
      setRemovingMemberIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }
  };

  const handleChangePassword = (memberEmail: string, memberName: string) => {
    setSelectedMember({ email: memberEmail, name: memberName });
    setShowPasswordModal(true);
  };

  const handlePasswordChange = async (newPassword: string) => {
    if (selectedMember) {
      await changeTeamMemberPassword(selectedMember.email, newPassword);
      setShowPasswordModal(false);
      setSelectedMember(null);
    }
  };

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false);
    setSelectedMember(null);
  };

  const handleChangePin = (memberId: string, memberName: string) => {
    // Always require current user's PIN for authorization (hierarchy enforced by backend)
    const requiresOwnerPin = true;
    setSelectedPinMember({ id: memberId, name: memberName, requiresOwnerPin });
    setShowPinModal(true);
  };

  const handlePinChange = async (newPin: string, ownerPin?: string) => {
    if (selectedPinMember) {
      await changeTeamMemberPin(selectedPinMember.id, newPin, ownerPin);
      setShowPinModal(false);
      setSelectedPinMember(null);
    }
  };

  const handlePinModalClose = () => {
    setShowPinModal(false);
    setSelectedPinMember(null);
  };

  const handleInvite = async (memberData: { full_name: string; role: string; pin_code: string }) => {
    await inviteTeamMember(memberData);
    setShowInviteModal(false);
  };

  const handleReactivateMember = async (memberId: string) => {
    await reactivateTeamMember(memberId);
    // Refresh both lists
    await handleRefresh();
    await loadDeletedMembers();
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    // Optimistic UI: immediately mark as changing
    setChangingRoleMemberIds(prev => new Set(prev).add(memberId));
    
    try {
      await changeTeamMemberRole(memberId, newRole);
      
      // Broadcast role change event for instant session refresh across tabs
      window.dispatchEvent(new CustomEvent('roleChanged', { 
        detail: { userId: memberId } 
      }));
      
      toast({
        title: "Role Updated",
        description: "Team member role has been successfully updated.",
      });
      
      // Refresh to get updated sorted list
      await refetch();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update role",
        variant: "destructive",
      });
    } finally {
      // Remove from optimistic state
      setChangingRoleMemberIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }
  };

  const loadDeletedMembers = async () => {
    setLoadingDeleted(true);
    try {
      const deleted = await fetchInactiveTeamMembers();
      setDeletedMembers(deleted);
    } finally {
      setLoadingDeleted(false);
    }
  };

  // Assume admin access for now - can be enhanced with proper permission checking
  const canManageTeamMembers = true;
  
  if (!canManageTeamMembers) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </div>

        <PageHeader 
          title="Team Members" 
          subtitle="Manage your team members and their permissions" 
        />

        <Alert>
          <AlertDescription>
            You don't have permission to manage team members. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </div>

        <PageHeader 
          title="Team Members" 
          subtitle="Manage your team members and their permissions" 
        />

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Manage team member access and permissions
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button onClick={() => setShowInviteModal(true)}>
                Add Member
              </Button>
            </div>
          </div>

          <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'active' | 'deleted')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Members</TabsTrigger>
              <TabsTrigger 
                value="deleted" 
                className="flex items-center gap-2"
                onClick={loadDeletedMembers}
              >
                <Trash2 className="h-4 w-4" />
                Deleted Members
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4">
              <TeamMembersTable
                members={teamMembers.filter(m => !removingMemberIds.has(m.id))}
                loading={loading}
                onRemoveMember={handleRemoveMember}
                onChangePassword={handleChangePassword}
                onChangePin={handleChangePin}
                onChangeRole={handleChangeRole}
                canChangeRole={true}
                currentUser={currentUser}
                removingMemberIds={removingMemberIds}
                changingRoleMemberIds={changingRoleMemberIds}
              />
            </TabsContent>
            
            <TabsContent value="deleted" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Deleted team members can be reactivated to restore their access
                </p>
                <Button 
                  variant="outline" 
                  onClick={loadDeletedMembers}
                  disabled={loadingDeleted}
                >
                  {loadingDeleted ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              
              <DeletedUsersTable
                members={deletedMembers}
                loading={loadingDeleted}
                onReactivateMember={handleReactivateMember}
              />
            </TabsContent>
          </Tabs>

          <InviteTeamMemberModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            onInvite={handleInvite}
          />

          <ChangePasswordModal
            isOpen={showPasswordModal}
            onClose={handlePasswordModalClose}
            onChangePassword={handlePasswordChange}
            memberName={selectedMember?.name || ''}
          />

          <ChangePinModal
            isOpen={showPinModal}
            onClose={handlePinModalClose}
            onChangePin={handlePinChange}
            memberName={selectedPinMember?.name || ''}
            requiresOwnerPin={selectedPinMember?.requiresOwnerPin || false}
          />
        </div>
    </div>
  );
};

export default TeamMembersSettings;