import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Users, UserMinus, Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { Channel, User } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChannel: Channel;
  channelMembers: User[];
  availableUsers: User[];
  onChannelUpdate?: () => void;
  onChannelDelete?: () => void;
}

export const ChannelSettingsModal = ({
  isOpen,
  onClose,
  selectedChannel,
  channelMembers,
  availableUsers,
  onChannelUpdate,
  onChannelDelete
}: ChannelSettingsModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(selectedChannel.name);
  const [editedDescription, setEditedDescription] = useState(selectedChannel.description || '');
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setEditedName(selectedChannel.name);
    setEditedDescription(selectedChannel.description || '');
  }, [selectedChannel]);

  const handleSaveChanges = async () => {
    try {
      const { error } = await supabase
        .from('channels')
        .update({
          name: editedName,
          description: editedDescription
        })
        .eq('id', selectedChannel.id);

      if (error) {
        console.error('Error updating channel:', error);
        toast({
          title: "Error",
          description: "Failed to update channel",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Channel updated successfully",
        });
        setIsEditing(false);
        onChannelUpdate?.();
      }
    } catch (error) {
      console.error('Error updating channel:', error);
      toast({
        title: "Error",
        description: "Failed to update channel",
        variant: "destructive",
      });
    }
  };

  const handleDeleteChannel = async () => {
    try {
      // First delete all channel memberships
      await supabase
        .from('channel_memberships')
        .delete()
        .eq('channel_id', selectedChannel.id);

      // Then delete all messages in the channel
      await supabase
        .from('messages')
        .delete()
        .eq('channel_id', selectedChannel.id);

      // Finally delete the channel
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', selectedChannel.id);

      if (error) {
        console.error('Error deleting channel:', error);
        toast({
          title: "Error",
          description: "Failed to delete channel",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Channel deleted successfully",
        });
        onChannelDelete?.();
        onClose();
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: "Error",
        description: "Failed to delete channel",
        variant: "destructive",
      });
    }
  };

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
        setShowAddMember(false);
        setMemberSearchQuery('');
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

  const handleRemoveUserFromChannel = async (user: User) => {
    try {
      const { error } = await supabase
        .from('channel_memberships')
        .delete()
        .eq('channel_id', selectedChannel.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing user from channel:', error);
        toast({
          title: "Error",
          description: "Failed to remove user from channel",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `${user.full_name} has been removed from the channel`,
        });
        onChannelUpdate?.();
      }
    } catch (error) {
      console.error('Error removing user from channel:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from channel",
        variant: "destructive",
      });
    }
  };

  const nonMembers = availableUsers.filter(user => 
    !channelMembers.some(member => member.id === user.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Channel Settings</span>
            {!isEditing && (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Channel Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Channel Information</h3>
              {isEditing && (
                <div className="flex items-center space-x-2">
                  <Button size="sm" onClick={handleSaveChanges}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel Name</label>
              {isEditing ? (
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter channel name"
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-semibold">{selectedChannel.name}</span>
                  {selectedChannel.is_read_only && (
                    <Badge variant="secondary">Read Only</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              {isEditing ? (
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Enter channel description"
                  rows={3}
                />
              ) : (
                <p className="text-muted-foreground">
                  {selectedChannel.description || 'No description provided'}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Channel Members */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Members ({channelMembers.length})
              </h3>
              <Popover open={showAddMember} onOpenChange={setShowAddMember}>
                <PopoverTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command>
                    <CommandInput 
                      placeholder="Search users..." 
                      value={memberSearchQuery}
                      onValueChange={setMemberSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {nonMembers
                          .filter(user => 
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
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {channelMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        {member.full_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveUserFromChannel(member)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Delete Channel */}
          <div className="space-y-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Channel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the channel "{selectedChannel.name}" 
                    and remove all messages and member associations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteChannel} className="bg-destructive hover:bg-destructive/90">
                    Delete Channel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
