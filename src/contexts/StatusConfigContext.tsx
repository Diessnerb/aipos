import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Reservation } from '@/types/reservation';

interface StatusConfig {
  label: string;
  color: string;
}

type StatusConfigMap = Record<Reservation['status'], StatusConfig>;

interface StatusConfigContextType {
  statusConfig: StatusConfigMap;
  updateStatusConfig: (config: StatusConfigMap) => void;
  resetToDefaults: () => void;
}

const defaultStatusConfig: StatusConfigMap = {
  'confirmed': { label: 'Confirmed', color: 'bg-green-500 text-white border-green-500' },
  'pending': { label: 'Pending', color: 'bg-orange-500 text-white border-orange-500' },
  'cancelled': { label: 'Cancelled', color: 'bg-red-500 text-white border-red-500' },
  'no-show': { label: 'No Show', color: 'bg-red-500 text-white border-red-500' },
  'completed': { label: 'Completed', color: 'bg-green-500 text-white border-green-500' },
  'late': { label: 'Late', color: 'bg-yellow-500 text-white border-yellow-500' },
  'seated': { label: 'Seated', color: 'bg-green-500 text-white border-green-500' },
  'waiting-for-order': { label: 'Waiting for Order', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'waiting-for-starters': { label: 'Waiting for Starters', color: 'bg-green-500 text-white border-green-500' },
  'starters-ready-in-kitchen': { label: 'Starters Ready in Kitchen', color: 'bg-blue-500 text-white border-blue-500' },
  'starters-served': { label: 'Starters Served', color: 'bg-green-500 text-white border-green-500' },
  'requires-check-back-on-starters': { label: 'Requires Check Back on Starters', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'eating-starters': { label: 'Eating Starters', color: 'bg-green-500 text-white border-green-500' },
  'clear-starters': { label: 'Clear Starters', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'waiting-for-mains': { label: 'Waiting for Mains', color: 'bg-green-500 text-white border-green-500' },
  'mains-ready-in-kitchen': { label: 'Mains Ready In Kitchen', color: 'bg-blue-500 text-white border-blue-500' },
  'mains-served': { label: 'Mains Served', color: 'bg-green-500 text-white border-green-500' },
  'requires-check-back-on-mains': { label: 'Requires Check Back on Mains', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'eating-mains': { label: 'Eating Mains', color: 'bg-green-500 text-white border-green-500' },
  'clear-mains': { label: 'Clear Mains', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'waiting-for-desserts': { label: 'Waiting for Desserts', color: 'bg-green-500 text-white border-green-500' },
  'desserts-ready-in-kitchen': { label: 'Desserts Ready in Kitchen', color: 'bg-blue-500 text-white border-blue-500' },
  'desserts-served': { label: 'Desserts Served', color: 'bg-green-500 text-white border-green-500' },
  'requires-check-back-on-desserts': { label: 'Requires Check Back on Desserts', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'eating-dessert': { label: 'Eating Dessert', color: 'bg-green-500 text-white border-green-500' },
  'clear-desserts': { label: 'Clear Desserts', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'table-cleared': { label: 'Table Cleared', color: 'bg-green-500 text-white border-green-500' },
  'bill-requested-waiting-to-pay': { label: 'Bill Requested/Waiting to Pay', color: 'bg-fuchsia-500 text-white border-fuchsia-500' },
  'table-complete': { label: 'Table Complete', color: 'bg-green-500 text-white border-green-500' },
};

const STORAGE_KEY = 'reservation-status-config';

const StatusConfigContext = createContext<StatusConfigContextType | undefined>(undefined);

interface StatusConfigProviderProps {
  children: ReactNode;
}

export const StatusConfigProvider: React.FC<StatusConfigProviderProps> = ({ children }) => {
  const [statusConfig, setStatusConfig] = useState<StatusConfigMap>(defaultStatusConfig);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setStatusConfig({ ...defaultStatusConfig, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load status config:', error);
    }
  }, []);

  const updateStatusConfig = (config: StatusConfigMap) => {
    setStatusConfig(config);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save status config:', error);
    }
  };

  const resetToDefaults = () => {
    setStatusConfig(defaultStatusConfig);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset status config:', error);
    }
  };

  return (
    <StatusConfigContext.Provider value={{ statusConfig, updateStatusConfig, resetToDefaults }}>
      {children}
    </StatusConfigContext.Provider>
  );
};

export const useStatusConfig = () => {
  const context = useContext(StatusConfigContext);
  if (!context) {
    throw new Error('useStatusConfig must be used within a StatusConfigProvider');
  }
  return context;
};