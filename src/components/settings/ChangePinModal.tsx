import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, Shield } from 'lucide-react';
import { CustomPinInput } from '@/components/ui/custom-pin-input';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePin: (newPin: string, ownerPin?: string) => Promise<void>;
  memberName: string;
  requiresOwnerPin: boolean;
}

const ChangePinModal = ({ 
  isOpen, 
  onClose, 
  onChangePin, 
  memberName,
  requiresOwnerPin 
}: ChangePinModalProps) => {
  const [newPin, setNewPin] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (requiresOwnerPin && ownerPin.length !== 4) {
      setError('Your PIN must be exactly 4 digits');
      return;
    }

    setIsLoading(true);
    try {
      await onChangePin(newPin, requiresOwnerPin ? ownerPin : undefined);
      handleClose();
    } catch (error: any) {
      setError(error.message || 'Failed to change PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNewPin('');
    setOwnerPin('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change PIN for {memberName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-pin">New PIN (4 digits)</Label>
            <CustomPinInput
              value={newPin}
              onChange={setNewPin}
              disabled={isLoading}
              maxLength={4}
              className="w-full"
            />
          </div>

          {requiresOwnerPin && (
            <div className="space-y-2">
              <Label htmlFor="owner-pin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Your PIN for Authorization
              </Label>
              <CustomPinInput
                value={ownerPin}
                onChange={setOwnerPin}
                disabled={isLoading}
                maxLength={4}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Your PIN is required to authorize this change
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || newPin.length !== 4 || (requiresOwnerPin && ownerPin.length !== 4)}
            >
              {isLoading ? 'Changing PIN...' : 'Change PIN'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePinModal;