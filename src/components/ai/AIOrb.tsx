import React from 'react';
import { Brain, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIOrbProps {
  onClick: () => void;
  mode?: 'default' | 'suggestion' | 'alert';
  hasSuggestions?: boolean;
  isThinking?: boolean;
}

export const AIOrb: React.FC<AIOrbProps> = ({
  onClick,
  mode = 'default',
  hasSuggestions = false,
  isThinking = false,
}) => {
  // TEMPORARILY HIDDEN - Remove this line to re-enable
  return null;
  
  const getModeStyles = () => {
    switch (mode) {
      case 'suggestion':
        return 'bg-[hsl(var(--ai-suggestion))] hover:bg-[hsl(var(--ai-suggestion))]/90';
      case 'alert':
        return 'bg-[hsl(var(--ai-alert))] hover:bg-[hsl(var(--ai-alert))]/90';
      default:
        return 'bg-[hsl(var(--ai-primary))] hover:bg-[hsl(var(--ai-primary))]/90';
    }
  };

  const getIcon = () => {
    if (isThinking) return <Sparkles className="h-6 w-6 animate-spin" />;
    if (mode === 'alert') return <AlertCircle className="h-6 w-6" />;
    if (hasSuggestions) return <Sparkles className="h-6 w-6" />;
    return <Brain className="h-6 w-6" />;
  };

  const getTooltipText = () => {
    if (isThinking) return 'AI is thinking...';
    if (mode === 'alert') return 'AI has important insights';
    if (hasSuggestions) return 'AI has suggestions for you';
    return 'Ask AI for help';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            size="lg"
            className={cn(
              'fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full shadow-lg transition-all duration-300',
              getModeStyles(),
              hasSuggestions && 'animate-ai-pulse',
              !isThinking && 'animate-ai-glow'
            )}
          >
            {getIcon()}
            {hasSuggestions && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-white text-[hsl(var(--ai-primary))] text-xs items-center justify-center font-bold">
                  !
                </span>
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="animate-slide-in-up">
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
