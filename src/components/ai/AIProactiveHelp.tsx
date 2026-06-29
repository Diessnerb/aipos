import React, { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AIProactiveHelpProps {
  trigger: React.ReactNode;
  helpText: string;
  autoShow?: boolean;
  autoShowDelay?: number;
  onLearnMore?: () => void;
}

export const AIProactiveHelp: React.FC<AIProactiveHelpProps> = ({
  trigger,
  helpText,
  autoShow = false,
  autoShowDelay = 2000,
  onLearnMore,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoShown, setHasAutoShown] = useState(false);

  useEffect(() => {
    if (autoShow && !hasAutoShown) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoShown(true);
      }, autoShowDelay);

      return () => clearTimeout(timer);
    }
  }, [autoShow, autoShowDelay, hasAutoShown]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative inline-block">
          {trigger}
          {autoShow && !hasAutoShown && (
            <div className="absolute -top-1 -right-1 h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--ai-primary))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--ai-primary))]"></span>
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-80 p-4 animate-slide-in-up bg-card border-[hsl(var(--ai-primary))]/30"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <HelpCircle className="h-5 w-5 text-[hsl(var(--ai-primary))]" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold mb-2 text-foreground">AI Tip</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{helpText}</p>
            
            {onLearnMore && (
              <Button
                size="sm"
                variant="link"
                onClick={onLearnMore}
                className="mt-2 h-auto p-0 text-[hsl(var(--ai-primary))] hover:text-[hsl(var(--ai-primary))]/80"
              >
                Learn more from AI
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="flex-shrink-0 h-6 w-6 p-0 hover:bg-background/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
