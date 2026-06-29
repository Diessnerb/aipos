
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hash, Lock, Users, Settings } from 'lucide-react';
import { Channel, User } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChannelSettingsModal } from './ChannelSettingsModal';

interface ChatHeaderProps {
  selectedChannel: Channel;
  channelMembers: User[];
  availableUsers: User[];
  showMemberSearch: boolean;
  memberSearchQuery: string;
  onShowMemberSearchChange: (show: boolean) => void;
  onMemberSearchQueryChange: (query: string) => void;
  onChannelUpdate?: () => void;
  onChannelDelete?: () => void;
}

export const ChatHeader = ({
  selectedChannel,
  channelMembers,
  availableUsers,
  showMemberSearch,
  memberSearchQuery,
  onShowMemberSearchChange,
  onMemberSearchQueryChange,
  onChannelUpdate,
  onChannelDelete
}: ChatHeaderProps) => {
  const { toast } = useToast();
  const [showChannelSettings, setShowChannelSettings] = useState(false);

  const handleAddUserToChannel = async (user: User) => {
    try {
      const { error } = await supabase
        .from('channel_memberships')
        .insert([
          {
            channel_id: selectedChannel.id,
            user_id: user.id,
            can_write: selectedChannel.is_read_only ? false : true
          }
        ]);

      if (error) {
        console.error('Error adding user to channel:', error);
        toast({
          title: "Error",
          description: "Failed to add user to channel",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `${user.full_name} has been added to the channel`,
        });
        onShowMemberSearchChange(false);
        onMemberSearchQueryChange('');
        onChannelUpdate?.();
      }
    } catch (error) {
      console.error('Error adding user to channel:', error);
      toast({
        title: "Error",
        description: "Failed to add user to channel",
        variant: "destructive",
      });
    }
  };

  const handleChannelSettings = () => {
    setShowChannelSettings(true);
  };

  return (
    <>
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {selectedChannel.is_read_only ? (
              <Lock className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Hash className="w-5 h-5 text-muted-foreground" />
            )}
            <h1 className="text-xl font-semibold">{selectedChannel.name}</h1>
            {selectedChannel.is_read_only && (
              <Badge variant="secondary">Read Only</Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Popover open={showMemberSearch} onOpenChange={onShowMemberSearchChange}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Add people
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command>
                  <CommandInput 
                    placeholder="Search users..." 
                    value={memberSearchQuery}
                    onValueChange={onMemberSearchQueryChange}
                  />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {availableUsers
                        .filter(user => 
                          !channelMembers.some(member => member.id === user.id) &&
                          user.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase())
                        )
                        .map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => handleAddUserToChannel(user)}
                          >
                            <div className="flex items-center space-x-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs">
                                  {user.full_name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{user.full_name}</p>
                                <p className="text-xs text-muted-foreground">{user.role}</p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={handleChannelSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {selectedChannel.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {selectedChannel.description}
          </p>
        )}
      </div>

      <ChannelSettingsModal
        isOpen={showChannelSettings}
        onClose={() => setShowChannelSettings(false)}
        selectedChannel={selectedChannel}
        channelMembers={channelMembers}
        availableUsers={availableUsers}
        onChannelUpdate={onChannelUpdate}
        onChannelDelete={onChannelDelete}
      />
    </>
  );
};
