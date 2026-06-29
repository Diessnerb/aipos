import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReservationContext {
  date?: string;
  time?: string;
  partySize?: number;
  customerName?: string;
  availableTables?: any[];
  existingReservations?: any[];
}

export const useReservationAI = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getReservationHelp = async (query: string, context: ReservationContext) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reservation-ai', {
        body: { query, context }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Reservation AI error:', error);
      toast({
        title: 'AI Error',
        description: 'Failed to get AI assistance',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestTables = async (context: ReservationContext) => {
    return getReservationHelp('Suggest best tables for this reservation', context);
  };

  const resolveConflict = async (context: ReservationContext) => {
    return getReservationHelp('Help resolve this booking conflict', context);
  };

  const optimizeBooking = async (context: ReservationContext) => {
    return getReservationHelp('Optimize this reservation', context);
  };

  return {
    isProcessing,
    getReservationHelp,
    suggestTables,
    resolveConflict,
    optimizeBooking,
  };
};
