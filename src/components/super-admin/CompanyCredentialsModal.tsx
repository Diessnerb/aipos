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
import { Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CompanyCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  credentials: {
    companyName: string;
    email: string;
    password: string;
    pin: string;
  } | null;
}

export const CompanyCredentialsModal: React.FC<CompanyCredentialsModalProps> = ({
  open,
  onClose,
  credentials,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!credentials) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: 'Copied!',
      description: `${fieldName} copied to clipboard`,
    });
  };

  const copyAll = () => {
    const allText = `Welcome to ${credentials.companyName}!

Here are your login credentials:

Email: ${credentials.email}
Temporary Password: ${credentials.password}
Owner PIN: ${credentials.pin}

Please change your password after first login.`;

    navigator.clipboard.writeText(allText);
    toast({
      title: 'All credentials copied!',
      description: 'Ready to send to the restaurant owner',
    });
  };

  const CredentialRow = ({ label, value, fieldName }: { label: string; value: string; fieldName: string }) => (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="font-mono font-semibold text-foreground">{value}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => copyToClipboard(value, fieldName)}
        className="ml-4"
      >
        {copiedField === fieldName ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Company Created Successfully! 🎉</DialogTitle>
          <DialogDescription>
            Share these credentials with the restaurant owner. They can change the password after first login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <CredentialRow
            label="Company Name"
            value={credentials.companyName}
            fieldName="Company Name"
          />
          <CredentialRow
            label="Email"
            value={credentials.email}
            fieldName="Email"
          />
          <CredentialRow
            label="Temporary Password"
            value={credentials.password}
            fieldName="Password"
          />
          <CredentialRow
            label="Owner PIN"
            value={credentials.pin}
            fieldName="PIN"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button onClick={copyAll} className="w-full sm:flex-1" size="lg">
            <Copy className="mr-2 h-4 w-4" />
            Copy All Information
          </Button>
          <Button onClick={onClose} variant="outline" className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
