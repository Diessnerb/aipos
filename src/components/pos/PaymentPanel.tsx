import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { useToast } from '@/hooks/use-toast';
import { CreditCard } from 'lucide-react';

export const PaymentPanel = () => {
  const { total, splitBills, currentSplitIndex, setCurrentSplitIndex, clearBasket, setPaymentMode, setSplitBills } = useOrderBasket();
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [changeDue, setChangeDue] = useState<number | null>(null);
  const { toast } = useToast();

  // Get the current bill amount (either full total or split amount)
  const currentBillAmount = splitBills.length > 0 ? splitBills[currentSplitIndex] : total;
  const isSplitBill = splitBills.length > 0;
  const remainingBills = splitBills.length - currentSplitIndex;

  const formatCurrency = (value: number) => `£${value.toFixed(2)}`;

  const handleKeypadPress = (value: string) => {
    if (changeDue !== null) return; // Don't allow input after payment is complete
    
    if (value === 'C') {
      setTenderedAmount('');
    } else if (value === '.') {
      if (!tenderedAmount.includes('.')) {
        setTenderedAmount(prev => prev + value);
      }
    } else {
      setTenderedAmount(prev => prev + value);
    }
  };

  const handleQuickTender = (amount: number) => {
    if (changeDue !== null) return; // Don't allow new payment if one is complete
    setTenderedAmount(amount.toFixed(2));
    // Immediately process the payment with this amount
    processPayment(amount);
  };

  const processPayment = (amount?: number) => {
    const tender = amount !== undefined ? amount : parseFloat(tenderedAmount);
    
    if (isNaN(tender) || tender <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid tender amount.",
        variant: "destructive",
      });
      return;
    }

    if (tender < currentBillAmount) {
      toast({
        title: "Insufficient Funds",
        description: `Tendered amount (${formatCurrency(tender)}) is less than the bill (${formatCurrency(currentBillAmount)}).`,
        variant: "destructive",
      });
      return;
    }

    const change = tender - currentBillAmount;
    setChangeDue(change);

    // Show change due message
    toast({
      title: "Payment Successful",
      description: change > 0 
        ? `Change due: ${formatCurrency(change)}` 
        : "Exact amount received.",
    });

    // Handle split bill progression or complete transaction
    setTimeout(() => {
      if (isSplitBill && currentSplitIndex < splitBills.length - 1) {
        // Move to next split bill
        setCurrentSplitIndex(currentSplitIndex + 1);
        setTenderedAmount('');
        setChangeDue(null);
        toast({
          title: "Next Split Bill",
          description: `Bill ${currentSplitIndex + 2} of ${splitBills.length}: ${formatCurrency(splitBills[currentSplitIndex + 1])}`,
        });
      } else {
        // All bills paid - complete transaction
        completeTransaction();
      }
    }, 2000);
  };

  const completeTransaction = () => {
    toast({
      title: "Transaction Complete",
      description: "Order has been successfully paid.",
    });
    
    // Reset all state and return to POS view
    clearBasket();
    setSplitBills([]);
    setCurrentSplitIndex(0);
    setPaymentMode(false);
    setTenderedAmount('');
    setChangeDue(null);
  };

  const handleCardPayment = () => {
    toast({
      title: "Card Payment",
      description: "Card API integration pending. This payment type is currently for display only.",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4 border-b">
        <CardTitle className="text-2xl">Payment</CardTitle>
        {isSplitBill && (
          <p className="text-sm text-muted-foreground mt-1">
            Bill {currentSplitIndex + 1} of {splitBills.length} {remainingBills > 1 && `(${remainingBills - 1} remaining)`}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6 space-y-4">
        {/* Amount Tendered Display - Full Width */}
        <div className="bg-background border-2 rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Amount Tendered</p>
          <p className="text-5xl font-bold text-primary min-h-[60px] flex items-center justify-center">
            {tenderedAmount ? `£${tenderedAmount}` : '£0.00'}
          </p>
        </div>

        {/* Change Due Display */}
        {changeDue !== null && (
          <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-4 text-center animate-fade-in">
            <p className="text-sm text-green-700 dark:text-green-400 mb-1">Change Due</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(changeDue)}
            </p>
          </div>
        )}

        {/* Main 2-Column Layout: Keypad (left) + Action Buttons (right) */}
        <div className="grid grid-cols-[1fr_auto] gap-1.5 flex-1">
          
          {/* LEFT COLUMN: Keypad (3x4 grid) */}
          <div className="grid grid-cols-3 gap-1.5 h-full">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '.'].map((key) => (
              <Button
                key={key}
                onClick={() => handleKeypadPress(key)}
                variant="outline"
                size="lg"
                className="h-full text-2xl font-semibold"
                disabled={changeDue !== null}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* RIGHT COLUMN: Action Buttons (stacked vertically) */}
          <div className="flex flex-col gap-1.5 w-[200px]">
            {/* Quick Tender Buttons */}
            <Button
              onClick={() => handleQuickTender(5)}
              variant="outline"
              size="lg"
              className="h-16 text-lg font-semibold"
              disabled={changeDue !== null}
            >
              £5.00
            </Button>
            <Button
              onClick={() => handleQuickTender(10)}
              variant="outline"
              size="lg"
              className="h-16 text-lg font-semibold"
              disabled={changeDue !== null}
            >
              £10.00
            </Button>
            <Button
              onClick={() => handleQuickTender(20)}
              variant="outline"
              size="lg"
              className="h-16 text-lg font-semibold"
              disabled={changeDue !== null}
            >
              £20.00
            </Button>

            {/* Clear Button */}
            <Button
              onClick={() => handleKeypadPress('C')}
              variant="destructive"
              size="lg"
              className="h-16 text-lg font-semibold"
              disabled={changeDue !== null}
            >
              Clear (C)
            </Button>

            {/* Card Button */}
            <Button
              onClick={handleCardPayment}
              variant="outline"
              size="lg"
              className="h-16 text-lg font-semibold"
              disabled={changeDue !== null}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              CARD
            </Button>

            {/* Cash/Amount Tendered Button */}
            <Button
              onClick={() => processPayment()}
              variant="default"
              size="lg"
              className="h-16 text-lg font-semibold bg-slate-900 hover:bg-slate-800"
              disabled={changeDue !== null}
            >
              CASH / AMOUNT TENDERED
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
