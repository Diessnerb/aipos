import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({ title, subtitle, children, className }: PageHeaderProps) => {
  return (
    <div className={cn(
      "relative animate-fade-in",
      // Break out of parent padding for full width
      "-mx-6 px-6",
      // Sticky positioning
      "sticky top-0 z-10 bg-background/95 backdrop-blur border-b",
      // Spacing
      "py-4 mb-6",
      className
    )}>
      <div className="flex min-w-0 items-center justify-between gap-4">
        {/* Left side: Title and subtitle */}
        <div className="space-y-1 min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground line-clamp-2">{subtitle}</p>}
        </div>
        
        {/* Right side: Action buttons */}
        {children && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export const SectionHeader = ({ title, subtitle, className }: SectionHeaderProps) => {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
};