import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AIInlineSuggestionProps {
  message: string;
  onAccept?: () => void;
  onDismiss?: () => void;
  variant?: 'info' | 'suggestion' | 'alert';
  className?: string;
}

export const AIInlineSuggestion: React.FC<AIInlineSuggestionProps> = ({
  message,
  onAccept,
  onDismiss,
  variant = 'suggestion',
  className,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'alert':
        return 'bg-[hsl(var(--ai-alert))]/10 border-[hsl(var(--ai-alert))]/30 text-foreground';
      case 'info':
        return 'bg-[hsl(var(--ai-primary))]/10 border-[hsl(var(--ai-primary))]/30 text-foreground';
      default:
        return 'bg-[hsl(var(--ai-suggestion))]/10 border-[hsl(var(--ai-suggestion))]/30 text-foreground';
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border-2 animate-slide-in-up',
        getVariantStyles(),
        className
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <Sparkles className="h-5 w-5 text-[hsl(var(--ai-primary))]" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-relaxed">{message}</p>
        
        {onAccept && (
          <Button
            size="sm"
            onClick={onAccept}
            className="mt-2 h-7 text-xs bg-[hsl(var(--ai-primary))] hover:bg-[hsl(var(--ai-primary))]/90"
          >
            Apply Suggestion
          </Button>
        )}
      </div>

      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="flex-shrink-0 h-6 w-6 p-0 hover:bg-background/50"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
