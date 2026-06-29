import React, { useState, useEffect } from 'react';
import { AIInlineSuggestion } from './AIInlineSuggestion';
import { useInventoryAI } from '@/hooks/useInventoryAI';

interface InventoryAIHelperProps {
  itemName?: string;
  currentStock?: number;
  reorderLevel?: number;
  onSuggestionApply?: (suggestion: any) => void;
}

export const InventoryAIHelper: React.FC<InventoryAIHelperProps> = ({
  itemName,
  currentStock,
  reorderLevel,
  onSuggestionApply,
}) => {
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [showReorderSuggestion, setShowReorderSuggestion] = useState(false);
  const { suggestReorder, findAlternatives, isProcessing } = useInventoryAI();

  // Check for low stock
  useEffect(() => {
    if (currentStock !== undefined && reorderLevel !== undefined) {
      if (currentStock <= reorderLevel) {
        setShowLowStockAlert(true);
      }
      if (currentStock === 0) {
        setShowReorderSuggestion(true);
      }
    }
  }, [currentStock, reorderLevel]);

  const handleReorderSuggestion = async () => {
    const aiResult = await suggestReorder({
      itemName,
      currentStock,
    });
    
    if (aiResult && onSuggestionApply) {
      onSuggestionApply(aiResult);
    }
    setShowReorderSuggestion(false);
  };

  const handleFindAlternatives = async () => {
    if (!itemName) return;
    
    const aiResult = await findAlternatives(itemName);
    
    if (aiResult && onSuggestionApply) {
      onSuggestionApply(aiResult);
    }
  };

  return (
    <div className="space-y-4">
      {/* Low stock alert */}
      {showLowStockAlert && currentStock !== undefined && currentStock > 0 && (
        <AIInlineSuggestion
          message={`${itemName || 'This item'} is running low (${currentStock} remaining). Consider reordering soon to avoid stockouts.`}
          variant="alert"
          onAccept={handleReorderSuggestion}
          onDismiss={() => setShowLowStockAlert(false)}
        />
      )}

      {/* Out of stock with alternatives */}
      {showReorderSuggestion && currentStock === 0 && (
        <AIInlineSuggestion
          message={`${itemName || 'This item'} is out of stock! I can suggest alternative menu items or find similar ingredients from suppliers.`}
          variant="alert"
          onAccept={handleFindAlternatives}
          onDismiss={() => setShowReorderSuggestion(false)}
        />
      )}
    </div>
  );
};
