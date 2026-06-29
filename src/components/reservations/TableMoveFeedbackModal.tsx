import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ReservationAnalyticsService } from '@/services/reservationAnalyticsService';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface TableMoveFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  oldTableNumbers: number[] | null;
  newTableNumbers: number[];
  companyId: string;
}

const FEEDBACK_OPTIONS = [
  { id: 'customer_preference', label: 'Customer preference' },
  { id: 'table_broken', label: 'Table broken/out of service' },
  { id: 'better_view', label: 'Better view/location' },
  { id: 'accessibility', label: 'Accessibility needs' },
  { id: 'vip_request', label: 'VIP/special request' },
  { id: 'group_dynamic', label: 'Better for group size/dynamic' }
];

export function TableMoveFeedbackModal({
  isOpen,
  onClose,
  reservationId,
  oldTableNumbers,
  newTableNumbers,
  companyId
}: TableMoveFeedbackModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const { currentUser } = useCurrentUser();

  // Auto-save when user clicks outside or after interaction
  useEffect(() => {
    const handleClickOutside = () => {
      if (hasInteracted) {
        saveFeedback();
      }
      onClose();
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen, hasInteracted, selectedReasons, additionalNotes]);

  const handleReasonToggle = (reasonId: string) => {
    setHasInteracted(true);
    setSelectedReasons(prev => 
      prev.includes(reasonId)
        ? prev.filter(id => id !== reasonId)
        : [...prev, reasonId]
    );
  };

  const handleNotesChange = (value: string) => {
    setHasInteracted(true);
    setAdditionalNotes(value);
  };

  const saveFeedback = async () => {
    if (selectedReasons.length === 0 && !additionalNotes.trim()) {
      return; // No feedback to save
    }

    try {
      await ReservationAnalyticsService.logManualTableMove(
        companyId,
        reservationId,
        oldTableNumbers,
        newTableNumbers,
        currentUser?.id || null,
        selectedReasons,
        additionalNotes.trim() || undefined
      );
    } catch (error) {
      console.error('Error saving table move feedback:', error);
    }
  };

  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from bubbling up
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md bg-background border border-border"
        onClick={handleDialogClick}
      >
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Table Move Feedback
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Moved from table(s) {oldTableNumbers?.join(', ') || 'unassigned'} to {newTableNumbers.join(', ')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 opacity-75">
              Quick feedback helps improve future assignments • Click outside to skip
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Why was this table moved?</p>
            <div className="grid grid-cols-1 gap-2">
              {FEEDBACK_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={selectedReasons.includes(option.id)}
                    onCheckedChange={() => handleReasonToggle(option.id)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label
                    htmlFor={option.id}
                    className="text-sm text-foreground cursor-pointer flex-1"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Additional notes (optional)
            </label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Any other details about why this table was better..."
              className="min-h-[60px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {hasInteracted && (
            <div className="text-xs text-muted-foreground text-center opacity-75">
              Feedback will be saved automatically when you close this
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}