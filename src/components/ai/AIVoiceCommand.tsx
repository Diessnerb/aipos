import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIVoiceCommandProps {
  onCommand: (command: string) => void;
  className?: string;
}

export const AIVoiceCommand: React.FC<AIVoiceCommandProps> = ({
  onCommand,
  className,
}) => {
  const { isListening, isSupported, toggleListening } = useVoiceCommands(onCommand);

  if (!isSupported) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleListening}
            className={cn(
              'relative',
              isListening && 'animate-ai-pulse border-[hsl(var(--ai-primary))]',
              className
            )}
          >
            {isListening ? (
              <MicOff className="h-4 w-4 text-[hsl(var(--ai-primary))]" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {isListening && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--ai-primary))] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--ai-primary))]"></span>
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? 'Stop listening' : 'Start voice command'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
