import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlisha } from '@/providers/AlishaProvider';
import { AIAssistant } from './AIAssistant';

export const AlishaOrb: React.FC = () => {
  // TEMPORARILY HIDDEN - Remove this line to re-enable
  return null;
  
  const { isActive, isLearning, settings } = useAlisha();
  const [isOpen, setIsOpen] = useState(false);

  console.log('🤖 AlishaOrb render:', { isActive, isOpen, isLearning });

  if (!isActive) {
    console.log('🤖 AlishaOrb: Not rendering - isActive is false');
    return null;
  }

  return (
    <>
      {/* Fixed floating orb - always visible at bottom right */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[100]">
          <Button
            onClick={() => {
              console.log('🤖 AlishaOrb: Button clicked, opening modal');
              setIsOpen(true);
            }}
            size="icon"
            className={cn(
              "h-16 w-16 rounded-full shadow-2xl transition-all duration-300 relative z-10",
              "bg-gradient-to-br from-primary via-primary-glow to-primary",
              "hover:scale-110 hover:shadow-[0_0_40px_rgba(var(--primary-glow)/0.6)]",
              "border-2 border-white/20",
              isLearning && "animate-pulse"
            )}
          >
            {isLearning ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
            ) : (
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            )}
          </Button>
          
          {/* Personality indicator pulse */}
          <div className={cn(
            "absolute inset-0 rounded-full pointer-events-none z-0",
            "bg-gradient-to-br from-primary-glow to-primary",
            "opacity-0 animate-ping",
            settings.proactiveSuggestions && "opacity-30"
          )} />
          
          {/* Learning indicator */}
          {isLearning && (
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent border-2 border-background animate-pulse pointer-events-none" />
          )}
        </div>
      )}

      {/* AI Assistant Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[100]">
          <AIAssistant isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
};
