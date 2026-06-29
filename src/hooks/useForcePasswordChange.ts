import { useState, useEffect } from 'react';

export const useForcePasswordChange = () => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const requiresChange = sessionStorage.getItem('requiresPasswordChange');
    if (requiresChange === 'true') {
      setShowModal(true);
    }
  }, []);

  const handlePasswordChanged = () => {
    sessionStorage.removeItem('requiresPasswordChange');
    setShowModal(false);
  };

  return { showModal, handlePasswordChanged };
};
