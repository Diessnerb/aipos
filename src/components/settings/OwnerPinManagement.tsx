import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { AlertTriangle, Key, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ConfirmPasswordDialog from './ConfirmPasswordDialog';
import { useNavigate } from 'react-router-dom';
import { clearPinUser } from '@/utils/pinAuth';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
const OwnerPinManagement: React.FC = () => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasOwnerPin, setHasOwnerPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingPin, setCheckingPin] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [confirmingPassword, setConfirmingPassword] = useState(false);
  const { toast } = useToast();
  const { companyId, user, pinUser } = useAuth();
  const navigate = useNavigate();
  const deviceLive = useDeviceLiveLayer();
  useEffect(() => {
    if (companyId) {
      checkExistingPin();
    } else {
      setCheckingPin(false);
    }
  }, [companyId]);

  const checkExistingPin = async () => {
    try {
      setCheckingPin(true);

      // Only attempt DB queries when a Supabase session exists
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setHasOwnerPin(false);
        return;
      }

      const { data, error } = await supabase
        .from('companies')
        .select('owner_pin')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      setHasOwnerPin(!!data?.owner_pin);
    } catch (error) {
      console.error('Error checking owner PIN:', error);
    } finally {
      setCheckingPin(false);
    }
  };

  const validatePin = (pin: string): boolean => {
    return /^[0-9]{4}$/.test(pin);
  };

  const handleSetPin = async () => {
    if (!validatePin(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits",
        variant: "destructive"
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PIN mismatch",
        description: "New PIN and confirmation don't match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Use secure RPC function that handles hashing server-side
      const { data, error } = await supabase.rpc('set_owner_pin_secure', {
        p_company_id: companyId,
        p_new_pin: newPin
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to set owner PIN');
      }

      toast({
        title: "Owner PIN set successfully", 
        description: "The owner PIN has been configured for your restaurant"
      });

      setHasOwnerPin(true);
      setNewPin('');
      setConfirmPin('');
    } catch (error: any) {
      console.error('Error setting owner PIN:', error);
      toast({
        title: "Error setting PIN",
        description: error.message || "Failed to set owner PIN",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    if (!validatePin(currentPin)) {
      toast({
        title: "Invalid current PIN",
        description: "Current PIN must be exactly 4 digits",
        variant: "destructive"
      });
      return;
    }

    if (!validatePin(newPin)) {
      toast({
        title: "Invalid new PIN",
        description: "New PIN must be exactly 4 digits",
        variant: "destructive"
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PIN mismatch",
        description: "New PIN and confirmation don't match",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Use secure RPC function that handles verification and hashing server-side
      const { data, error } = await supabase.rpc('update_owner_pin_secure', {
        p_company_id: companyId,
        p_current_pin: currentPin,
        p_new_pin: newPin
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update owner PIN');
      }

      toast({
        title: "Owner PIN updated successfully",
        description: "The owner PIN has been changed"
      });

      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');

      // Clear PIN user session but keep Supabase authentication
      clearPinUser();
      toast({
        title: "PIN updated successfully", 
        description: "Please enter your new PIN to continue.",
      });
      navigate('/login');
    } catch (error: any) {
      console.error('Error updating owner PIN:', error);
      toast({
        title: "Error updating PIN",
        description: error.message || "Failed to update owner PIN",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show loading if not device-live (device-live has instant data)
  if (checkingPin && !deviceLive) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Owner PIN Management</CardTitle>
          </div>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Owner PIN Management</CardTitle>
        </div>
        <CardDescription>
          Set up a special owner PIN that provides unrestricted access to all restaurant systems
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The owner PIN grants complete access to all restaurant data and settings. 
            Keep this PIN secure and only share with trusted restaurant owners.
          </AlertDescription>
        </Alert>

        {!hasOwnerPin ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Set Owner PIN
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPin">New PIN (4 digits)</Label>
                <Input
                  id="newPin"
                  type="password"
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  maxLength={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  maxLength={4}
                />
              </div>
            </div>

            <Button 
              onClick={handleSetPin}
              disabled={loading || !newPin || !confirmPin}
              className="w-full"
            >
              {loading ? "Setting PIN..." : "Set Owner PIN"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Update Owner PIN
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPin">Current PIN</Label>
                <Input
                  id="currentPin"
                  type="password"
                  placeholder="••••"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  maxLength={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPinUpdate">New PIN (4 digits)</Label>
                  <Input
                    id="newPinUpdate"
                    type="password"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    maxLength={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPinUpdate">Confirm New PIN</Label>
                  <Input
                    id="confirmPinUpdate"
                    type="password"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    maxLength={4}
                  />
                </div>
              </div>

              <Button 
                onClick={() => setShowPasswordDialog(true)}
                disabled={loading || !currentPin || !newPin || !confirmPin}
                className="w-full"
              >
                {loading ? "Updating PIN..." : "Update Owner PIN"}
              </Button>
            </div>
          </div>
        )}
        <ConfirmPasswordDialog
          open={showPasswordDialog}
          onClose={() => setShowPasswordDialog(false)}
          onConfirm={async (password) => {
            try {
              const emailForAuth = user?.email ?? pinUser?.email ?? null;
              if (!emailForAuth) {
                toast({
                  title: "Account required",
                  description: "We couldn't identify your account. Please sign in first.",
                  variant: "destructive"
                });
                return;
              }
              setConfirmingPassword(true);
              const { error } = await supabase.auth.signInWithPassword({
                email: emailForAuth,
                password
              });
              if (error) {
                toast({
                  title: "Incorrect password",
                  description: "Password verification failed. Try again.",
                  variant: "destructive"
                });
                return;
              }
              await handleUpdatePin();
              setShowPasswordDialog(false);
            } catch (err) {
              console.error("Password confirmation error:", err);
              toast({
                title: "Authentication error",
                description: "Could not verify your password. Please try again.",
                variant: "destructive"
              });
            } finally {
              setConfirmingPassword(false);
            }
          }}
          loading={confirmingPassword}
        />
      </CardContent>
    </Card>
  );
};

export default OwnerPinManagement;