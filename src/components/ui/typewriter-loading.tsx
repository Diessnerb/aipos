
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TypewriterLoadingProps {
  text?: string;
  speed?: number;
  className?: string;
  showCursor?: boolean;
}

export const TypewriterLoading: React.FC<TypewriterLoadingProps> = ({
  text = "OrderGenieSolution",
  speed = 150,
  className,
  showCursor = true
}) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else {
      // Reset animation after a pause
      const resetTimer = setTimeout(() => {
        setDisplayText('');
        setCurrentIndex(0);
      }, 2000);

      return () => clearTimeout(resetTimer);
    }
  }, [currentIndex, text, speed]);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="text-center">
        <div className="text-4xl font-bold text-primary tracking-wider">
          {displayText}
          {showCursor && (
            <span className="animate-pulse text-primary/60">|</span>
          )}
        </div>
      </div>
    </div>
  );
};
