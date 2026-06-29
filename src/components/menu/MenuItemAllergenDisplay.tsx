import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useMenuItemAllergens } from '@/hooks/useMenuItemAllergens';
import { AlertTriangle } from 'lucide-react';

interface MenuItemAllergenDisplayProps {
  menuItemId: string;
  className?: string;
  maxVisible?: number;
  variant?: 'default' | 'compact' | 'full' | 'icon';
}

export const MenuItemAllergenDisplay: React.FC<MenuItemAllergenDisplayProps> = ({
  menuItemId,
  className = '',
  maxVisible = 2,
  variant = 'default'
}) => {
  const { data: calculatedAllergens = [], isLoading } = useMenuItemAllergens(menuItemId);

  if (isLoading || calculatedAllergens.length === 0) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="relative">
          <AlertTriangle className="h-6 w-6 text-orange-500" />
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {calculatedAllergens.length}
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span className="text-sm font-semibold text-orange-500">
            Allergen Information
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {calculatedAllergens.map((allergen, index) => (
            <Badge key={index} variant="destructive" className="text-xs">
              {allergen}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap gap-1 ${className}`}>
        {calculatedAllergens.slice(0, maxVisible).map((allergen, index) => (
          <Badge key={index} variant="destructive" className="text-xs px-1 py-0">
            {allergen}
          </Badge>
        ))}
        {calculatedAllergens.length > maxVisible && (
          <Badge variant="destructive" className="text-xs px-1 py-0">
            +{calculatedAllergens.length - maxVisible}
          </Badge>
        )}
      </div>
    );
  }

  // Default variant - with container
  return (
    <div className={`mb-3 ${className}`}>
      <p className="text-xs text-muted-foreground mb-1">Contains:</p>
      <div className="flex flex-wrap gap-1 justify-center">
        {calculatedAllergens.map((allergen, index) => (
          <Badge key={index} variant="destructive" className="text-xs">
            {allergen}
          </Badge>
        ))}
      </div>
    </div>
  );
};
