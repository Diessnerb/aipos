import React, { useState, useEffect } from 'react';
import { Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReservationLockIndicatorProps {
  reservation: {
    locked?: boolean;
    locked_until?: string;
    customer_name: string;
    id: string;
  };
  className?: string;
}

export const ReservationLockIndicator: React.FC<ReservationLockIndicatorProps> = ({
  reservation,
  className
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const updateRemainingTime = () => {
      if (!reservation.locked_until) {
        setRemainingSeconds(null);
        setIsVisible(false);
        return;
      }

      const lockedUntil = new Date(reservation.locked_until);
      const now = new Date();
      const remaining = Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));

      if (remaining > 0) {
        setRemainingSeconds(remaining);
        setIsVisible(true);
      } else {
        setRemainingSeconds(null);
        setIsVisible(false);
      }
    };

    // Initial check
    updateRemainingTime();

    // Set up interval if there's a lock
    if (reservation.locked_until) {
      interval = setInterval(updateRemainingTime, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [reservation.locked_until]);

  // Don't show indicator for permanent locks - handled by reservation block orange icon
  if (reservation.locked) {
    return null;
  }

  // Don't render temporary lock if not visible or no remaining time
  if (!isVisible || remainingSeconds === null) {
    return null;
  }

  // Temporary optimization protection indicator
  return (
    <div className={cn(
      "absolute -top-1 -right-1 z-[100] bg-amber-500 text-white",
      "rounded-full px-1.5 py-0.5 shadow-lg border-2 border-amber-400/30",
      "flex items-center gap-1 text-xs font-bold",
      "animate-pulse",
      className
    )}>
      <Clock className="w-3 h-3" />
      <span>{remainingSeconds}s</span>
    </div>
  );
};