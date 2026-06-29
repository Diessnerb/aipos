
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { normalizeUKPhone, validateUKPhone, formatPhoneForDisplay, getPhoneValidationError } from '@/utils/phoneUtils';
import { useAuth } from '@/components/AuthProvider';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddCustomerModal = ({ isOpen, onClose }: AddCustomerModalProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a customer name",
        variant: "destructive"
      });
      return;
    }

    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found. Please try logging in again.",
        variant: "destructive"
      });
      return;
    }

    // Validate phone number if provided
    if (phone.trim() && !validateUKPhone(phone.trim())) {
      setPhoneError(getPhoneValidationError(phone.trim()));
      return;
    }

    setIsSubmitting(true);
    setPhoneError('');

    try {
      // Normalize phone number before saving
      const normalizedPhone = phone.trim() ? normalizeUKPhone(phone.trim()) : null;
      
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: name.trim(),
          phone: normalizedPhone,
          email: email.trim() || null,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidate queries to refresh customer lists
      queryClient.invalidateQueries({ queryKey: ['customers-search'] });

      toast({
        title: "Customer added",
        description: `${name} has been added successfully`,
      });

      // Reset form and close modal
      setName('');
      setPhone('');
      setEmail('');
      onClose();
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPhoneError('');
    onClose();
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setPhoneError(''); // Clear error when user starts typing
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm w-full mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Add New Customer</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="customer-name" className="text-sm">Name *</Label>
            <Input
              id="customer-name"
              placeholder="Enter customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="customer-phone" className="text-sm">Phone</Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder="07xxx xxx xxx"
              value={formatPhoneForDisplay(phone)}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className={`mt-1 ${phoneError ? 'border-red-500' : ''}`}
            />
            {phoneError && (
              <p className="text-red-500 text-xs mt-1">{phoneError}</p>
            )}
          </div>

          <div>
            <Label htmlFor="customer-email" className="text-sm">Email</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting}
              size="sm"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !name.trim()}
              size="sm"
            >
              {isSubmitting ? 'Adding...' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
