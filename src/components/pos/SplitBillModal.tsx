import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface SplitBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SplitBillModal = ({ open, onOpenChange }: SplitBillModalProps) => {
  const { total, setSplitBills, setCurrentSplitIndex, setPaymentMode } = useOrderBasket();
  
  const [splitMode, setSplitMode] = useState<'main' | 'custom-number' | 'custom-percentage'>('main');
  const [customNumberValue, setCustomNumberValue] = useState(2);
  const [percentageSplits, setPercentageSplits] = useState([
    { id: 1, percentage: 50 },
    { id: 2, percentage: 50 },
  ]);

  const formatCurrency = (value: number) => `£${value.toFixed(2)}`;

  useEffect(() => {
    if (!open) {
      setSplitMode('main');
      setCustomNumberValue(2);
      setPercentageSplits([
        { id: 1, percentage: 50 },
        { id: 2, percentage: 50 },
      ]);
    }
  }, [open]);

  const handleSplit = (ways: number) => {
    // Calculate base amount (rounded down to nearest penny)
    const baseAmount = Math.floor((total * 100) / ways) / 100;
    
    // Calculate remainder in pence to distribute
    const totalPence = Math.round(total * 100);
    const baseAmountPence = Math.round(baseAmount * 100);
    const remainder = totalPence - (baseAmountPence * ways);
    
    // Create bills array - first bills get extra penny if needed
    const bills = Array(ways).fill(0).map((_, index) => {
      if (index < remainder) {
        return baseAmount + 0.01;
      }
      return baseAmount;
    });
    
    setSplitBills(bills);
    setCurrentSplitIndex(0);
    setPaymentMode(true); // Activate payment mode
    onOpenChange(false);
  };

  const addPercentageSplit = () => {
    setPercentageSplits([...percentageSplits, { id: Date.now(), percentage: 0 }]);
  };

  const removePercentageSplit = (id: number) => {
    if (percentageSplits.length > 2) {
      setPercentageSplits(percentageSplits.filter(s => s.id !== id));
    }
  };

  const updatePercentage = (id: number, percentage: number) => {
    setPercentageSplits(percentageSplits.map(s => 
      s.id === id ? { ...s, percentage } : s
    ));
  };

  const totalPercentage = percentageSplits.reduce((sum, s) => sum + s.percentage, 0);

  const handlePercentageSplit = () => {
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error('Percentages must add up to 100%');
      return;
    }
    
    const bills = percentageSplits.map(split => {
      return Math.round((total * split.percentage) / 100 * 100) / 100;
    });
    
    setSplitBills(bills);
    setCurrentSplitIndex(0);
    setPaymentMode(true);
    onOpenChange(false);
  };

  const splitOptions = [
    { ways: 2, label: '2-Way' },
    { ways: 3, label: '3-Way' },
    { ways: 4, label: '4-Way' },
    { ways: 5, label: '5-Way' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {splitMode === 'main' && (
          <>
            <DialogHeader>
              <DialogTitle>Split Order</DialogTitle>
              <DialogDescription>
                Select how many ways to split the bill. Total: {formatCurrency(total)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              {splitOptions.map(({ ways, label }) => {
                const perPerson = total / ways;
                return (
                  <Button
                    key={ways}
                    onClick={() => handleSplit(ways)}
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center space-y-2"
                  >
                    <span className="text-lg font-bold">{label}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(perPerson)} each
                    </span>
                  </Button>
                );
              })}
              
              <Button
                onClick={() => setSplitMode('custom-number')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2"
              >
                <span className="text-lg font-bold">Custom</span>
                <span className="text-sm text-muted-foreground">By Number</span>
              </Button>
              
              <Button
                onClick={() => setSplitMode('custom-percentage')}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2"
              >
                <span className="text-lg font-bold">Custom %</span>
                <span className="text-sm text-muted-foreground">By Percent</span>
              </Button>
            </div>
          </>
        )}

        {splitMode === 'custom-number' && (
          <>
            <DialogHeader>
              <DialogTitle>Custom Split by Number</DialogTitle>
              <DialogDescription>
                Enter the number of people to split the bill. Total: {formatCurrency(total)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label>Number of People</Label>
                <Input
                  type="number"
                  min="2"
                  max="50"
                  value={customNumberValue}
                  onChange={(e) => setCustomNumberValue(Number(e.target.value))}
                  placeholder="e.g., 8"
                />
              </div>
              
              {customNumberValue >= 2 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Amount per person:</p>
                  <p className="text-2xl font-bold">{formatCurrency(total / customNumberValue)}</p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSplitMode('main')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={() => handleSplit(customNumberValue)} 
                  disabled={customNumberValue < 2}
                  className="flex-1"
                >
                  Split {customNumberValue} Ways
                </Button>
              </div>
            </div>
          </>
        )}

        {splitMode === 'custom-percentage' && (
          <>
            <DialogHeader>
              <DialogTitle>Custom Split by Percentage</DialogTitle>
              <DialogDescription>
                Specify what percentage each person pays. Total: {formatCurrency(total)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
              {percentageSplits.map((split, index) => (
                <div key={split.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label>Person {index + 1}</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={split.percentage}
                        onChange={(e) => updatePercentage(split.id, Number(e.target.value))}
                        placeholder="50"
                      />
                      <span className="text-sm">%</span>
                      <span className="text-sm font-medium w-20">
                        {formatCurrency((total * split.percentage) / 100)}
                      </span>
                    </div>
                  </div>
                  {percentageSplits.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePercentageSplit(split.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={addPercentageSplit}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Person
              </Button>
              
              <div className={`p-4 rounded-lg ${
                Math.abs(totalPercentage - 100) < 0.01 
                  ? 'bg-green-100 dark:bg-green-900/20' 
                  : 'bg-red-100 dark:bg-red-900/20'
              }`}>
                <p className="text-sm font-medium">
                  Total: {totalPercentage.toFixed(2)}%
                  {Math.abs(totalPercentage - 100) < 0.01 ? ' ✓' : ' (must equal 100%)'}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSplitMode('main')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handlePercentageSplit}
                  disabled={Math.abs(totalPercentage - 100) > 0.01}
                  className="flex-1"
                >
                  Split by Percentage
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
