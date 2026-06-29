import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CheckBackFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  course: 'starters' | 'mains' | 'desserts';
}

export const CheckBackFeedbackModal: React.FC<CheckBackFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  course,
}) => {
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    onSubmit(notes);
    setNotes(''); // Reset for next time
    onClose();
  };

  const handleCancel = () => {
    setNotes('');
    onClose();
  };

  const courseNames = {
    'starters': 'Starters',
    'mains': 'Mains',
    'desserts': 'Desserts',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-red-700">Issue with {courseNames[course]}</DialogTitle>
          <DialogDescription>
            What issue did the guests report? This feedback helps the kitchen improve quality.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-notes">
              Feedback Notes
            </Label>
            <Textarea
              id="feedback-notes"
              placeholder="e.g., Food was cold, wrong order, undercooked, too salty, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px]"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-700"
          >
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
