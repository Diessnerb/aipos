
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Message } from './types';

interface MessageListProps {
  messages: Message[];
  currentUser: { id: string; full_name: string; role: string } | null;
}

export const MessageList = ({ messages, currentUser }: MessageListProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback>
                {message.users.full_name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-medium text-sm">{message.users.full_name}</span>
                <Badge variant="outline" className="text-xs">
                  {message.users.role}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
