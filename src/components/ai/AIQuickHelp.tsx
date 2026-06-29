import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, X } from 'lucide-react';

interface AIQuickHelpProps {
  title: string;
  description: string;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isProcessing?: boolean;
  result?: string;
  onClose?: () => void;
}

export const AIQuickHelp: React.FC<AIQuickHelpProps> = ({
  title,
  description,
  suggestions,
  onSelect,
  isProcessing,
  result,
  onClose,
}) => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const handleSelect = (suggestion: string) => {
    setSelectedSuggestion(suggestion);
    onSelect(suggestion);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && (
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start text-left h-auto py-2 px-3"
                onClick={() => handleSelect(suggestion)}
                disabled={isProcessing}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        )}

        {result && !isProcessing && (
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{result}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedSuggestion(null);
                if (onClose) onClose();
              }}
            >
              Close
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
