
// Custom event system for rota updates
export const ROTA_UPDATED_EVENT = 'rota-updated';

export const emitRotaUpdated = () => {
  const event = new CustomEvent(ROTA_UPDATED_EVENT);
  window.dispatchEvent(event);
};

export const subscribeToRotaUpdates = (callback: () => void) => {
  window.addEventListener(ROTA_UPDATED_EVENT, callback);
  
  return () => {
    window.removeEventListener(ROTA_UPDATED_EVENT, callback);
  };
};
