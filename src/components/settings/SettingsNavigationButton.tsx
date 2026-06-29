import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsNavigationButtonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}

const SettingsNavigationButton = ({
  title,
  description,
  icon,
  onClick,
  className
}: SettingsNavigationButtonProps) => {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:shadow-primary/10 border-2 hover:border-primary/20 group h-full flex flex-col",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex-1 flex flex-col justify-center p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
            <div className="flex-shrink-0 text-primary group-hover:scale-110 transition-transform duration-200">
              {icon}
            </div>
            <div className="text-left min-w-0">
              <CardTitle className="text-sm sm:text-base lg:text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {title}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {description}
              </CardDescription>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
        </div>
      </CardHeader>
    </Card>
  );
};

export default SettingsNavigationButton;