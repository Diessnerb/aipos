import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Eye, EyeOff } from 'lucide-react';

interface RestaurantOwnerVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  title: string;
  description: string;
  actionButtonText: string;
  actionButtonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

const RestaurantOwnerVerificationModal = ({
  isOpen,
  onClose,
  onAuthenticated,
  title,
  description,
  actionButtonText,
  actionButtonVariant = "default"
}: RestaurantOwnerVerificationModalProps) => {
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const { companyId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ownerEmail || !ownerPin) {
      toast({
        title: "Missing Information",
        description: "Please enter both restaurant owner email and PIN.",
        variant: "destructive",
      });
      return;
    }

    if (!companyId) {
      toast({
        title: "Company Error",
        description: "No company found. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Fetch company details to verify owner credentials
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('default_admin_email, owner_pin')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        toast({
          title: "Verification Failed",
          description: "Could not verify company information.",
          variant: "destructive",
        });
        return;
      }

      // Check if the entered email matches the restaurant owner email
      if (ownerEmail.toLowerCase().trim() !== company.default_admin_email?.toLowerCase().trim()) {
        toast({
          title: "Authentication Failed",
          description: "Invalid restaurant owner email.",
          variant: "destructive",
        });
        return;
      }

      // Check if the entered PIN matches the owner PIN
      if (ownerPin !== company.owner_pin) {
        toast({
          title: "Authentication Failed", 
          description: "Invalid owner PIN.",
          variant: "destructive",
        });
        return;
      }

      // Authentication successful
      toast({
        title: "Verification Successful",
        description: "Restaurant owner credentials verified.",
      });
      
      onAuthenticated();
      handleClose();
      
    } catch (error) {
      console.error('Owner verification error:', error);
      toast({
        title: "Verification Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (!isVerifying) {
      setOwnerEmail('');
      setOwnerPin('');
      setShowPin(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="owner-email" className="text-sm font-medium">
              Restaurant Owner Email
            </Label>
            <Input
              id="owner-email"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="Enter restaurant owner email"
              disabled={isVerifying}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-pin" className="text-sm font-medium">
              Owner PIN
            </Label>
            <div className="relative">
              <Input
                id="owner-pin"
                type={showPin ? "text" : "password"}
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value)}
                placeholder="Enter owner PIN"
                disabled={isVerifying}
                maxLength={4}
                className="pr-10 font-mono text-center"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isVerifying}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p>👑 This verification requires restaurant owner credentials only. Only the restaurant owner can authorize this action.</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={actionButtonVariant}
              disabled={!ownerEmail || !ownerPin || isVerifying}
              className="flex items-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Verifying...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  {actionButtonText}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RestaurantOwnerVerificationModal;