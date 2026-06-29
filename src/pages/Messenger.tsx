
import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CreateMessageModal } from '@/components/modals/CreateMessageModal';
import { ChannelSidebar } from '@/components/staff-notes/ChannelSidebar';
import { ChatArea } from '@/components/staff-notes/ChatArea';
import { Channel, User } from '@/components/staff-notes/types';
import { useChannels } from '@/hooks/useChannels';
import { useMessages } from '@/hooks/useMessages';
import { useChannelMembers } from '@/hooks/useChannelMembers';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useDirectMessageMessages } from '@/hooks/useDirectMessageMessages';

const Messenger = () => {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateMessage, setShowCreateMessage] = useState(false);
  const { pinUser, user } = useAuth();

  const { channels, loading, fetchChannels } = useChannels();
  const { messages: channelMessages, sendMessage } = useMessages(selectedChannel?.id || null);
  const { channelMembers, availableUsers, refetchChannelMembers } = useChannelMembers(selectedChannel?.id || null);

  // Get the current user info from PIN user (since we're only using the users table)
  const getCurrentUserInfo = () => {
    if (pinUser) {
      return {
        id: pinUser.user_id, // Use user_id instead of id
        full_name: pinUser.full_name,
        role: pinUser.role
      };
    }

    if (user) {
      return {
        id: user.id,
        full_name: user.email,
        role: 'admin'
      };
    }
    
    return null;
  };

  const currentUserInfo = getCurrentUserInfo();
  const { directMessageUsers, fetchDirectMessageUsers } = useDirectMessages(currentUserInfo?.id || null);
  const { messages: directMessages, sendDirectMessage } = useDirectMessageMessages(
    currentUserInfo?.id || null, 
    selectedUser?.id || null
  );

  const handleSendMessage = async (content: string) => {
    const userInfo = getCurrentUserInfo();
    
    if (!userInfo || !userInfo.id) {
      console.error('No user information available for sending message');
      return;
    }

    if (selectedChannel) {
      // Send channel message
      await sendMessage(content, selectedChannel.id, userInfo.id);
    } else if (selectedUser) {
      // Send direct message
      const success = await sendDirectMessage(content, userInfo.id, selectedUser.id);
      if (success) {
        // Refresh the direct message users list to show the conversation
        fetchDirectMessageUsers();
      }
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedUser(null); // Clear selected user when selecting a channel
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSelectedChannel(null); // Clear selected channel when selecting a user
  };

  const handleChannelUpdate = () => {
    fetchChannels();
    if (selectedChannel) {
      refetchChannelMembers();
    }
  };

  const handleChannelDelete = () => {
    fetchChannels();
    setSelectedChannel(null); // Clear selected channel if it was deleted
  };

  // Determine which messages to show
  const messagesToShow = selectedChannel ? channelMessages : directMessages;

  return (
    <div className="flex h-screen bg-background">
      <ChannelSidebar
        channels={channels}
        selectedChannel={selectedChannel}
        onChannelSelect={handleChannelSelect}
        onCreateNote={() => setShowCreateMessage(true)}
        loading={loading}
        availableUsers={availableUsers}
        onUserSelect={handleUserSelect}
        directMessageUsers={directMessageUsers}
        currentUserId={currentUserInfo?.id}
        onChannelUpdate={handleChannelUpdate}
      />

      <div className="flex-1 flex flex-col h-screen">
        <ChatArea
          selectedChannel={selectedChannel}
          messages={messagesToShow}
          channelMembers={channelMembers}
          availableUsers={availableUsers}
          currentUser={getCurrentUserInfo()}
          onSendMessage={handleSendMessage}
          selectedUser={selectedUser}
          onChannelUpdate={handleChannelUpdate}
          onChannelDelete={handleChannelDelete}
        />
      </div>

      <CreateMessageModal
        isOpen={showCreateMessage}
        onClose={() => setShowCreateMessage(false)}
        onSuccess={() => {
          setShowCreateMessage(false);
          fetchChannels();
        }}
      />
    </div>
  );
};

export default Messenger;
