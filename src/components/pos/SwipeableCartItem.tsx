import React, { useState, useRef, useEffect } from 'react';
import { Percent, PoundSterling, Trash2, Loader2 } from 'lucide-react';
import { BasketItem } from '@/contexts/OrderBasketContext';
import { OrderBasketItemCard } from './OrderBasketItemCard';
import { DiscountModal } from './DiscountModal';
import { PriceOverrideModal } from './PriceOverrideModal';
import { WastageReasonDialog } from './WastageReasonDialog';
import { CourseType } from '@/contexts/OrderBasketContext';
import { useProcessWastage } from '@/hooks/useProcessWastage';
import { toast } from '@/hooks/use-toast';

interface SwipeableCartItemProps {
  item: BasketItem;
  isPaymentMode: boolean;
  isSelected: boolean;
  quantitySelected: number;
  onItemClick: (item: BasketItem) => void;
  onRemove: (basketItemId: string) => void;
  onUpdateQuantity: (basketItemId: string, newQuantity: number) => void;
  onCourseChange: (itemId: string, currentCourse: CourseType) => void;
  formatCurrency: (value: number) => string;
  onDiscount: (itemId: string, discount: number) => void;
  onPriceOverride: (itemId: string, newPrice: number) => void;
}

export const SwipeableCartItem: React.FC<SwipeableCartItemProps> = ({
  item,
  isPaymentMode,
  isSelected,
  quantitySelected,
  onItemClick,
  onRemove,
  onUpdateQuantity,
  onCourseChange,
  formatCurrency,
  onDiscount,
  onPriceOverride,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showWastageDialog, setShowWastageDialog] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef(false);

  const MAX_SLIDE = -270;
  const SNAP_THRESHOLD = -135;
  
  const { processItemAsWastage, isProcessing } = useProcessWastage();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        // Click outside - close card
        if (translateX < 0) {
          setTranslateX(0);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [translateX]);

  const handleStart = (clientX: number) => {
    if (isPaymentMode) return; // Disable swipe in payment mode
    setIsDragging(true);
    hasMovedRef.current = false; // Reset movement flag
    startXRef.current = clientX;
    currentXRef.current = translateX;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    
    const deltaX = clientX - startXRef.current;
    
    // Track if there's significant movement (more than 5px indicates a swipe, not a click)
    if (Math.abs(deltaX) > 5) {
      hasMovedRef.current = true;
    }
    
    const newTranslateX = Math.max(MAX_SLIDE, Math.min(0, currentXRef.current + deltaX));
    setTranslateX(newTranslateX);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // Snap logic
    if (translateX <= SNAP_THRESHOLD) {
      setTranslateX(MAX_SLIDE);
    } else {
      setTranslateX(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setTranslateX(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  const handleDiscountClick = () => {
    setShowDiscountModal(true);
    setTranslateX(0); // Close swipe
  };

  const handlePriceClick = () => {
    setShowPriceModal(true);
    setTranslateX(0); // Close swipe
  };

  const handleApplyDiscount = (discount: number) => {
    onDiscount(item.id, discount);
    setShowDiscountModal(false);
  };

  const handleApplyPriceOverride = (newPrice: number) => {
    onPriceOverride(item.id, newPrice);
    setShowPriceModal(false);
  };

  const handleWastageClick = () => {
    setShowWastageDialog(true);
    setTranslateX(0); // Close swipe
  };

  const handleWastageConfirm = async (reason: string, notes: string) => {
    setShowWastageDialog(false);
    
    try {
      const result = await processItemAsWastage(item, 'kitchen', reason, notes);
      
      if (result.success) {
        toast({
          title: "Logged to wastage",
          description: `${result.ingredientsLogged} ingredients, £${result.totalCost.toFixed(2)} cost`,
        });
        
        // Remove item from basket
        onRemove(item.id);
      }
    } catch (error) {
      console.error('Failed to log wastage:', error);
      toast({
        title: "Failed to log wastage",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCardClick = (item: BasketItem) => {
    // Only trigger click if no significant movement occurred (not a swipe)
    if (!hasMovedRef.current) {
      onItemClick(item);
    }
  };

  return (
    <>
      <div 
        ref={cardRef}
        className="relative"
        style={{ touchAction: isPaymentMode ? 'auto' : 'pan-y' }}
      >
        {/* Action buttons panel - behind the card */}
        {!isPaymentMode && translateX < 0 && (
          <div className="absolute right-0 top-0 w-[270px] h-full flex flex-row">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDiscountClick();
              }}
              className="flex-1 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E8E] text-white flex flex-col items-center justify-center gap-1 transition-all hover:opacity-90 hover:scale-105"
              aria-label="Apply discount"
            >
              <Percent className="h-5 w-5" />
              <span className="text-xs font-semibold">Discount</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePriceClick();
              }}
              className="flex-1 bg-gradient-to-r from-[#4ECDC4] to-[#45B7AF] text-white flex flex-col items-center justify-center gap-1 transition-all hover:opacity-90 hover:scale-105"
              aria-label="Change price"
            >
              <PoundSterling className="h-5 w-5" />
              <span className="text-xs font-semibold">Price</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleWastageClick();
              }}
              disabled={isProcessing}
              className={`flex-1 bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white flex flex-col items-center justify-center gap-1 transition-all ${
                isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:scale-105'
              }`}
              aria-label="Log as wastage"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
              <span className="text-xs font-semibold">
                {isProcessing ? 'Logging...' : 'Wastage'}
              </span>
            </button>
          </div>
        )}

        {/* Card - slides over the buttons */}
        <div
          className={`relative z-10 bg-background transition-transform ${
            isDragging ? 'duration-0' : 'duration-300'
          } ${isDragging ? 'cursor-grabbing' : isPaymentMode ? 'cursor-default' : 'cursor-grab'}`}
          style={{
            transform: `translateX(${translateX}px)`,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <OrderBasketItemCard
            item={item}
            isPaymentMode={isPaymentMode}
            isSelected={isSelected}
            quantitySelected={quantitySelected}
            onItemClick={handleCardClick}
            onRemove={onRemove}
            onUpdateQuantity={onUpdateQuantity}
            onCourseChange={onCourseChange}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* Modals */}
      <DiscountModal
        open={showDiscountModal}
        onOpenChange={setShowDiscountModal}
        currentPrice={item.unitPrice}
        onApply={handleApplyDiscount}
      />
      <PriceOverrideModal
        open={showPriceModal}
        onOpenChange={setShowPriceModal}
        currentPrice={item.unitPrice}
        onApply={handleApplyPriceOverride}
      />

      <WastageReasonDialog
        open={showWastageDialog}
        onOpenChange={setShowWastageDialog}
        basketItem={item}
        onConfirm={handleWastageConfirm}
      />
    </>
  );
};
