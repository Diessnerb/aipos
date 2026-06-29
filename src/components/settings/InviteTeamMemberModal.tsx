
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, User, Info, Key, Crown, PenTool } from 'lucide-react';
import { CustomPinInput } from '@/components/ui/custom-pin-input';

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (memberData: { full_name: string; role: string; pin_code: string }) => Promise<void>;
  canAssignAdmin?: boolean;
}

const InviteTeamMemberModal = ({ isOpen, onClose, onInvite, canAssignAdmin = false }: InviteTeamMemberModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'staff',
    pin_code: ''
  });

  const generateRandomPin = () => {
    const pin = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setFormData(prev => ({ ...prev, pin_code: pin }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim() || formData.pin_code.length !== 4) {
      return;
    }

    setLoading(true);
    try {
      await onInvite({
        full_name: formData.full_name,
        role: formData.role,
        pin_code: formData.pin_code
      });
      
      // Reset form and close modal on success
      setFormData({ full_name: '', role: 'staff', pin_code: '' });
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ full_name: '', role: 'staff', pin_code: '' });
      onClose();
    }
  };

  const isPinValid = formData.pin_code.length === 4 && /^[0-9]{4}$/.test(formData.pin_code);
  const canSubmit = formData.full_name.trim() && isPinValid;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add a new staff member with PIN-only access
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>


        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Enter staff member's full name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff" className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Staff</span>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" />
                    <span>Manager</span>
                  </div>
                </SelectItem>
                {canAssignAdmin && (
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      <span>Admin</span>
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin_code" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              4-Digit PIN Code
            </Label>
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <CustomPinInput
                  maxLength={4}
                  value={formData.pin_code}
                  onChange={(value) => setFormData(prev => ({ ...prev, pin_code: value }))}
                  disabled={loading}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={generateRandomPin}
                disabled={loading}
                className="px-3"
              >
                Generate
              </Button>
            </div>
            {formData.pin_code && !isPinValid && (
              <p className="text-sm text-red-600">PIN must be exactly 4 digits</p>
            )}
          </div>

          <DialogFooter className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !canSubmit}
            >
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteTeamMemberModal;
