
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User } from './types';

interface StartDirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableUsers: User[];
  onUserSelect: (user: User) => void;
  currentUserId?: string;
}

export const StartDirectMessageModal = ({
  isOpen,
  onClose,
  availableUsers,
  onUserSelect,
  currentUserId
}: StartDirectMessageModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleUserSelect = (user: User) => {
    onUserSelect(user);
    onClose();
    setSearchQuery('');
  };

  // Filter out current user and filter by search query
  const filteredUsers = availableUsers.filter(user => 
    user.id !== currentUserId &&
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-80 p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Start a direct message</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput 
            placeholder="Search users by name..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => handleUserSelect(user)}
                  className="flex items-center space-x-2 p-2"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">
                      {user.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
