import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Global cleanup utility to ensure UI remains interactive
 * Removes stale inert attributes and fixes pointer-events on portals
 */
export const cleanupInteractivityBlocks = () => {
  // Remove all inert attributes
  document.querySelectorAll('[inert]').forEach(el => {
    el.removeAttribute('inert');
  });

  // Ensure body and root can receive clicks
  if (document.body) {
    document.body.style.pointerEvents = 'auto';
  }
  const root = document.getElementById('root');
  if (root) {
    root.style.pointerEvents = 'auto';
  }

  // Fix closed portal overlays that might still block clicks
  document.querySelectorAll('[data-radix-portal] [data-state="closed"]').forEach(el => {
    if (el instanceof HTMLElement) {
      el.style.pointerEvents = 'none';
    }
  });
};

/**
 * Component that monitors route changes and ensures UI interactivity
 * Mount once at app root level
 */
export const PageInteractivityGuard = () => {
  const location = useLocation();

  useEffect(() => {
    // Cleanup on every route change
    cleanupInteractivityBlocks();
  }, [location.pathname]);

  useEffect(() => {
    // Cleanup on mount
    cleanupInteractivityBlocks();

    // Periodic cleanup as safety net (every 2 seconds)
    const intervalId = setInterval(cleanupInteractivityBlocks, 2000);

    return () => clearInterval(intervalId);
  }, []);

  return null;
};
