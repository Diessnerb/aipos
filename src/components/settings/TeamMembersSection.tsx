
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, RefreshCw, AlertCircle } from 'lucide-react';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import TeamMembersTable from './TeamMembersTable';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import ChangePasswordModal from './ChangePasswordModal';
import { useAuth } from '@/components/AuthProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const TeamMembersSection = () => {
  const { members, loading, inviteTeamMember, removeTeamMember, changeTeamMemberPassword, changeTeamMemberRole, refetch } = useTeamMembers();
  const { currentUser } = useCurrentUser();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ email: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { userRole, canManageTeam, canAssignRoles } = useAuth();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (window.confirm('Are you sure you want to remove this team member?')) {
      await removeTeamMember(memberId);
    }
  };

  const handleChangePassword = (memberEmail: string, memberName: string) => {
    setSelectedMember({ email: memberEmail, name: memberName });
    setPasswordModalOpen(true);
  };

  const handlePasswordChange = async (newPassword: string) => {
    if (selectedMember) {
      await changeTeamMemberPassword(selectedMember.email, newPassword);
    }
  };

  const handlePasswordModalClose = () => {
    setPasswordModalOpen(false);
    setSelectedMember(null);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await changeTeamMemberRole(memberId, newRole);
    } catch (error) {
      console.error('Failed to change role:', error);
    }
  };

  const handleInvite = async (memberData: { full_name: string; role: string; pin_code: string }) => {
    await inviteTeamMember(memberData);
  };

  // Display access restriction for non-admin users
  if (!canManageTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage your team members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              Only administrators can manage team members. Your current role is: {userRole || 'Unknown'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your team members with PIN-only or full access
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setInviteModalOpen(true)}
              disabled={loading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TeamMembersTable
            members={members}
            onRemoveMember={handleRemoveMember}
            onChangePassword={handleChangePassword}
            onChangePin={() => {}} // Placeholder for now
            onChangeRole={handleRoleChange}
            loading={loading}
            canChangeRole={canAssignRoles}
            currentUser={currentUser}
          />
        </CardContent>
      </Card>

      <InviteTeamMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvite={handleInvite}
        canAssignAdmin={canAssignRoles}
      />

      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={handlePasswordModalClose}
        onChangePassword={handlePasswordChange}
        memberName={selectedMember?.name || ''}
      />
    </>
  );
};

export default TeamMembersSection;
