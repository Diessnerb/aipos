import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';

interface CacheUpdate {
  timestamp: number;
  action: string;
  cacheKey: string;
  dataCount: number;
  source: string;
}

export const ReservationCacheMonitor: React.FC<{ selectedDate: string }> = ({ selectedDate }) => {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const deviceLive = useDeviceLiveLayer();
  const [updates, setUpdates] = useState<CacheUpdate[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Monitor cache changes
  useEffect(() => {
    if (!companyId) return;

    const cacheKey = ['reservations-date', companyId, selectedDate];
    
    // Set up cache observer
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated') {
        const query = event.query;
        if (query.queryKey.toString() === cacheKey.toString()) {
          const data = query.state.data as any;
          const reservationCount = data?.reservations?.length || (Array.isArray(data) ? data.length : 0);
          
          setUpdates(prev => {
            const newUpdate: CacheUpdate = {
              timestamp: Date.now(),
              action: 'CACHE_UPDATE',
              cacheKey: query.queryKey.join('->'),
              dataCount: reservationCount,
              source: deviceLive ? 'DeviceManager' : 'QueryHook'
            };
            
            return [newUpdate, ...prev.slice(0, 9)]; // Keep last 10 updates
          });
        }
      }
    });

    return unsubscribe;
  }, [queryClient, companyId, selectedDate, deviceLive]);

  // Auto-hide after no updates for 5 seconds
  useEffect(() => {
    if (updates.length > 0) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [updates]);

  if (!isVisible || updates.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-background border rounded-lg shadow-lg p-3 max-w-sm z-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Cache Monitor</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="text-muted-foreground">
          Date: {selectedDate} | Source: {deviceLive ? 'Device' : 'Hook'}
        </div>
        
        {updates.slice(0, 5).map((update, index) => (
          <div key={update.timestamp} className={`p-1 rounded ${index === 0 ? 'bg-primary/10' : 'bg-muted/50'}`}>
            <div className="flex justify-between items-center">
              <span className="font-mono">{update.dataCount} reservations</span>
              <span className="text-muted-foreground">
                {new Date(update.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-muted-foreground">{update.source}</div>
          </div>
        ))}
      </div>
    </div>
  );
};