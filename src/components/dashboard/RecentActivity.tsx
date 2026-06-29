
import React, { useState, useEffect } from 'react';
import { formatCustomerName } from '@/utils/nameUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'reservation' | 'messenger_note';
  title: string;
  timestamp: string;
  color: string;
}

const RecentActivity = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivities = async () => {
    try {
      const activities: ActivityItem[] = [];

      // Fetch recent reservations using created_at column
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, customer_name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(8);

      if (reservations) {
        reservations.forEach(reservation => {
          let activityType = 'New reservation';
          let color = 'bg-blue-500';
          
          // Determine activity type based on status and recent changes
          if (reservation.status === 'cancelled') {
            activityType = 'Reservation cancelled';
            color = 'bg-red-500';
          } else if (reservation.status === 'confirmed') {
            activityType = 'Reservation confirmed';
            color = 'bg-green-500';
          } else if (reservation.status === 'pending') {
            activityType = 'New reservation';
            color = 'bg-blue-500';
          }

          activities.push({
            id: `reservation-${reservation.id}`,
            type: 'reservation',
            title: `${activityType} - ${formatCustomerName(reservation.customer_name)}`,
            timestamp: reservation.created_at || new Date().toISOString(),
            color
          });
        });
      }

      // Fetch recent messenger notes
      const { data: messengerNotes } = await supabase
        .from('messenger_notes')
        .select('id, title, timestamp')
        .order('timestamp', { ascending: false })
        .limit(4);

      if (messengerNotes) {
        messengerNotes.forEach(note => {
          activities.push({
            id: `note-${note.id}`,
            type: 'messenger_note',
            title: `Note: ${note.title}`,
            timestamp: note.timestamp || new Date().toISOString(),
            color: 'bg-yellow-500'
          });
        });
      }

      // Sort all activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Take only the most recent 8 activities
      setActivities(activities.slice(0, 8));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();

    // Set up real-time subscriptions for reservations
    const reservationsChannel = supabase
      .channel('reservations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          console.log('Reservations table changed, refreshing activities...');
          fetchRecentActivities();
        }
      )
      .subscribe();

    const messengerNotesChannel = supabase
      .channel('messenger_notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messenger_notes'
        },
        () => {
          console.log('Messenger notes table changed, refreshing activities...');
          fetchRecentActivities();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(messengerNotesChannel);
    };
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest reservation and system updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4 animate-pulse">
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                <div className="flex-1 h-4 bg-gray-300 rounded"></div>
                <div className="w-16 h-4 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest reservation and system updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-4">
                <div className={`w-2 h-2 ${activity.color} rounded-full flex-shrink-0`}></div>
                <p className="text-sm flex-1 truncate">{activity.title}</p>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
