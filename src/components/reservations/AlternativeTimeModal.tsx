import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle } from 'lucide-react';

interface AlternativeTimeModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  suggestedTime: string;
  originalTime: string;
  reason: string;
}

export const AlternativeTimeModal: React.FC<AlternativeTimeModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
  suggestedTime,
  originalTime,
  reason
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onDecline}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Time Not Available</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {reason}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Requested Time</div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-muted-foreground line-through">
                  {originalTime}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-foreground">Suggested Time</div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-semibold text-primary text-lg">
                  {suggestedTime}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onDecline}
              className="flex-1"
            >
              No, I'll Choose Different Time
            </Button>
            <Button 
              onClick={onAccept}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Yes, Book at {suggestedTime}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            After accepting, you'll need to click "Auto Assign" again to find tables
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};