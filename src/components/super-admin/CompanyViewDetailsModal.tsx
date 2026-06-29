import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar, RefreshCcw, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyDetail {
  id: string;
  name: string;
  default_admin_email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CompanyViewDetailsModalProps {
  company: CompanyDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onPasswordReset?: () => void;
}

export const CompanyViewDetailsModal: React.FC<CompanyViewDetailsModalProps> = ({
  company,
  isOpen,
  onClose,
  onPasswordReset
}) => {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);

  if (!company) return null;

  const handleResetPassword = async () => {
    try {
      setIsResetting(true);

      // Get the owner's auth_user_id from users table
      const { data: ownerUser, error: userError } = await supabase
        .from('users')
        .select('auth_user_id')
        .eq('company_id', company.id)
        .eq('role', 'owner')
        .single();

      if (userError || !ownerUser) {
        throw new Error('Could not find owner user for this company');
      }

      // Call the edge function to update credentials
      const { data, error } = await supabase.functions.invoke('update-admin-credentials', {
        body: {
          userId: ownerUser.auth_user_id,
          newEmail: company.default_admin_email,
          newPassword: 'Password'
        }
      });

      if (error) throw error;

      toast({
        title: "Password Reset Successful",
        description: `Owner password has been reset to "Password"`,
      });

      onPasswordReset?.();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Password Reset Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" style={{ zIndex: 60 }}>
        <DialogHeader>
          <DialogTitle className="text-2xl">{company.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Owner Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Owner Information
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{company.default_admin_email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{formatDate(company.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-medium">{formatDate(company.updated_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-4 w-4 flex items-center justify-center">
                  <div className={`h-2 w-2 rounded-full ${
                    company.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(company.status)} className="mt-1">
                    {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Security
            </h3>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 text-sm text-muted-foreground">
                  Passwords are encrypted and cannot be viewed. Reset to set a new temporary password.
                </div>
              </div>
              
              <Button
                onClick={handleResetPassword}
                disabled={isResetting}
                className="w-full"
                variant="outline"
              >
                <RefreshCcw className={`mr-2 h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting Password...' : 'Reset Password to "Password"'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
