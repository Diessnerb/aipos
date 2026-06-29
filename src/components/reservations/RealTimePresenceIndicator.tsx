import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Users, Eye } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface UserPresence {
  user_id: string;
  full_name: string;
  last_seen: string;
  viewing_table?: number;
  booking_in_progress?: boolean;
}

interface RealTimePresenceIndicatorProps {
  tableNumber?: number;
  className?: string;
}

/**
 * Real-time presence indicator showing who is currently viewing/booking tables
 * Prevents simultaneous booking attempts and shows "someone else is booking" alerts
 */
export const RealTimePresenceIndicator: React.FC<RealTimePresenceIndicatorProps> = ({
  tableNumber,
  className = ''
}) => {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Join presence channel for this table or global reservations
    const channelName = tableNumber ? `table-${tableNumber}` : 'reservations-global';
    const channel = supabase.channel(channelName);

    // Track presence state
    const presenceState = {
      user_id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown User',
      last_seen: new Date().toISOString(),
      viewing_table: tableNumber,
      booking_in_progress: false
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        
        // Filter out current user and inactive users (older than 2 minutes)
        const activeOthers = Object.entries(newState).flatMap(([key, presences]) => 
          presences.map(p => ({
            user_id: (p as any).user_id,
            full_name: (p as any).full_name,
            last_seen: (p as any).last_seen,
            viewing_table: (p as any).viewing_table,
            booking_in_progress: (p as any).booking_in_progress
          }))
        ).filter(u => {
          const lastSeen = new Date(u.last_seen);
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
          return u.user_id !== user.id && lastSeen > twoMinutesAgo;
        });

        setActiveUsers(activeOthers);
        setIsVisible(activeOthers.length > 0);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('New users joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('Users left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(presenceState);
        }
      });

    // Update presence every 30 seconds
    const presenceInterval = setInterval(() => {
      channel.track({
        ...presenceState,
        last_seen: new Date().toISOString()
      });
    }, 30000);

    return () => {
      clearInterval(presenceInterval);
      channel.unsubscribe();
    };
  }, [user, tableNumber]);

  // Notify when someone is actively booking
  const updateBookingStatus = (inProgress: boolean) => {
    if (!user) return;

    const channelName = tableNumber ? `table-${tableNumber}` : 'reservations-global';
    const channel = supabase.channel(channelName);
    
    channel.track({
      user_id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown User',
      last_seen: new Date().toISOString(),
      viewing_table: tableNumber,
      booking_in_progress: inProgress
    });
  };

  if (!isVisible) return null;

  const bookingUsers = activeUsers.filter(u => u.booking_in_progress);
  const viewingUsers = activeUsers.filter(u => !u.booking_in_progress);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Show booking in progress alert */}
      {bookingUsers.length > 0 && (
        <Badge variant="destructive" className="animate-pulse">
          <Users className="w-3 h-3 mr-1" />
          {bookingUsers[0].full_name} is booking...
        </Badge>
      )}

      {/* Show users currently viewing */}
      {viewingUsers.length > 0 && (
        <Badge variant="secondary">
          <Eye className="w-3 h-3 mr-1" />
          {viewingUsers.length} viewing
          {viewingUsers.length <= 3 && (
            <div className="flex ml-1 -space-x-1">
              {viewingUsers.slice(0, 3).map((user, index) => (
                <Avatar key={user.user_id} className="w-4 h-4 border border-background">
                  <div className="w-full h-full bg-primary/20 flex items-center justify-center text-xs">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                </Avatar>
              ))}
            </div>
          )}
        </Badge>
      )}
    </div>
  );

  // Export the updateBookingStatus function for use in forms
  (window as any).updateBookingStatus = updateBookingStatus;
};

export default RealTimePresenceIndicator;