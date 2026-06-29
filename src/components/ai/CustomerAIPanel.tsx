import React, { useState } from 'react';
import { AIInlineSuggestion } from './AIInlineSuggestion';
import { AIProactiveHelp } from './AIProactiveHelp';
import { useCustomerAI } from '@/hooks/useCustomerAI';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface CustomerAIPanelProps {
  customerId?: string;
  customerName?: string;
  visitHistory?: any[];
  onDraftAccept?: (draft: string) => void;
}

export const CustomerAIPanel: React.FC<CustomerAIPanelProps> = ({
  customerId,
  customerName,
  visitHistory,
  onDraftAccept,
}) => {
  const [showMessageDraft, setShowMessageDraft] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageType, setMessageType] = useState<'welcome' | 'follow-up' | 'promotion'>('follow-up');
  const { draftMessage, suggestPreferences, isProcessing } = useCustomerAI();

  const handleDraftMessage = async (type: 'welcome' | 'follow-up' | 'promotion') => {
    setMessageType(type);
    setShowMessageDraft(true);

    const result = await draftMessage(
      {
        customerName,
        visitHistory,
      },
      type
    );

    if (result?.message) {
      setMessageDraft(result.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI suggestions for customer communication */}
      {visitHistory && visitHistory.length > 3 && (
        <AIInlineSuggestion
          message={`${customerName} is a regular customer with ${visitHistory.length} visits. Consider sending a personalized thank-you message or special offer.`}
          variant="suggestion"
          onAccept={() => handleDraftMessage('follow-up')}
          onDismiss={() => {}}
        />
      )}

      {/* Message drafting section */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-[hsl(var(--ai-primary))]" />
          <h3 className="font-semibold">AI Message Assistant</h3>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDraftMessage('welcome')}
              disabled={isProcessing}
            >
              Draft Welcome
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDraftMessage('follow-up')}
              disabled={isProcessing}
            >
              Draft Follow-up
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDraftMessage('promotion')}
              disabled={isProcessing}
            >
              Draft Promotion
            </Button>
          </div>

          {showMessageDraft && (
            <div className="space-y-2">
              <Textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder="AI-generated message will appear here..."
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMessageDraft(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-[hsl(var(--ai-primary))]"
                  onClick={() => {
                    if (onDraftAccept) {
                      onDraftAccept(messageDraft);
                    }
                    setShowMessageDraft(false);
                  }}
                >
                  Use Message
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Proactive help */}
      <AIProactiveHelp
        trigger={<div className="text-sm text-muted-foreground">Need help with customer management?</div>}
        helpText="I can help you analyze customer preferences, draft personalized messages, and suggest the best times to reach out based on their visit history."
        autoShow={false}
      />
    </div>
  );
};
