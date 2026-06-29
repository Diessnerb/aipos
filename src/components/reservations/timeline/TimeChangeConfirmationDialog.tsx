import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TimeChangeConfirmationDialogProps {
  open: boolean;
  customerName: string;
  originalTime: string;
  newTime: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TimeChangeConfirmationDialog: React.FC<TimeChangeConfirmationDialogProps> = ({
  open,
  customerName,
  originalTime,
  newTime,
  onConfirm,
  onCancel,
}) => {
  // Format time strings for display (remove seconds if present)
  const formatTime = (time: string) => {
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Time Change</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You're about to change <strong>{customerName}'s</strong> reservation time.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">Original:</span>
                <span className="font-mono text-yellow-900 dark:text-yellow-100">{formatTime(originalTime)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-green-800 dark:text-green-200 font-medium">New:</span>
                <span className="font-mono text-green-900 dark:text-green-100">{formatTime(newTime)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Click "No" to only change the table assignment without updating the time.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>
            Yes, change time
          </AlertDialogAction>
          <AlertDialogCancel onClick={onCancel}>
            No, keep original time
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
