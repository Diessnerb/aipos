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
import { useCompanies } from '@/hooks/useCompanies';
import { useToast } from '@/hooks/use-toast';
import { CompanyCredentialsModal } from './CompanyCredentialsModal';

interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated?: () => void;
}

export const CreateCompanyModal = ({ open, onOpenChange, onCompanyCreated }: CreateCompanyModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    adminEmail: '',
    adminFullName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    companyName: string;
    email: string;
    password: string;
    pin: string;
  } | null>(null);
  const { createCompany } = useCompanies();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Auto-generate 4-digit PIN
      const ownerPin = Math.floor(1000 + Math.random() * 9000).toString();
      
      const result = await createCompany({
        ...formData,
        adminPassword: 'Password', // Always default to "Password"
        ownerPin: ownerPin
      });
      
      if (result.success) {
        // Store credentials and show modal
        setCreatedCredentials({
          companyName: formData.name,
          email: formData.adminEmail,
          password: 'Password',
          pin: ownerPin,
        });
        
        // Reset form
        setFormData({
          name: '',
          subdomain: '',
          adminEmail: '',
          adminFullName: '',
        });
        
        // Close the creation modal
        onOpenChange(false);
        
        // Trigger refresh of enhanced dashboard data
        if (onCompanyCreated) {
          setTimeout(() => {
            onCompanyCreated();
          }, 1000); // Small delay to ensure database consistency
        }
      }
    } catch (error) {
      console.error('Error creating company:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const formatSubdomain = (value: string) => {
    // Convert to lowercase and remove special characters
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Company</DialogTitle>
          <DialogDescription>
            Add a new restaurant tenant to the platform
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="e.g., Mario's Italian Restaurant"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="subdomain"
                  placeholder="marios"
                  value={formData.subdomain}
                  onChange={(e) => handleInputChange('subdomain', formatSubdomain(e.target.value))}
                  required
                />
                <span className="text-sm text-muted-foreground">.yourdomain.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This will be the URL for this restaurant's login
              </p>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Default Admin User</h4>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full Name</Label>
                  <Input
                    id="admin-name"
                    placeholder="Mario Rossi"
                    value={formData.adminFullName}
                    onChange={(e) => handleInputChange('adminFullName', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="mario@marios.com"
                    value={formData.adminEmail}
                    onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Temporary password will be set to <strong>"Password"</strong> and a 4-digit PIN will be auto-generated. Owner must change these on first login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <CompanyCredentialsModal
      open={!!createdCredentials}
      onClose={() => setCreatedCredentials(null)}
      credentials={createdCredentials}
    />
    </>
  );
};