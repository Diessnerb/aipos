import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { clearBoundCompany } from '@/utils/deviceBinding';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';
import RestaurantOwnerVerificationModal from './RestaurantOwnerVerificationModal';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteAccountModal = ({ isOpen, onClose }: DeleteAccountModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [hasAgreed, setHasAgreed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const isDeleteEnabled = hasAgreed && confirmationText === 'DELETE';

  const handleProceedToAuth = () => {
    if (!isDeleteEnabled) return;
    setShowAuthModal(true);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      const { error } = await supabase.functions.invoke('delete_user');

      if (error) {
        console.error('Account deletion error:', error);
        toast({
          title: "Deletion Failed",
          description: error.message || 'Could not delete account. Please try again.',
          variant: "destructive",
        });
        return;
      }

      // Sign out, unbind device (account is being deleted), and redirect
      await supabase.auth.signOut();
      clearBoundCompany();
      
      toast({
        title: "Account Deleted",
        description: "Your account has been deleted successfully.",
      });
      
      navigate('/login');
      
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmationText('');
      setHasAgreed(false);
      setShowAuthModal(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete your account
          </DialogTitle>
          <DialogDescription className="text-foreground">
            This permanently deletes your account and associated data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              The following data will be permanently removed:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Your user profile and account settings</li>
              <li>• Reservations you created or manage</li>
              <li>• Orders and transaction history you initiated</li>
              <li>• Messages and communication history</li>
              <li>• Holiday requests and rota schedules</li>
              <li>• Any custom preferences or configurations</li>
            </ul>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="delete-confirmation"
              checked={hasAgreed}
              onCheckedChange={(checked) => setHasAgreed(checked === true)}
              disabled={isDeleting}
            />
            <Label 
              htmlFor="delete-confirmation" 
              className="text-sm font-medium cursor-pointer"
            >
              I understand this action is permanent
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation-input" className="text-sm font-medium">
              Type <span className="font-bold text-destructive">DELETE</span> to confirm:
            </Label>
            <Input
              id="confirmation-input"
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Type DELETE here"
              disabled={isDeleting}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Need help?{' '}
              <a 
                href="mailto:contact@ordergeniesolution.ai" 
                className="text-primary hover:underline"
              >
                Contact support
              </a>
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleProceedToAuth}
              disabled={!isDeleteEnabled || isDeleting}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Proceed to Delete
            </Button>
          </div>
        </div>
      </DialogContent>
      
      <RestaurantOwnerVerificationModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleDeleteAccount}
        title="Verify Restaurant Owner Identity"
        description="Please enter restaurant owner credentials to permanently delete this account. This action cannot be undone and requires owner authorization."
        actionButtonText="Delete Account"
        actionButtonVariant="destructive"
      />
    </Dialog>
  );
};

export default DeleteAccountModal;