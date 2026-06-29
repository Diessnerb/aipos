import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKitchenReadyNotifications } from '@/hooks/useKitchenReadyNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { KitchenMessageReadModal } from './KitchenMessageReadModal';

export const KitchenReadyNotificationsBar = () => {
  const { notifications } = useKitchenReadyNotifications();
  const queryClient = useQueryClient();
  const [messageModal, setMessageModal] = useState<{ isOpen: boolean; message: string; requestId: string }>({
    isOpen: false,
    message: '',
    requestId: '',
  });
  
  const hasActiveService = notifications.some(n => n.type === 'service');

  const getTimeElapsed = (readyAt: string) => {
    const now = new Date();
    const ready = new Date(readyAt);
    const minutes = Math.floor((now.getTime() - ready.getTime()) / 60000);
    return minutes;
  };

  const getColorClass = (readyAt: string) => {
    const minutes = getTimeElapsed(readyAt);
    if (minutes < 5) return 'bg-green-500 hover:bg-green-600 text-white border-green-600';
    if (minutes < 10) return 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600';
    return 'bg-red-500 hover:bg-red-600 text-white border-red-600';
  };

  const handleDismissService = async () => {
    const serviceRequest = notifications.find(n => n.type === 'service');
    if (!serviceRequest) return;
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('kitchen_service_requests')
        .update({ 
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
          dismissed_by: user?.user?.id
        })
        .eq('id', serviceRequest.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['kitchen-service-requests'] });
      toast.success('Service request cleared');
    } catch (error: any) {
      console.error('[POS] Failed to dismiss service request:', error);
      toast.error('Failed to clear service request');
    }
  };

  const handleDismissMessage = async (notification: typeof notifications[0]) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('kitchen_service_requests')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
          dismissed_by: user?.user?.id,
        })
        .eq('id', notification.id);
        
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['kitchen-service-requests'] });
      toast.success('Message dismissed');
    } catch (error: any) {
      console.error('[POS] Failed to dismiss message:', error);
      toast.error('Failed to dismiss message');
    }
  };

  const openMessageModal = (notification: typeof notifications[0]) => {
    if (notification.type !== 'message') return;
    setMessageModal({
      isOpen: true,
      message: notification.message || '',
      requestId: notification.id,
    });
  };

  const handleDismiss = async (notification: typeof notifications[0]) => {
    const traceId = `${Date.now()}-${notification.id.slice(0, 8)}`;
    
    console.log(`[KITCHEN-X][${traceId}] Click received:`, {
      type: notification.type,
      id: notification.id,
      orderId: notification.orderId,
      displayName: notification.displayName,
      ...(notification.type === 'course' && { courseType: notification.courseType }),
    });

    try {
      if (notification.type === 'order') {
        // Pre-check: Log current state
        console.log(`[KITCHEN-X][${traceId}] Querying before-state for order...`);
        const { data: beforeState, error: beforeError } = await supabase
          .from('orders')
          .select('id, kitchen_status, company_id')
          .eq('id', notification.orderId)
          .single();
        
        if (beforeError) {
          console.error(`[KITCHEN-X][${traceId}] Before-state query failed:`, beforeError);
        } else {
          console.log(`[KITCHEN-X][${traceId}] Before-state:`, beforeState);
        }

        // Perform update with explicit error checking
        console.log(`[KITCHEN-X][${traceId}] Updating order kitchen_status to 'served'...`);
        const { data: updated, error } = await supabase
          .from('orders')
          .update({ kitchen_status: 'served' })
          .eq('id', notification.orderId)
          .select('id, kitchen_status')
          .single();

        if (error) {
          console.error(`[KITCHEN-X][${traceId}] Update failed:`, {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          
          const errorMsg = error.code === '42501' 
            ? 'Permission denied (RLS policy)' 
            : error.message;
          toast.error(`Dismiss failed [${traceId}]: ${errorMsg}`);
          return;
        }

        console.log(`[KITCHEN-X][${traceId}] Update succeeded:`, updated);

        // Post-check: Verify the change
        const { data: afterState } = await supabase
          .from('orders')
          .select('id, kitchen_status, company_id')
          .eq('id', notification.orderId)
          .single();
        
        console.log(`[KITCHEN-X][${traceId}] After-state:`, afterState);

        if (afterState && afterState.kitchen_status !== 'served') {
          console.warn(`[KITCHEN-X][${traceId}] WARNING: Status unchanged after update!`, afterState);
          toast.error(`Update succeeded but status unchanged [${traceId}]`);
        }

      } else {
        // Pre-check: Log current state
        console.log(`[KITCHEN-X][${traceId}] Querying before-state for reservation...`);
        const { data: beforeState, error: beforeError } = await supabase
          .from('reservations')
          .select('id, status, company_id')
          .eq('id', notification.orderId)
          .single();
        
        if (beforeError) {
          console.error(`[KITCHEN-X][${traceId}] Before-state query failed:`, beforeError);
        } else {
          console.log(`[KITCHEN-X][${traceId}] Before-state:`, beforeState);
        }

        const nextStatusMap = {
          'starters-ready-in-kitchen': 'starters-served',
          'mains-ready-in-kitchen': 'mains-served',
          'desserts-ready-in-kitchen': 'desserts-served',
        };
        
        const { data: reservation, error: selectError } = await supabase
          .from('reservations')
          .select('status')
          .eq('id', notification.orderId)
          .single();
        
        if (selectError || !reservation) {
          console.error(`[KITCHEN-X][${traceId}] Failed to fetch reservation:`, selectError);
          toast.error(`Failed to fetch reservation [${traceId}]`);
          return;
        }

        const nextStatus = nextStatusMap[reservation.status as keyof typeof nextStatusMap];
        
        if (!nextStatus) {
          console.warn(`[KITCHEN-X][${traceId}] No status transition for:`, reservation.status);
          toast.error(`No status transition defined for ${reservation.status} [${traceId}]`);
          return;
        }

        console.log(`[KITCHEN-X][${traceId}] Updating reservation status to '${nextStatus}'...`);
        
        // Set timestamp for the course being served
        const updateData: any = { status: nextStatus };
        const now = new Date().toISOString();
        
        if (nextStatus === 'starters-served') {
          updateData.starters_served_at = now;
        } else if (nextStatus === 'mains-served') {
          updateData.mains_served_at = now;
        } else if (nextStatus === 'desserts-served') {
          updateData.desserts_served_at = now;
        }
        
        const { data: updated, error } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('id', notification.orderId)
          .select('id, status')
          .single();

        if (error) {
          console.error(`[KITCHEN-X][${traceId}] Update failed:`, {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          
          const errorMsg = error.code === '42501' 
            ? 'Permission denied (RLS policy)' 
            : error.message;
          toast.error(`Dismiss failed [${traceId}]: ${errorMsg}`);
          return;
        }

        console.log(`[KITCHEN-X][${traceId}] Update succeeded:`, updated);

        // Post-check: Verify the change
        const { data: afterState } = await supabase
          .from('reservations')
          .select('id, status, company_id')
          .eq('id', notification.orderId)
          .single();
        
        console.log(`[KITCHEN-X][${traceId}] After-state:`, afterState);

        if (afterState && afterState.status !== nextStatus) {
          console.warn(`[KITCHEN-X][${traceId}] WARNING: Status unchanged after update!`, afterState);
          toast.error(`Update succeeded but status unchanged [${traceId}]`);
        }
      }

      // Force immediate refetch
      console.log(`[KITCHEN-X][${traceId}] Forcing immediate refetch...`);
      const beforeCount = notifications.length;
      
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['kitchen-ready-orders'] }),
        queryClient.refetchQueries({ queryKey: ['kitchen-ready-courses'] })
      ]);
      
      // Log after a short delay to see the new count
      setTimeout(() => {
        console.log(`[KITCHEN-X][${traceId}] Refetch complete. Before: ${beforeCount}, After: ${notifications.length}`);
      }, 100);
      
      toast.success(`Order marked as served [${traceId}]`);
      
    } catch (error: any) {
      console.error(`[KITCHEN-X][${traceId}] Unexpected error:`, error);
      toast.error(`Failed to update order status [${traceId}]: ${error.message}`);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <>
      <div className="bg-background border-b p-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Bell className={`h-5 w-5 ${hasActiveService ? 'text-red-600 animate-pulse' : 'text-orange-600 animate-pulse'}`} />
            <span 
              className={`font-semibold text-sm ${hasActiveService ? 'cursor-pointer text-red-600 animate-pulse' : ''}`}
              onClick={hasActiveService ? handleDismissService : undefined}
            >
              KITCHEN READY
            </span>
            <Badge variant="destructive" className="rounded-full">
              {notifications.length}
            </Badge>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
            {notifications.map((notification) => (
              <React.Fragment key={notification.id}>
                {notification.type === 'service' && (
                  <Card 
                    className="flex-shrink-0 w-32 h-14 flex flex-col items-center justify-center relative bg-red-500 text-white animate-pulse border-2 border-red-600 cursor-pointer hover:bg-red-600 transition-colors"
                    onClick={handleDismissService}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissService();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Bell className="h-6 w-6 mb-1" />
                    <div className="text-xs font-bold">SERVICE</div>
                  </Card>
                )}
                
                {notification.type === 'message' && (
                  <Card 
                    className="flex-shrink-0 w-32 h-14 flex flex-col items-center justify-center relative bg-blue-500 text-white cursor-pointer hover:bg-blue-600 border-2 border-blue-600 transition-colors"
                    onClick={() => openMessageModal(notification)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissMessage(notification);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <MessageSquare className="h-5 w-5 mb-1" />
                    <div className="text-xs font-bold">Message</div>
                  </Card>
                )}
                
                {(notification.type === 'order' || notification.type === 'course') && (
                  <Card
                    className={`flex-shrink-0 w-32 h-14 flex flex-col items-center justify-center relative border-2 ${getColorClass(notification.readyAt)}`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5 text-white hover:bg-white/20"
                      onClick={() => handleDismiss(notification)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    
                    <div className="text-center px-2">
                      <div className="font-bold text-xs truncate">
                        {notification.displayName}
                      </div>
                      {notification.type === 'course' && notification.courseType && (
                        <div className="text-[10px] font-semibold uppercase mt-0.5">
                          {notification.courseType}s
                        </div>
                      )}
                      <div className="text-[10px] opacity-90 mt-0.5">
                        {getTimeElapsed(notification.readyAt)}min
                      </div>
                    </div>
                  </Card>
                )}
              </React.Fragment>
            ))}
          
            {[...Array(Math.max(0, 6 - notifications.length))].map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex-shrink-0 w-32 h-14 border-2 border-dashed border-muted rounded-md"
              />
            ))}
          </div>
        </div>
      </div>

      <KitchenMessageReadModal
        isOpen={messageModal.isOpen}
        onClose={() => setMessageModal({ isOpen: false, message: '', requestId: '' })}
        message={messageModal.message}
        requestId={messageModal.requestId}
      />
    </>
  );
};
