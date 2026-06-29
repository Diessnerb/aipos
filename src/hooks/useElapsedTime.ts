import { useState, useEffect } from 'react';

export const useElapsedTime = (createdAt: string): number => {
  const [elapsedMinutes, setElapsedMinutes] = useState(() => {
    const orderTime = new Date(createdAt);
    return Math.floor((Date.now() - orderTime.getTime()) / 60000);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const orderTime = new Date(createdAt);
      setElapsedMinutes(Math.floor((Date.now() - orderTime.getTime()) / 60000));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [createdAt]);

  return elapsedMinutes;
};
