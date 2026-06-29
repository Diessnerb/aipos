
import React, { useState, memo, useCallback, useMemo } from 'react';
import { formatCustomerName } from '@/utils/nameUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTableDisplay } from '@/components/reservations/timeline/utils/reservationDisplay';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Phone, Mail, Users, CalendarDays, Clock, TriangleAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isSanitizedReservation } from '@/utils/dataSanitizer';
import { Reservation } from '@/types/reservation';

interface ReservationBlockProps {
  reservation: Reservation;
  width: number;
  onDragStart: (reservation: Reservation, e?: React.DragEvent | React.TouchEvent) => void;
  onUpdate: () => void;
  isHovered?: boolean;
  onHoverChange?: (id: string | null) => void;
}

const ReservationBlock = memo(({ 
  reservation, 
  width, 
  onDragStart, 
  onUpdate,
  isHovered,
  onHoverChange
}: ReservationBlockProps) => {
  const { toast } = useToast();
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const isSanitized = useMemo(() => isSanitizedReservation(reservation), [reservation]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500 text-white';
      case 'pending': return 'bg-yellow-500 text-white';
      case 'cancelled': return 'bg-red-500 text-white';
      case 'completed': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete this reservation?')) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservation.id);

      if (error) throw error;
      
      toast({ title: "Reservation deleted" });
      onUpdate();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast({ title: "Error deleting reservation", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }, [reservation.id, toast, onUpdate]);

  const handleMouseEnter = useCallback(() => {
    setShowActions(true);
    if (onHoverChange) onHoverChange(reservation.id);
  }, [onHoverChange, reservation.id]);

  const handleMouseLeave = useCallback(() => {
    setShowActions(false);
    if (onHoverChange) onHoverChange(null);
  }, [onHoverChange]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    onDragStart(reservation, e);
  }, [onDragStart, reservation]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Prevent scrolling and other default behaviors
    e.preventDefault();
    e.stopPropagation();
    onDragStart(reservation, e);
  }, [onDragStart, reservation]);

  return (
    <div
      className={`absolute top-0 left-0 flex flex-col h-full overflow-hidden rounded z-10
        ${getStatusColor(reservation.status)} 
        ${isHovered ? 'z-20 shadow-lg' : ''}`}
      draggable={true}
      onDragStart={handleDragStart}
      onTouchStart={handleTouchStart}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ 
        width: `calc(${width} * 100%)`, 
        transition: 'all 0.2s ease-in-out',
        willChange: 'transform',
        touchAction: 'none'
      }}
    >
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="p-1 h-full cursor-grab flex flex-col justify-center">
            <div className="font-medium truncate text-xs leading-tight">
              {isSanitized ? 'Guest' : formatCustomerName(reservation.customer_name)}
            </div>
            <div className="text-xs opacity-90">{reservation.party_size} guests</div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-80 text-black z-30">
          <div className="space-y-3">
            <div className="font-medium text-lg">
              {isSanitized ? 'Guest' : formatCustomerName(reservation.customer_name)}
            </div>
            
            <Badge className="bg-white text-black border font-normal">
              {reservation.status}
            </Badge>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 opacity-70" />
                {reservation.party_size} guests
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 opacity-70" />
                {new Date(reservation.date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 opacity-70" />
                {reservation.time}
              </div>
              {!isSanitized && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 opacity-70" />
                  {reservation.phone || 'N/A'}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 col-span-2">
                <span className="opacity-70">Table:</span>
                {getTableDisplay(reservation)}
              </div>
            </div>
            
            {!isSanitized && reservation.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 opacity-70" />
                {reservation.email}
              </div>
            )}
            
            {!isSanitized && reservation.notes && (
              <div className="text-sm">
                <div className="font-medium mb-1">Notes</div>
                <div className="text-gray-600">{reservation.notes}</div>
              </div>
            )}

            {!isSanitized && reservation.has_allergens && reservation.allergens && reservation.allergens.length > 0 && (
              <div className="text-sm">
                <div className="flex items-center gap-1 font-medium mb-1 text-amber-600">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Allergies
                </div>
                <div className="text-amber-700 font-medium">
                  {reservation.allergens.join(', ')}
                </div>
              </div>
            )}

            {!isSanitized && (
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      {!isSanitized && (showActions || isHovered) && width > 1 && (
        <div className="absolute top-0 right-0 p-0.5 bg-opacity-75 rounded-bl z-20">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-4 w-4 bg-black bg-opacity-25 hover:bg-opacity-50 rounded-full"
            onClick={handleDelete}
          >
            <Trash2 className="h-2 w-2 text-white" />
          </Button>
        </div>
      )}
    </div>
  );
});

ReservationBlock.displayName = 'ReservationBlock';

export { ReservationBlock };
