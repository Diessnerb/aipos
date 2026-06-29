import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { SECURITY_RECOMMENDATIONS } from '@/utils/securityConfig';

interface SecurityStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityStatusDialog: React.FC<SecurityStatusDialogProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Security Status Update
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Implemented Security Fixes */}
          <Alert>
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <h4 className="font-semibold text-green-800">✅ Security Fixes Implemented</h4>
                <ul className="text-sm space-y-1 ml-4">
                  {SECURITY_RECOMMENDATIONS.DATABASE_SECURITY.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-600">•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Manual Configuration Required */}
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-4">
                <h4 className="font-semibold text-amber-800">⚠️ Manual Configuration Required</h4>
                <p className="text-sm text-muted-foreground">
                  The following settings require manual configuration in your Supabase dashboard:
                </p>
                
                <div className="space-y-3">
                  {SECURITY_RECOMMENDATIONS.AUTH_SETTINGS.actions.map((action, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-amber-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h5 className="font-medium text-sm">{action.setting}</h5>
                          <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(action.url, '_blank')}
                          className="shrink-0"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Additional Security Notes */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">🔒 Security Enhancements Made</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p><strong>PIN Authentication:</strong> Now includes rate limiting (5 attempts per 15 minutes)</p>
              <p><strong>Data Access:</strong> Strengthened Row-Level Security policies prevent cross-company data access</p>
              <p><strong>Credentials:</strong> All sensitive data is now encrypted or hashed</p>
              <p><strong>Audit Trail:</strong> Security events are logged for monitoring</p>
              <p><strong>Session Security:</strong> PIN user sessions now expire after 8 hours</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              I'll Configure Later
            </Button>
            <Button onClick={onClose}>
              Got It
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};