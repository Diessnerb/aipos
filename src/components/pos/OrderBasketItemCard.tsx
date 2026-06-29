import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus, X, MessageSquare } from 'lucide-react';
import { BasketItem } from '@/contexts/OrderBasketContext';
import { CourseBadge } from './CourseBadge';

interface OrderBasketItemCardProps {
  item: BasketItem;
  isPaymentMode: boolean;
  isSelected: boolean;
  quantitySelected: number;
  onItemClick: (item: BasketItem) => void;
  onRemove: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onCourseChange: (itemId: string, currentCourse: 'drinks' | 'starter' | 'main' | 'dessert') => void;
  formatCurrency: (value: number) => string;
}

export const OrderBasketItemCard: React.FC<OrderBasketItemCardProps> = ({
  item,
  isPaymentMode,
  isSelected,
  quantitySelected,
  onItemClick,
  onRemove,
  onUpdateQuantity,
  onCourseChange,
  formatCurrency,
}) => {
  const isPaid = (item.quantityPaid || 0) > 0;
  const isFullyPaid = (item.quantityPaid || 0) >= item.quantity;

  return (
    <div
      className={`bg-background rounded-lg p-3 shadow-sm border relative transition-all duration-300 ease-in-out ${
        isPaymentMode 
          ? isFullyPaid
            ? 'cursor-not-allowed opacity-70'
            : 'cursor-pointer hover:border-primary/70'
          : 'cursor-pointer hover:border-primary/50'
      } ${
        isSelected 
          ? 'border-primary border-2 bg-primary/5' 
          : ''
      } ${
        isFullyPaid
          ? 'bg-green-50 dark:bg-green-950/20'
          : ''
      }`}
      onClick={() => !isFullyPaid && onItemClick(item)}
    >
      {/* Selection Badge - Top Left */}
      {isPaymentMode && isSelected && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full z-10">
          {quantitySelected} selected
        </div>
      )}

      {/* Paid Badge - Top Right (POS mode only) */}
      {!isPaymentMode && isPaid && (
        <div className="absolute top-2 right-10 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
          {item.quantity === 1 ? 'Paid' : `${item.quantityPaid}/${item.quantity} paid`}
        </div>
      )}

      {/* Remove Button - only show in non-payment mode */}
      {!isPaymentMode && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 absolute top-2 right-2"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {!isPaymentMode ? (
        /* POS MODE LAYOUT - Keep current structure */
        <>
          <div className="flex items-start justify-between mb-2 transition-all duration-300 ease-in-out">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CourseBadge 
                  courseType={item.courseType} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onCourseChange(item.id, item.courseType);
                  }}
                  size="sm"
                />
                <h4 className="font-semibold text-sm leading-tight">
                  {item.menuItem.name}
                </h4>
              </div>
              {item.configuration?.ingredientModifications && item.configuration.ingredientModifications.length > 0 && (
                <div className="text-xs mt-1 space-y-0.5">
                  {item.configuration.ingredientModifications.map((mod, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {mod.modification_type === 'extra' ? (
                        <span className="text-primary font-medium">
                          + {mod.quantity > 1 ? `${mod.quantity}x ` : ''}Extra {mod.ingredient_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          - No {mod.ingredient_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {item.notes && (
                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-1">
                    <MessageSquare className="h-3 w-3 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800 dark:text-yellow-200 italic">
                      {item.notes}
                    </p>
                  </div>
                </div>
              )}
              {item.configuration?.breakdown && (
                <div className="text-xs text-muted-foreground mt-2">
                  {item.configuration.breakdown
                    .filter(b => b.optionName !== 'Base Price')
                    .map((b, i) => (
                      <div key={i}>
                        {b.price > 0 && b.isModifier ? `${b.optionName}: +${formatCurrency(b.price)}` : b.optionName}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end transition-all duration-300 ease-in-out">
            <div className="flex items-center gap-2 bg-muted rounded-md p-1 mr-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity(item.id, item.quantity - 1);
                }}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium w-6 text-center">
                {item.quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity(item.id, item.quantity + 1);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-right">
              {(item.discount || item.priceOverride) && (
                <div className="flex flex-col items-end gap-1 mb-1">
                  <div className="text-xs text-muted-foreground line-through">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </div>
                  {item.discount && (
                    <div className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      -{item.discount.value}%
                    </div>
                  )}
                  {item.priceOverride && (
                    <div className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      OVERRIDE
                    </div>
                  )}
                </div>
              )}
              <div className={`font-bold text-sm ${item.discount ? 'text-primary' : item.priceOverride ? 'text-orange-600' : ''}`}>
                {formatCurrency(item.totalPrice)}
              </div>
              {item.quantity > 1 && (
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(item.totalPrice / item.quantity)} each
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* PAYMENT MODE LAYOUT - Price on title line */
        <div className="flex items-start justify-between gap-3 transition-all duration-300 ease-in-out">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CourseBadge 
                courseType={item.courseType} 
                onClick={(e) => {
                  e.stopPropagation();
                  onCourseChange(item.id, item.courseType);
                }}
                size="sm"
              />
              <h4 className="font-semibold text-sm leading-tight">
                {item.menuItem.name}
              </h4>
            </div>
            {item.configuration?.ingredientModifications && item.configuration.ingredientModifications.length > 0 && (
              <div className="text-xs mt-1 space-y-0.5">
                {item.configuration.ingredientModifications.map((mod, i) => (
                  <div key={i} className="flex items-center gap-1">
                    {mod.modification_type === 'extra' ? (
                      <span className="text-primary font-medium">
                        + {mod.quantity > 1 ? `${mod.quantity}x ` : ''}Extra {mod.ingredient_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        - No {mod.ingredient_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {item.notes && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-1">
                  <MessageSquare className="h-3 w-3 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 italic">
                    {item.notes}
                  </p>
                </div>
              </div>
            )}
            {item.configuration?.breakdown && (
              <div className="text-xs text-muted-foreground mt-2">
                {item.configuration.breakdown
                  .filter(b => b.optionName !== 'Base Price')
                  .map((b, i) => (
                    <div key={i}>
                      {b.price > 0 && b.isModifier ? `${b.optionName}: +${formatCurrency(b.price)}` : b.optionName}
                    </div>
                  ))}
              </div>
            )}
          </div>
          
          {/* Price column on the right */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {(item.discount || item.priceOverride) && (
              <>
                <div className="text-xs text-muted-foreground line-through">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </div>
                {item.discount && (
                  <div className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    -{item.discount.value}%
                  </div>
                )}
                {item.priceOverride && (
                  <div className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    OVERRIDE
                  </div>
                )}
              </>
            )}
            <div className={`font-bold text-sm ${item.discount ? 'text-primary' : item.priceOverride ? 'text-orange-600' : ''}`}>
              {formatCurrency(item.totalPrice)}
            </div>
            {item.quantity > 1 && (
              <div className="text-xs text-muted-foreground">
                {formatCurrency(item.totalPrice / item.quantity)} each
              </div>
            )}
            {/* Paid badge under price in payment mode */}
            {isPaid && (
              <div className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                {item.quantity === 1 ? 'Paid' : `${item.quantityPaid}/${item.quantity} paid`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
