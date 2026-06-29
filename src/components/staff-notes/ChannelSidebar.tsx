
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Hash, Lock, Edit } from 'lucide-react';
import { Channel, User } from './types';
import { StartDirectMessageModal } from './StartDirectMessageModal';
import { CreateChannelModal } from '@/components/modals/CreateChannelModal';

interface ChannelSidebarProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
  onCreateNote: () => void;
  loading: boolean;
  availableUsers: User[];
  onUserSelect: (user: User) => void;
  directMessageUsers: User[];
  currentUserId?: string;
  onChannelUpdate?: () => void;
}

export const ChannelSidebar = ({
  channels,
  selectedChannel,
  onChannelSelect,
  onCreateNote,
  loading,
  availableUsers,
  onUserSelect,
  directMessageUsers,
  currentUserId,
  onChannelUpdate
}: ChannelSidebarProps) => {
  const [showStartDMModal, setShowStartDMModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);

  const handleStartDirectMessage = (user: User) => {
    onUserSelect(user);
  };

  const handleCreateChannel = () => {
    setShowCreateChannelModal(true);
  };

  const handleChannelCreated = () => {
    setShowCreateChannelModal(false);
    if (onChannelUpdate) {
      onChannelUpdate();
    }
  };

  return (
    <div className="w-80 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Channels</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateChannel}
            className="h-8 w-8 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Channels Section */}
        <div className="p-2 space-y-1">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onChannelSelect(channel)}
              className={`w-full text-left p-3 rounded-lg transition-colors hover:bg-accent ${
                selectedChannel?.id === channel.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center space-x-2">
                {channel.is_read_only ? (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Hash className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="font-medium">{channel.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Direct Messages Section */}
        <div className="border-t pt-4">
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-muted-foreground">Direct messages</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowStartDMModal(true)}
              >
                <Edit className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div className="px-2 space-y-1">
            {directMessageUsers.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No direct message conversations yet.
                <br />
                Click the notepad icon to start one.
              </div>
            ) : (
              directMessageUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onUserSelect(user)}
                  className="w-full text-left p-2 rounded-lg transition-colors hover:bg-accent flex items-center space-x-2"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-sm truncate">{user.full_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    {user.role}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <StartDirectMessageModal
        isOpen={showStartDMModal}
        onClose={() => setShowStartDMModal(false)}
        availableUsers={availableUsers}
        onUserSelect={handleStartDirectMessage}
        currentUserId={currentUserId}
      />

      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onSuccess={handleChannelCreated}
        availableUsers={availableUsers}
      />
    </div>
  );
};
