import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { calculateAutoScale, getScaleFromPreference, applyScaleToDocument } from '@/utils/displayScaleCalculator';

export type ScalePreference = 'auto' | 'small' | 'medium' | 'large';

interface DisplayScaleContextType {
  scale: number;
  preference: ScalePreference;
  setPreference: (pref: ScalePreference) => void;
}

export const DisplayScaleContext = createContext<DisplayScaleContextType | undefined>(undefined);

const STORAGE_KEY = 'display-scale-preference';

export function DisplayScaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ScalePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as ScalePreference) || 'auto';
  });

  const [scale, setScale] = useState<number>(() => {
    return getScaleFromPreference(preference, window.innerWidth);
  });

  // Update scale when preference or screen size changes
  useEffect(() => {
    const updateScale = () => {
      const newScale = getScaleFromPreference(preference, window.innerWidth);
      setScale(newScale);
      applyScaleToDocument(newScale);
      
      // Dispatch event for other components to react
      window.dispatchEvent(new CustomEvent('display-scale-changed', { detail: { scale: newScale } }));
    };

    updateScale();

    // Listen for resize events
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);

    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, [preference]);

  const setPreference = (pref: ScalePreference) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
  };

  return (
    <DisplayScaleContext.Provider value={{ scale, preference, setPreference }}>
      {children}
    </DisplayScaleContext.Provider>
  );
}

export function useDisplayScale() {
  const context = useContext(DisplayScaleContext);
  if (context === undefined) {
    throw new Error('useDisplayScale must be used within a DisplayScaleProvider');
  }
  return context;
}
