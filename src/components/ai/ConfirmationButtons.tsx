import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface ConfirmationButtonsProps {
  onYes: () => void;
  onCancel: () => void;
  disabled?: boolean;
  yesText?: string;
  cancelText?: string;
}

export const ConfirmationButtons: React.FC<ConfirmationButtonsProps> = ({
  onYes,
  onCancel,
  disabled = false,
  yesText = 'Yes, Confirm',
  cancelText = 'Cancel',
}) => {
  return (
    <div className="flex gap-2 p-4 border-t bg-gradient-to-r from-background to-muted/20 animate-fade-in">
      <Button
        onClick={onCancel}
        disabled={disabled}
        variant="outline"
        className="flex-1 h-12 transition-all duration-200 hover:scale-105"
      >
        <X className="h-4 w-4 mr-2" />
        {cancelText}
      </Button>
      <Button
        onClick={onYes}
        disabled={disabled}
        className="flex-1 h-12 bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105"
      >
        <Check className="h-4 w-4 mr-2" />
        {yesText}
      </Button>
    </div>
  );
};
