import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PriceOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrice: number;
  onApply: (newPrice: number) => void;
}

export const PriceOverrideModal: React.FC<PriceOverrideModalProps> = ({
  open,
  onOpenChange,
  currentPrice,
  onApply,
}) => {
  const [newPrice, setNewPrice] = useState('');
  const [error, setError] = useState('');

  const handlePriceChange = (value: string) => {
    setNewPrice(value);
    
    const numValue = parseFloat(value);
    if (value && (isNaN(numValue) || numValue < 0)) {
      setError('Price must be 0 or greater');
    } else {
      setError('');
    }
  };

  const handlePresetClick = (multiplier: number) => {
    const price = currentPrice * multiplier;
    setNewPrice(price.toFixed(2));
    setError('');
  };

  const handleApply = () => {
    const price = parseFloat(newPrice);
    
    if (isNaN(price) || price < 0) {
      setError('Please enter a valid price');
      return;
    }

    onApply(price);
    
    // Reset state
    setNewPrice('');
    setError('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    setNewPrice('');
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Override Item Price</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Price Display */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Price:</span>
              <span className="text-xl font-semibold">£{currentPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* New Price Input */}
          <div>
            <Label htmlFor="new-price" className="text-sm font-medium mb-2 block">
              New Price (£)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                £
              </span>
              <Input
                id="new-price"
                type="number"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                className={`text-xl pl-8 h-14 ${error ? 'border-destructive' : ''}`}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Actions</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(0)}
                className="h-12"
              >
                Free<br />£0.00
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(0.5)}
                className="h-12"
              >
                Half Price<br />£{(currentPrice * 0.5).toFixed(2)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(2)}
                className="h-12"
              >
                Double<br />£{(currentPrice * 2).toFixed(2)}
              </Button>
            </div>
          </div>

          {/* Price Difference Preview */}
          {newPrice && !error && parseFloat(newPrice) !== currentPrice && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Price Change:
                </span>
                <span className={`text-lg font-bold ${
                  parseFloat(newPrice) > currentPrice
                    ? 'text-green-600'
                    : 'text-orange-600'
                }`}>
                  {parseFloat(newPrice) > currentPrice ? '+' : ''}
                  £{Math.abs(parseFloat(newPrice) - currentPrice).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Warning Badge */}
          <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
              <span className="font-semibold">⚠️ Price Override</span>
              <span>This will replace the original price</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={handleApply}
              disabled={!!error || !newPrice}
            >
              Apply Override
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
