import { supabase } from '@/integrations/supabase/client';

export interface CourseEditPermissions {
  canEditStarters: boolean;
  canEditMains: boolean;
  canEditDesserts: boolean;
  nextAvailableCourse: 'starter' | 'main' | 'dessert' | null;
  reservationStatus: string | null;
}

export const useOrderEditValidation = () => {
  const getEditPermissions = async (orderId: string): Promise<CourseEditPermissions> => {
    // Fetch order with reservation data
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        reservation_id,
        reservation:reservations (
          id,
          status,
          starters_served_at,
          mains_served_at,
          desserts_served_at
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order?.reservation) {
      // No reservation = no restrictions (takeaway orders)
      return {
        canEditStarters: true,
        canEditMains: true,
        canEditDesserts: true,
        nextAvailableCourse: null,
        reservationStatus: null
      };
    }

    const res = order.reservation;
    
    // Determine which courses are locked (already served)
    const canEditStarters = !res.starters_served_at;
    const canEditMains = !res.mains_served_at;
    const canEditDesserts = !res.desserts_served_at;

    // Determine next available course based on status
    let nextAvailableCourse: 'starter' | 'main' | 'dessert' | null = null;
    
    if (res.status?.includes('waiting-for-starters') || res.status === 'seated') {
      nextAvailableCourse = 'starter';
    } else if (res.status?.includes('waiting-for-mains') || res.status?.includes('eating-starters')) {
      nextAvailableCourse = 'main';
    } else if (res.status?.includes('waiting-for-desserts') || res.status?.includes('eating-mains')) {
      nextAvailableCourse = 'dessert';
    }

    return {
      canEditStarters,
      canEditMains,
      canEditDesserts,
      nextAvailableCourse,
      reservationStatus: res.status
    };
  };

  return { getEditPermissions };
};
