import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { PriceBreakdownItem } from '@/utils/productLinkCalculator';
import { cn } from '@/lib/utils';

interface PriceBreakdownCardProps {
  breakdown: PriceBreakdownItem[];
  total: number;
  formatCurrency: (value: number) => string;
  onClear: () => void;
  hasSelections: boolean;
}

export const PriceBreakdownCard: React.FC<PriceBreakdownCardProps> = ({
  breakdown,
  total,
  formatCurrency,
  onClear,
  hasSelections,
}) => {
  if (breakdown.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Price Calculation</CardTitle>
          {hasSelections && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {breakdown.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm py-1"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {item.optionName}
                </span>
              </div>
              <span
                className={cn(
                  "font-medium",
                  item.isModifier && item.price > 0 && "text-primary"
                )}
              >
                {item.isModifier && item.price > 0 ? '+' : ''}
                {formatCurrency(item.price)}
              </span>
            </div>
          ))}
        </div>
        
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base">Total Price</span>
            <span className="font-bold text-xl text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
