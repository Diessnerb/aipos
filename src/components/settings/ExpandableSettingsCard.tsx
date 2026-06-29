import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableSettingsCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

const ExpandableSettingsCard = ({
  title,
  description,
  icon,
  children,
  defaultOpen = false,
  className
}: ExpandableSettingsCardProps) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Card className={cn("h-full flex flex-col transition-all duration-200 hover:shadow-md", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="h-full flex flex-col">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {icon && <div className="flex-shrink-0">{icon}</div>}
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">{title}</CardTitle>
                  <CardDescription className="truncate">{description}</CardDescription>
                </div>
              </div>
              <ChevronDown 
                className={cn(
                  "h-5 w-5 transition-transform duration-200 flex-shrink-0",
                  isOpen && "transform rotate-180"
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down flex-1 flex flex-col overflow-hidden">
          <CardContent className="pt-0 flex-1 overflow-auto">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ExpandableSettingsCard;