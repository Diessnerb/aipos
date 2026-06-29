import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';

interface DiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrice: number;
  onApply: (discountPercentage: number) => void;
}

const PRESET_DISCOUNTS = [10, 25, 50, 100];

export const DiscountModal: React.FC<DiscountModalProps> = ({
  open,
  onOpenChange,
  currentPrice,
  onApply,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customDiscount, setCustomDiscount] = useState('');
  const [error, setError] = useState('');

  const handlePresetClick = (discount: number) => {
    setSelectedPreset(discount);
    setCustomDiscount('');
    setError('');
  };

  const handleCustomChange = (value: string) => {
    setCustomDiscount(value);
    setSelectedPreset(null);
    
    const numValue = parseFloat(value);
    if (value && (isNaN(numValue) || numValue < 0 || numValue > 100)) {
      setError('Discount must be between 0 and 100');
    } else {
      setError('');
    }
  };

  const handleApply = () => {
    const discount = selectedPreset !== null ? selectedPreset : parseFloat(customDiscount);
    
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setError('Please select or enter a valid discount');
      return;
    }

    onApply(discount);
    
    // Reset state
    setSelectedPreset(null);
    setCustomDiscount('');
    setError('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedPreset(null);
    setCustomDiscount('');
    setError('');
  };

  const activeDiscount = selectedPreset !== null ? selectedPreset : parseFloat(customDiscount) || 0;
  const discountedPrice = currentPrice * (1 - activeDiscount / 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Apply Discount</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preset Discount Grid */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Quick Discounts</Label>
            <div className="grid grid-cols-2 gap-3">
              {PRESET_DISCOUNTS.map((discount) => (
                <Button
                  key={discount}
                  type="button"
                  variant={selectedPreset === discount ? 'default' : 'outline'}
                  className={`h-20 text-lg font-semibold transition-all ${
                    selectedPreset === discount
                      ? 'bg-primary text-primary-foreground scale-105'
                      : 'hover:scale-105'
                  }`}
                  onClick={() => handlePresetClick(discount)}
                >
                  {selectedPreset === discount && (
                    <Check className="h-5 w-5 mr-2" />
                  )}
                  {discount}%
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Discount Input */}
          <div>
            <Label htmlFor="custom-discount" className="text-sm font-medium mb-2 block">
              Custom Discount (%)
            </Label>
            <div className="relative">
              <Input
                id="custom-discount"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={customDiscount}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="Enter percentage"
                className={`text-right pr-8 ${error ? 'border-destructive' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          {/* Price Preview */}
          {activeDiscount > 0 && !error && (
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Original Price:</span>
                <span className="line-through text-muted-foreground">
                  £{currentPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Discounted Price:</span>
                <span className="text-2xl font-bold text-primary">
                  £{discountedPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">You save:</span>
                <span className="text-green-600 font-semibold">
                  £{(currentPrice - discountedPrice).toFixed(2)} ({activeDiscount}%)
                </span>
              </div>
            </div>
          )}

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
              className="flex-1"
              onClick={handleApply}
              disabled={!!error || (selectedPreset === null && !customDiscount)}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
