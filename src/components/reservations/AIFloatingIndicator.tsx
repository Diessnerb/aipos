import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2 } from 'lucide-react';
import { useRealtimeOptimization } from '@/hooks/useRealtimeOptimization';
import { AIInsightsModal } from './AIInsightsModal';

interface AIFloatingIndicatorProps {
  selectedDate: string;
  onReservationUpdate?: () => void;
}

export const AIFloatingIndicator: React.FC<AIFloatingIndicatorProps> = ({ selectedDate, onReservationUpdate }) => {
  // TEMPORARILY HIDDEN - Remove this line to re-enable
  return null;
  
  const [showModal, setShowModal] = useState(false);
  const [isManualRun, setIsManualRun] = useState(false);
  
  // Use real-time optimization hook for enabling/disabling state
  const { isRunning, isEnabled, triggerOptimization } = useRealtimeOptimization({
    enabled: true,
    onOptimizationComplete: (result) => {
      setIsManualRun(false); // Reset manual run state
      // Only refresh if moves were actually made
      if (result.success && result.movesCount > 0 && onReservationUpdate) {
        onReservationUpdate();
      }
    }
  });

  const handleManualOptimization = () => {
    setIsManualRun(true);
    triggerOptimization();
  };

  // Don't render if AI optimization is not enabled
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating AI Brain Icon */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setShowModal(true)}
          size="lg"
          className="
            relative h-12 w-12 rounded-full shadow-lg border-2 
            bg-primary/90 hover:bg-primary border-primary/20 
            backdrop-blur-sm transition-all duration-300 hover:scale-105
          "
        >
          {isManualRun ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" />
          ) : (
            <Brain className="h-6 w-6 text-primary-foreground" />
          )}
          
          {/* Status indicator dot */}
          <div className={`
            absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background
            ${isManualRun ? 'bg-blue-500' : 'bg-green-500'}
          `} />
        </Button>
      </div>

      {/* AI Insights Modal */}
      <AIInsightsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        selectedDate={selectedDate}
        onOptimizationTrigger={handleManualOptimization}
        isOptimizationRunning={isManualRun}
      />
    </>
  );
};