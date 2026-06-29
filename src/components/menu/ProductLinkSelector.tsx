import React from 'react';
import { ProductLink } from '@/types/productLinks';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface ProductLinkSelectorProps {
  level: number;
  options: ProductLink[];
  selectedId?: string;
  onSelect: (linkId: string) => void;
  pricingMode: 'base_price' | 'modifier';
  formatCurrency: (value: number) => string;
}

export const ProductLinkSelector: React.FC<ProductLinkSelectorProps> = ({
  level,
  options,
  selectedId,
  onSelect,
  pricingMode,
  formatCurrency,
}) => {
  const getLevelLabel = (level: number): string => {
    const labels: Record<number, string> = {
      1: 'Size / Type',
      2: 'Additional Options',
      3: 'Add-ons',
      4: 'Extras'
    };
    return labels[level] || `Level ${level} Options`;
  };

  const getOptionPrice = (option: ProductLink): string => {
    if (pricingMode === 'base_price' && level === 1) {
      return formatCurrency(option.base_price ?? 0);
    }
    
    if (option.price_modifier === null || option.price_modifier === 0) {
      return 'Included';
    }
    
    const modifier = option.price_modifier;
    const sign = modifier > 0 ? '+' : '';
    return `${sign}${formatCurrency(modifier)}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {level}
        </div>
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          {getLevelLabel(level)}
        </h4>
      </div>
      
      <RadioGroup value={selectedId} onValueChange={onSelect} className="space-y-2">
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
              selectedId === option.id
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
            onClick={() => onSelect(option.id)}
          >
            <div className="flex items-center gap-3 flex-1">
              <RadioGroupItem value={option.id} id={option.id} />
              <Label
                htmlFor={option.id}
                className="cursor-pointer font-medium flex-1"
              >
                {option.option_name}
              </Label>
            </div>
            <span
              className={cn(
                "text-sm font-semibold whitespace-nowrap ml-3",
                selectedId === option.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              {getOptionPrice(option)}
            </span>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};
