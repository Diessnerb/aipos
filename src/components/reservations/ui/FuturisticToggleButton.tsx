
import React from 'react';

interface FuturisticToggleButtonProps {
  children: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

export const FuturisticToggleButton: React.FC<FuturisticToggleButtonProps> = ({ 
  children, 
  isSelected, 
  onClick 
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-1 h-12 sm:h-13 md:h-14 rounded-full text-base sm:text-lg md:text-xl font-bold transition-all duration-300 ease-out
        ${isSelected 
          ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground shadow'
        }
        hover:scale-[1.02] active:scale-95
        border border-border
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background
      `}
    >
      {/* Button content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
};
