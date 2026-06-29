import React, { useState, useEffect } from 'react';
import { AIInlineSuggestion } from './AIInlineSuggestion';
import { AIProactiveHelp } from './AIProactiveHelp';
import { useReservationAI } from '@/hooks/useReservationAI';
import { Input } from '@/components/ui/input';

interface ReservationAIHelperProps {
  customerName?: string;
  partySize?: number;
  selectedDate?: string;
  selectedTime?: string;
  onSuggestionApply?: (suggestion: any) => void;
}

export const ReservationAIHelper: React.FC<ReservationAIHelperProps> = ({
  customerName,
  partySize,
  selectedDate,
  selectedTime,
  onSuggestionApply,
}) => {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const { suggestTables, isProcessing } = useReservationAI();

  // Trigger AI suggestion when relevant fields are filled
  useEffect(() => {
    if (partySize && selectedDate && selectedTime && partySize >= 8) {
      setSuggestion(
        `For a party of ${partySize}, I recommend reserving the corner section or combining Tables 5-7 for better group experience.`
      );
      setShowSuggestion(true);
    }
  }, [partySize, selectedDate, selectedTime]);

  const handleApplySuggestion = async () => {
    if (onSuggestionApply) {
      const aiResult = await suggestTables({
        partySize,
        date: selectedDate,
        time: selectedTime,
        customerName,
      });
      
      if (aiResult) {
        onSuggestionApply(aiResult);
      }
    }
    setShowSuggestion(false);
  };

  return (
    <div className="space-y-4">
      {/* Proactive help on customer name field */}
      <AIProactiveHelp
        trigger={
          <Input
            placeholder="Customer name"
            className="w-full"
          />
        }
        helpText="Enter the customer's name and I'll check if they have a preferred table or special requirements from previous visits."
        autoShow={false}
      />

      {/* Inline AI suggestion */}
      {showSuggestion && suggestion && (
        <AIInlineSuggestion
          message={suggestion}
          variant="suggestion"
          onAccept={handleApplySuggestion}
          onDismiss={() => setShowSuggestion(false)}
        />
      )}

      {/* Large party alert */}
      {partySize && partySize >= 12 && (
        <AIInlineSuggestion
          message={`Large party detected! Consider pre-ordering popular dishes or assigning a dedicated server. I can help draft a confirmation message with menu suggestions.`}
          variant="alert"
          onDismiss={() => {}}
        />
      )}
    </div>
  );
};
