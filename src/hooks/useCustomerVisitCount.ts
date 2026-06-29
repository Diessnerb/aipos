import { useEffect, useState } from 'react';
import { useInstantData } from './useInstantData';
import { useCompanyId } from './useCompanyId';
import { normalizeUKPhone } from '@/utils/phoneUtils';
import { Reservation } from '@/types/reservation';

/**
 * Custom hook to calculate completed visit count for a customer.
 * Leverages useInstantData which reads from React Query cache that's
 * already being updated by DeviceDataManager.
 * 
 * Benefits:
 * - Works offline (reads from persisted cache)
 * - Works with bound devices (cache is updated by DeviceDataManager)
 * - No duplicate subscriptions (relies on existing DeviceDataManager subscription)
 * - Real-time updates (cache is continuously updated)
 */
export const useCustomerVisitCount = (customerPhone: string | null) => {
  const { companyId } = useCompanyId();
  const { getInstantReservations } = useInstantData();
  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    if (!customerPhone || !companyId) {
      setVisitCount(0);
      return;
    }

    const calculateVisitCount = () => {
      const { data: reservations } = getInstantReservations();
      
      if (!reservations || !Array.isArray(reservations)) {
        setVisitCount(0);
        return;
      }

      // Generate phone variants to match all formats
      const normalized = normalizeUKPhone(customerPhone);
      const phoneVariants = [
        customerPhone,
        normalized,
        normalized.replace(/^0/, '44'),
        '+' + normalized.replace(/^0/, '44')
      ].filter((p, index, self) => p && p.length >= 10 && self.indexOf(p) === index);

      // Count completed reservations for this customer
      const completedVisits = (reservations as Reservation[]).filter(
        r => r.status === 'completed' && 
             r.company_id === companyId &&
             phoneVariants.includes(r.phone)
      );

      console.log(`[useCustomerVisitCount] Customer ${customerPhone}: ${completedVisits.length} completed visits`);
      setVisitCount(completedVisits.length);
    };

    // Calculate immediately
    calculateVisitCount();

    // Recalculate periodically (cache is already being updated by DeviceDataManager)
    // This just reads the latest value from the in-memory cache
    const interval = setInterval(calculateVisitCount, 1000);

    return () => clearInterval(interval);
  }, [customerPhone, companyId, getInstantReservations]);

  return visitCount;
};
