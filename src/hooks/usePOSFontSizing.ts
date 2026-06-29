import { useState, useEffect } from 'react';
import { calculatePOSFontSizes, getPOSFontSizeStyles, POSFontSizes } from '@/utils/posFontSizeCalculator';
import { calculatePOSCardHeight, getPOSCardHeightStyles, POSCardDimensions } from '@/utils/posCardHeightCalculator';

export function usePOSFontSizing() {
  const [fontSizes, setFontSizes] = useState<POSFontSizes>(() => calculatePOSFontSizes());
  const [fontStyles, setFontStyles] = useState(() => getPOSFontSizeStyles(fontSizes));
  const [cardDimensions, setCardDimensions] = useState<POSCardDimensions>(() => calculatePOSCardHeight());
  const [cardStyles, setCardStyles] = useState(() => getPOSCardHeightStyles(cardDimensions));

  useEffect(() => {
    // Recalculate on mount
    const sizes = calculatePOSFontSizes();
    const dimensions = calculatePOSCardHeight();
    
    setFontSizes(sizes);
    setFontStyles(getPOSFontSizeStyles(sizes));
    setCardDimensions(dimensions);
    setCardStyles(getPOSCardHeightStyles(dimensions));

    // Listen for device dimension updates (orientation change)
    const handleDimensionsUpdate = () => {
      console.log('📐 POS: Device dimensions updated, recalculating sizes');
      const newSizes = calculatePOSFontSizes();
      const newDimensions = calculatePOSCardHeight();
      
      setFontSizes(newSizes);
      setFontStyles(getPOSFontSizeStyles(newSizes));
      setCardDimensions(newDimensions);
      setCardStyles(getPOSCardHeightStyles(newDimensions));
    };

    window.addEventListener('device-dimensions-updated', handleDimensionsUpdate);
    window.addEventListener('resize', handleDimensionsUpdate);

    return () => {
      window.removeEventListener('device-dimensions-updated', handleDimensionsUpdate);
      window.removeEventListener('resize', handleDimensionsUpdate);
    };
  }, []);

  return { fontSizes, fontStyles, cardDimensions, cardStyles };
}
