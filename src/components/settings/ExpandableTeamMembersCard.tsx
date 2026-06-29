import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import TeamMembersTable from './TeamMembersTable';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import ChangePasswordModal from './ChangePasswordModal';
import ExpandableSettingsCard from './ExpandableSettingsCard';
import { useAuth } from '@/components/AuthProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const ExpandableTeamMembersCard = () => {
  const { members: teamMembers, loading, inviteTeamMember, removeTeamMember, changeTeamMemberPassword, refetch } = useTeamMembers();
  const { currentUser } = useCurrentUser();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ email: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeTeamMember(memberId);
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

  const handleInvite = async (memberData: { full_name: string; role: string; pin_code: string }) => {
    await inviteTeamMember(memberData);
    setShowInviteModal(false);
  };

  // Assume admin access for now - can be enhanced with proper permission checking
  const canManageTeamMembers = true;
  
  if (!canManageTeamMembers) {
    return (
      <ExpandableSettingsCard
        title="Team Members"
        description="Manage your team and their access"
        icon={<Users className="w-5 h-5 text-primary" />}
      >
        <Alert>
          <AlertDescription>
            You don't have permission to manage team members. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </ExpandableSettingsCard>
    );
  }

  return (
    <ExpandableSettingsCard
      title="Team Members"
      description="Manage your team and their access"
      icon={<Users className="w-5 h-5 text-primary" />}
    >
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

        {/* Error handling can be added here if needed */}

        <TeamMembersTable
          members={teamMembers}
          loading={loading}
          onRemoveMember={handleRemoveMember}
          onChangePassword={handleChangePassword}
          onChangePin={() => {}} // Placeholder for now
          onChangeRole={() => {}} // Placeholder for now
          canChangeRole={true}
          currentUser={currentUser}
        />

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
      </div>
    </ExpandableSettingsCard>
  );
};

export default ExpandableTeamMembersCard;