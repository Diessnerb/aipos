
import React from 'react';
import { Hash } from 'lucide-react';

export const EmptyChannelView = () => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Hash className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select a channel</h2>
        <p className="text-muted-foreground">
          Choose a channel from the sidebar to start viewing messages
        </p>
      </div>
    </div>
  );
};
