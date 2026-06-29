import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MenuItemsUsageBadgeProps {
  count: number;
  menuItems: Array<{ id: string; name: string }>;
}

export const MenuItemsUsageBadge: React.FC<MenuItemsUsageBadgeProps> = ({
  count,
  menuItems,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border rounded-full cursor-help">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {count} {count === 1 ? 'Item' : 'Items'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {count === 0 ? (
            <p className="text-sm">Not used in any menu items yet</p>
          ) : (
            <div>
              <p className="text-sm font-semibold mb-1">Used in {count} menu {count === 1 ? 'item' : 'items'}:</p>
              <ul className="text-sm space-y-0.5">
                {menuItems.slice(0, 5).map(item => (
                  <li key={item.id}>• {item.name}</li>
                ))}
                {menuItems.length > 5 && (
                  <li className="text-muted-foreground">...and {menuItems.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
