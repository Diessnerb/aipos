import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Reservation } from '@/types/reservation';
import { getCourseDuration } from '@/utils/courseDurationHelpers';

export const useCourseTimerMonitor = (reservations: Reservation[]) => {
  const queryClient = useQueryClient();
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // Clear existing timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();

    if (!reservations || reservations.length === 0) return;

    const now = new Date();

    reservations.forEach(reservation => {
      // Check starters
      if (
        reservation.status === 'starters-served' &&
        reservation.starters_served_at
      ) {
        const servedAt = new Date(reservation.starters_served_at);
        const delayMs = 3 * 60 * 1000; // 3 minutes
        const targetTime = servedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Timer expired for ${reservation.customer_name} - starters`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-starters`, timer);
        }
      }

      // Check mains
      if (
        reservation.status === 'mains-served' &&
        reservation.mains_served_at
      ) {
        const servedAt = new Date(reservation.mains_served_at);
        const delayMs = 5 * 60 * 1000; // 5 minutes
        const targetTime = servedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Timer expired for ${reservation.customer_name} - mains`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-mains`, timer);
        }
      }

      // Check desserts
      if (
        reservation.status === 'desserts-served' &&
        reservation.desserts_served_at
      ) {
        const servedAt = new Date(reservation.desserts_served_at);
        const delayMs = 3 * 60 * 1000; // 3 minutes
        const targetTime = servedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Timer expired for ${reservation.customer_name} - desserts`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-desserts`, timer);
        }
      }

      // Check seated timer (3 minutes to waiting-for-order)
      if (
        reservation.status === 'seated' &&
        reservation.seated_at
      ) {
        const seatedAt = new Date(reservation.seated_at);
        const delayMs = 3 * 60 * 1000; // 3 minutes
        const targetTime = seatedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Timer expired for ${reservation.customer_name} - seated (waiting for order)`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-seated`, timer);
        }
      }

      // Duration timer for starters (auto-clear after eating time)
      if (
        (reservation.status === 'starters-served' || 
         reservation.status === 'requires-check-back-on-starters' ||
         reservation.status === 'eating-starters') &&
        reservation.starters_served_at
      ) {
        const servedAt = new Date(reservation.starters_served_at);
        const durationMinutes = getCourseDuration('starters', reservation.party_size);
        const delayMs = durationMinutes * 60 * 1000;
        const targetTime = servedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Duration timer expired for ${reservation.customer_name} - starters (${durationMinutes} min for ${reservation.party_size} guests)`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-starters-duration`, timer);
        }
      }

      // Duration timer for mains (auto-clear after eating time)
      if (
        (reservation.status === 'mains-served' || 
         reservation.status === 'requires-check-back-on-mains' ||
         reservation.status === 'eating-mains') &&
        reservation.mains_served_at
      ) {
        const servedAt = new Date(reservation.mains_served_at);
        const durationMinutes = getCourseDuration('mains', reservation.party_size);
        const delayMs = durationMinutes * 60 * 1000;
        const targetTime = servedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Duration timer expired for ${reservation.customer_name} - mains (${durationMinutes} min for ${reservation.party_size} guests)`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-mains-duration`, timer);
        }
      }

      // Duration timer for desserts (auto-clear after eating time)
      if (
        (reservation.status === 'desserts-served' || 
         reservation.status === 'requires-check-back-on-desserts' ||
         reservation.status === 'eating-dessert') &&
        reservation.desserts_served_at
      ) {
        const servedAt = new Date(reservation.desserts_served_at);
        const durationMinutes = getCourseDuration('desserts', reservation.party_size);
        const delayMs = durationMinutes * 60 * 1000;
        const targetTime = servedAt.getTime() + delayMs;
        const remainingMs = targetTime - now.getTime();

        if (remainingMs > 0) {
          const timer = setTimeout(() => {
            console.log(`Duration timer expired for ${reservation.customer_name} - desserts (${durationMinutes} min for ${reservation.party_size} guests)`);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }, remainingMs);
          
          timersRef.current.set(`${reservation.id}-desserts-duration`, timer);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [reservations, queryClient]);
};
