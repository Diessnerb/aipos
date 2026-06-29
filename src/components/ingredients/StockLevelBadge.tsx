import React from 'react';
import { Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatStockDisplay } from '@/lib/unitConversions';

interface StockLevelBadgeProps {
  stockLevel: number;
  stockUnit: string;
  lastUpdated?: string;
}

export const StockLevelBadge: React.FC<StockLevelBadgeProps> = ({
  stockLevel,
  stockUnit,
  lastUpdated,
}) => {
  const formattedStock = formatStockDisplay(stockLevel, stockUnit);
  const timeAgo = lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : 'Never updated';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border rounded-full cursor-help">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {formattedStock}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-sm">
            <p className="font-semibold">Current stock: {formattedStock}</p>
            <p className="text-muted-foreground">Updated {timeAgo}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
