
import React, { useState } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { EmptyChannelView } from './EmptyChannelView';
import { Channel, Message, User } from './types';

interface ChatAreaProps {
  selectedChannel: Channel | null;
  messages: Message[];
  channelMembers: User[];
  availableUsers: User[];
  currentUser: { id: string; full_name: string; role: string } | null;
  onSendMessage: (content: string) => void;
  selectedUser?: User | null;
  onChannelUpdate?: () => void;
  onChannelDelete?: () => void;
}

export const ChatArea = ({
  selectedChannel,
  messages,
  channelMembers,
  availableUsers,
  currentUser,
  onSendMessage,
  selectedUser,
  onChannelUpdate,
  onChannelDelete
}: ChatAreaProps) => {
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  if (!selectedChannel && !selectedUser) {
    return <EmptyChannelView />;
  }

  return (
    <div className="flex flex-col h-full">
      {selectedChannel && (
        <ChatHeader
          selectedChannel={selectedChannel}
          channelMembers={channelMembers}
          availableUsers={availableUsers}
          showMemberSearch={showMemberSearch}
          memberSearchQuery={memberSearchQuery}
          onShowMemberSearchChange={setShowMemberSearch}
          onMemberSearchQueryChange={setMemberSearchQuery}
          onChannelUpdate={onChannelUpdate}
          onChannelDelete={onChannelDelete}
        />
      )}
      
      {selectedUser && (
        <div className="p-4 border-b bg-card">
          <h1 className="text-xl font-semibold">
            Chat With {selectedUser.full_name}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{selectedUser.role}</p>
        </div>
      )}

      <MessageList messages={messages} currentUser={currentUser} />
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
};
