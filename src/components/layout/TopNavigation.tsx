
import React from 'react';
import { OrderNotificationBell } from '@/components/notifications/OrderNotificationBell';

export const TopNavigation: React.FC = () => {
  return (
    <div className="w-full border-b bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex-1" />
        <div className="flex-1" />
        <div className="flex justify-end pr-1 pt-2">
          <OrderNotificationBell />
        </div>
      </div>
    </div>
  );
};
