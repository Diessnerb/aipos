
import React from 'react';

interface FuturisticButtonProps {
  children: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

export const FuturisticButton: React.FC<FuturisticButtonProps> = ({ 
  children, 
  isSelected, 
  onClick, 
  className = '' 
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-full text-lg sm:text-xl font-bold transition-all duration-300 ease-out
        ${isSelected 
          ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground shadow'
        }
        hover:scale-105 active:scale-95
        border border-border
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background
        ${className}
      `}
    >
      {/* Button content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
};
