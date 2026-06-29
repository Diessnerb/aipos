import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useSaveOrder } from '@/hooks/useSaveOrder';
import { supabase } from '@/integrations/supabase/client';

export const PaymentPanel = () => {
  const { 
    basketItems, 
    setBasketItems,
    total,
    originalTotal,
    splitBills,
    currentSplitIndex, 
    setCurrentSplitIndex, 
    clearBasket, 
    orderAssignment, 
    loadedOrderId, 
    scheduledFor, 
    setSplitBills,
    selectedItemsForPayment,
    getSelectedItemsTotal,
    clearSelectedItems,
  } = useOrderBasket();
  const [tenderedAmountPence, setTenderedAmountPence] = useState<number>(0);
  const [changeDue, setChangeDue] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentHistory, setPaymentHistory] = useState<Array<{amount: number, method: string, timestamp: Date, splitIndex?: number | null, totalSplits?: number | null}>>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { saveOrder } = useSaveOrder();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showChange, setShowChange] = useState<boolean>(false);
  const [paymentComplete, setPaymentComplete] = useState<boolean>(false);
  const [displayAmountPaid, setDisplayAmountPaid] = useState<number>(0);

  const currentTotal = splitBills.length > 0 ? splitBills[currentSplitIndex] : total;
  const isSplitBill = splitBills.length > 0;
  
  // Calculate effective total based on selected items or full total
  const hasItemSelection = selectedItemsForPayment.length > 0;
  const selectedItemsTotal = getSelectedItemsTotal();
  const effectiveTotal = hasItemSelection ? selectedItemsTotal : currentTotal;

  const handleKeypadPress = (value: string) => {
    if (value === '⌫') {
      setTenderedAmountPence(prev => Math.floor(prev / 10));
      return;
    }
    
    if (value === '00') {
      setTenderedAmountPence(prev => prev * 100);
      return;
    }
    
    // Regular digit (0-9)
    const digit = parseInt(value);
    if (!isNaN(digit)) {
      setTenderedAmountPence(prev => (prev * 10) + digit);
    }
  };

  const handleQuickTender = async (amount: number) => {
    // Set the tendered amount first so it displays on screen
    setTenderedAmountPence(amount * 100);
    // Then process the payment
    await processPayment(amount);
  };

  const processPayment = async (amount?: number) => {
    // Calculate the amount due for THIS transaction based on payment mode
    const dueThisTransaction = hasItemSelection
      ? getSelectedItemsTotal()                                    // Itemized: pay exactly what's selected
      : (isSplitBill
          ? Math.max(currentTotal - amountPaid, 0)                 // Split bill: pay what's left in current split
          : total);                                                // Full order: pay remaining balance
    
    const remainingBalance = parseFloat(dueThisTransaction.toFixed(2));
    const tendered = amount || (tenderedAmountPence / 100);
    
    // Defensive check: ensure we're calculating correctly for itemized payments
    if (hasItemSelection) {
      const debugTotal = selectedItemsForPayment.reduce((sum, selected) => {
        const item = basketItems.find(i => i.id === selected.basketItemId);
        if (!item) return sum;
        console.log(`Item: ${item.menuItem.name}, unitPrice: £${item.unitPrice}, qty: ${selected.quantitySelected}, subtotal: £${item.unitPrice * selected.quantitySelected}`);
        return sum + (item.unitPrice * selected.quantitySelected);
      }, 0);
      console.log(`🔍 Itemized Payment Debug: calculated total = £${debugTotal.toFixed(2)}, dueThisTransaction = £${remainingBalance.toFixed(2)}`);
    }
    
    if (tendered <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    if (tendered < remainingBalance) {
      toast({
        title: "Insufficient Payment",
        description: `£${remainingBalance.toFixed(2)} remaining. Tendered: £${tendered.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const change = tendered - remainingBalance;
    const newAmountPaid = amountPaid + remainingBalance;

    // Check if order will be fully paid after this transaction
    const epsilon = 0.001;
    const isFullyPaidByAmount = (newAmountPaid + epsilon) >= originalTotal;
    
    // Check if all individual items will be marked as paid after this transaction
    const willAllItemsBePaidAfterThisTxn = basketItems.every(item => {
      if (hasItemSelection) {
        // Itemized payment with selection: check if selected quantities cover remaining
        const selected = selectedItemsForPayment.find(s => s.basketItemId === item.id);
        const paidAfter = (item.quantityPaid || 0) + (selected?.quantitySelected || 0);
        return paidAfter >= item.quantity;
      } else {
        // Payment without selection: all unpaid items will be marked as paid if we're paying enough
        const unpaidQty = item.quantity - (item.quantityPaid || 0);
        // Item is complete if: already fully paid OR we're paying the full remaining amount
        return unpaidQty === 0 || isFullyPaidByAmount;
      }
    });

    console.log('💰 Payment Processing:', {
      originalTotal,
      total_remaining_from_context: total,
      amountPaid_state_before: amountPaid,
      dueThisTransaction: remainingBalance,
      newAmountPaid_cumulative: newAmountPaid,
      tendered,
      change,
      isFullyPaidByAmount,
      willAllItemsBePaidAfterThisTxn,
      hasItemSelection,
      freshSelectedItemsTotal: getSelectedItemsTotal(),
    });

    try {
      // Get company ID
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user?.id)
        .single();

      if (!userData?.company_id) throw new Error('Company ID not found');

      let orderId = loadedOrderId;
      
      // Create or update order if not exists
      if (!orderId) {
        const { orderId: newOrderId } = await saveOrder({
          basketItems,
          total,
          orderAssignment,
          status: 'unpaid',
          userId: user?.id,
          scheduledFor,
        });
        orderId = newOrderId;
      }

      // Insert payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount: remainingBalance,
          method: amount ? 'card' : 'cash',
          paid_at: new Date().toISOString(),
          paid_by: user?.id,
        })
        .select('id')
        .single();

      if (paymentError) throw paymentError;
      const paymentId = paymentData.id;

      // If items were selected, record item-level payments
      if (hasItemSelection && selectedItemsForPayment.length > 0) {
        // Fetch order items to get their IDs
        const { data: orderItemsData, error: fetchError } = await supabase
          .from('order_items')
          .select('id, basket_item_id, quantity, quantity_paid')
          .eq('order_id', orderId!)
          .in('basket_item_id', selectedItemsForPayment.map(s => s.basketItemId));

        if (fetchError) throw fetchError;

        // Create payment_items records
        const paymentItemsToInsert = selectedItemsForPayment.map(selected => {
          const orderItem = orderItemsData?.find(oi => oi.basket_item_id === selected.basketItemId);
          if (!orderItem) return null;

          const basketItem = basketItems.find(bi => bi.id === selected.basketItemId);
          if (!basketItem) return null;

          return {
            payment_id: paymentId,
            order_item_id: orderItem.id,
            quantity: selected.quantitySelected,
            amount: basketItem.unitPrice * selected.quantitySelected,
            company_id: userData.company_id,
          };
        }).filter(Boolean);

        if (paymentItemsToInsert.length > 0) {
          const { error: paymentItemsError } = await supabase
            .from('payment_items')
            .insert(paymentItemsToInsert);

          if (paymentItemsError) throw paymentItemsError;
        }

        // Update order_items quantity_paid and payment_status
        for (const selected of selectedItemsForPayment) {
          const orderItem = orderItemsData?.find(oi => oi.basket_item_id === selected.basketItemId);
          if (!orderItem) continue;

          const newQuantityPaid = (orderItem.quantity_paid || 0) + selected.quantitySelected;
          const newPaymentStatus = 
            newQuantityPaid >= orderItem.quantity ? 'paid' : 
            newQuantityPaid > 0 ? 'partially_paid' : 'unpaid';

          await supabase
            .from('order_items')
            .update({ 
              quantity_paid: newQuantityPaid,
              payment_status: newPaymentStatus 
            })
            .eq('id', orderItem.id);
        }

        // Update local basket items with new quantityPaid
        setBasketItems(prev => prev.map(item => {
          const selected = selectedItemsForPayment.find(s => s.basketItemId === item.id);
          if (!selected) return item;
          return {
            ...item,
            quantityPaid: (item.quantityPaid || 0) + selected.quantitySelected
          };
        }));

        // Clear selection after successful payment
        clearSelectedItems();
      }

      // Update order amount_paid and payment status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          amount_paid: newAmountPaid,
          status: newAmountPaid >= originalTotal ? 'paid' : 'unpaid',
          payment_status: newAmountPaid >= originalTotal ? 'paid' : 'unpaid',
          paid_at: newAmountPaid >= originalTotal ? new Date().toISOString() : null
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Update payment history
      setPaymentHistory(prev => [...prev, {
        amount: remainingBalance,
        method: amount ? 'card' : 'cash',
        timestamp: new Date(),
        splitIndex: isSplitBill ? currentSplitIndex : null,
        totalSplits: isSplitBill ? splitBills.length : null,
      }]);

      setAmountPaid(newAmountPaid);

      // Invalidate orders query to refresh list
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      if (change > 0) {
        setChangeDue(change);
        setShowChange(true);
        
        if (isSplitBill && currentSplitIndex < splitBills.length - 1) {
          // Intermediate split with change
          toast({
            title: `Split ${currentSplitIndex + 1} Paid`,
            description: `Change: £${change.toFixed(2)}. Next split: £${splitBills[currentSplitIndex + 1].toFixed(2)}`,
          });
          
          // User will manually dismiss change screen to advance
        } else {
          // Check if order is fully paid - either by total amount OR all items paid
          const isFullyPaid = isFullyPaidByAmount || willAllItemsBePaidAfterThisTxn;
          
          if (isFullyPaid) {
            // Order fully paid - mark as complete so tap-to-continue will clear basket
            setPaymentComplete(true);
            toast({
              title: "Order Complete",
              description: `Change: £${change.toFixed(2)}. Tap to continue.`,
            });
          } else {
            // Partial payment with change
            // Calculate actual remaining: sum of unpaid items
            const remainingToPay = basketItems.reduce((sum, item) => {
              const unpaidQty = item.quantity - (item.quantityPaid || 0);
              return sum + (unpaidQty * item.unitPrice);
            }, 0);
            toast({
              title: "Payment Recorded",
              description: `Change: £${change.toFixed(2)}. Remaining: £${remainingToPay.toFixed(2)}`,
            });
          }
        }
      } else {
        // No change due
        if (isSplitBill && currentSplitIndex < splitBills.length - 1) {
          // Intermediate split without change - advance immediately
          toast({
            title: `Split ${currentSplitIndex + 1} Paid`,
            description: `Moving to split ${currentSplitIndex + 2}`,
          });
          setCurrentSplitIndex(currentSplitIndex + 1);
          setAmountPaid(0);
          setDisplayAmountPaid(0);
          setIsProcessing(false);
        } else {
          // Final payment or itemized payment
          const isFullyPaid = isFullyPaidByAmount || willAllItemsBePaidAfterThisTxn;
          
          if (isFullyPaid) {
            // Order fully paid - complete transaction immediately (no change screen)
            setPaymentComplete(true);
            setDisplayAmountPaid(newAmountPaid);
            toast({
              title: "Order Complete",
              description: "Payment processed successfully",
            });
            completeTransaction();
          } else {
            // Partial payment - keep basket and reset for next payment
            const remainingToPay = originalTotal - newAmountPaid;
            setDisplayAmountPaid(newAmountPaid);
            setIsProcessing(false);
            setTenderedAmountPence(0);
            toast({
              title: "Payment Recorded",
              description: `£${remainingBalance.toFixed(2)} paid. Remaining: £${remainingToPay.toFixed(2)}`,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const completeTransaction = () => {
    clearBasket();
    setTenderedAmountPence(0);
    setChangeDue(0);
    setAmountPaid(0);
    setDisplayAmountPaid(0);
    setPaymentHistory([]);
    setIsProcessing(false);
    setShowChange(false);
    setPaymentComplete(false);
  };

  // Load existing payments when order is loaded
  useEffect(() => {
    if (loadedOrderId) {
      const fetchPayments = async () => {
        const { data: orderData } = await supabase
          .from('orders')
          .select('amount_paid, total_amount')
          .eq('id', loadedOrderId)
          .single();
        
        if (orderData) {
          setAmountPaid(orderData.amount_paid || 0);
          setDisplayAmountPaid(orderData.amount_paid || 0);
        }
        
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('amount, method, paid_at, split_index, total_splits, split_amount')
          .eq('order_id', loadedOrderId)
          .order('paid_at', { ascending: true });
        
        if (paymentsData) {
          setPaymentHistory(paymentsData.map(p => ({
            amount: p.amount,
            method: p.method,
            timestamp: new Date(p.paid_at),
            splitIndex: p.split_index,
            totalSplits: p.total_splits,
          })));
          
          // If there are split payments, reconstruct splitBills and currentSplitIndex
          const splitPayments = paymentsData.filter(p => p.total_splits !== null);
          if (splitPayments.length > 0) {
            const totalSplits = splitPayments[0].total_splits!;
            const paidSplitIndices = new Set(splitPayments.map(p => p.split_index!));
            
            // Find next unpaid split
            let nextUnpaidIndex = 0;
            for (let i = 0; i < totalSplits; i++) {
              if (!paidSplitIndices.has(i)) {
                nextUnpaidIndex = i;
                break;
              }
            }
            
            // Reconstruct split bills from payment records
            const bills = Array(totalSplits).fill(0).map((_, i) => {
              const payment = splitPayments.find(p => p.split_index === i);
              return payment?.split_amount || 0;
            });
            
            setSplitBills(bills);
            setCurrentSplitIndex(nextUnpaidIndex);
          }
        }
      };
      
      fetchPayments();
    } else {
      setAmountPaid(0);
      setDisplayAmountPaid(0);
      setPaymentHistory([]);
    }
  }, [loadedOrderId, setSplitBills, setCurrentSplitIndex]);

  const gridItems = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['⌫', '0', '00'],
  ];

  return (
    <Card className="h-full flex flex-col relative">
      {/* Dismissal Overlay - shown when change is displayed */}
      {showChange && (
        <div 
          className="absolute inset-0 z-50 cursor-pointer bg-black/10 backdrop-blur-[1px] rounded-lg"
          onClick={() => {
            setShowChange(false);
            setDisplayAmountPaid(amountPaid);
            setTenderedAmountPence(0);
            
            if (paymentComplete) {
              // Final payment - clear everything
              completeTransaction();
            } else if (isSplitBill && currentSplitIndex < splitBills.length - 1) {
              // Intermediate split - advance to next
              setCurrentSplitIndex(currentSplitIndex + 1);
              setTenderedAmountPence(0);
              setAmountPaid(0);
              setDisplayAmountPaid(0);
              setIsProcessing(false);
            } else {
              // Partial payment - just dismiss and reset
              setTenderedAmountPence(0);
              setIsProcessing(false);
            }
          }}
        />
      )}

      {/* Change Due Display - Above blur overlay */}
      {showChange && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none">
          <div className="bg-card border-2 border-primary rounded-lg p-8 shadow-2xl">
            <div className="text-sm text-muted-foreground mb-2 text-center">Change Due</div>
            <div className="text-5xl font-bold text-primary text-center">
              £{changeDue.toFixed(2)}
            </div>
          </div>
          <div className="text-center mt-4 text-lg font-semibold text-foreground">
            Tap anywhere to continue
          </div>
        </div>
      )}

      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-xl">Payment</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6 gap-6">
        {/* Split Bill Progress Indicator */}
        {isSplitBill && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold text-primary">
                  Split Payment {currentSplitIndex + 1} of {splitBills.length}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {currentSplitIndex} paid, {splitBills.length - currentSplitIndex} remaining
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  £{currentTotal.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  this split
                </div>
              </div>
            </div>
            <div className="flex gap-1 mb-2">
              {splitBills.map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-2 rounded ${
                    index < currentSplitIndex
                      ? 'bg-green-500'
                      : index === currentSplitIndex
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Split amounts: {splitBills.map((amount, idx) => (
                <span key={idx} className={idx === currentSplitIndex ? 'font-semibold text-primary' : ''}>
                  £{amount.toFixed(2)}
                  {idx < splitBills.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        )}


        {/* Amount Display */}
        {hasItemSelection ? (
          // 2-column layout for itemized payments
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">
                Amount Tendered
              </div>
              <div className="text-3xl font-bold">£{(tenderedAmountPence / 100).toFixed(2)}</div>
            </div>
            
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="text-xs text-primary font-medium">
                Item Total ({selectedItemsForPayment.reduce((sum, s) => sum + s.quantitySelected, 0)} items)
              </div>
              <div className="text-3xl font-bold text-primary">£{selectedItemsTotal.toFixed(2)}</div>
            </div>
          </div>
        ) : !hasItemSelection && displayAmountPaid > 0 ? (
          // 3-column grid for partial payments
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="text-xs text-green-600 dark:text-green-400">Paid So Far</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">£{displayAmountPaid.toFixed(2)}</div>
            </div>
            
            <div className="bg-primary/10 rounded-lg p-4">
              <div className="text-xs text-muted-foreground">Remaining Balance</div>
              <div className="text-2xl font-bold text-primary">£{effectiveTotal.toFixed(2)}</div>
            </div>
            
            <div className="bg-card border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">
                Amount Tendered
              </div>
              <div className="text-xl font-bold">£{(tenderedAmountPence / 100).toFixed(2)}</div>
            </div>
          </div>
        ) : (
          // Single box when no payments made yet
          <div className="bg-card border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">
              Amount Tendered
            </div>
            <div className="text-3xl font-bold">£{(tenderedAmountPence / 100).toFixed(2)}</div>
          </div>
        )}

        {/* Two Column Layout: Keypad and Actions */}
        <div className="flex-1 grid grid-cols-[1.5fr,1fr] gap-4">
          {/* Left Column - Keypad */}
          <div className="grid grid-cols-3 grid-rows-4 gap-2 h-full">
            {gridItems.map((row, rowIndex) =>
              row.map((item, colIndex) => (
                <Button
                  key={`${rowIndex}-${colIndex}`}
                  variant="outline"
                  className="h-full text-xl font-bold"
                  onClick={() => handleKeypadPress(item)}
                  disabled={isProcessing || paymentComplete}
                >
                  {item}
                </Button>
              ))
            )}
          </div>

          {/* Right Column - Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => handleQuickTender(5)}
              className="flex-1 text-lg font-semibold"
              disabled={isProcessing || paymentComplete}
            >
              Pay £5
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleQuickTender(10)}
              className="flex-1 text-lg font-semibold"
              disabled={isProcessing || paymentComplete}
            >
              Pay £10
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleQuickTender(20)}
              className="flex-1 text-lg font-semibold"
              disabled={isProcessing || paymentComplete}
            >
              Pay £20
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-lg font-semibold"
              onClick={() => processPayment()}
              disabled={tenderedAmountPence === 0 || isProcessing || paymentComplete}
            >
              {isProcessing ? 'Processing...' : 'Cash'}
            </Button>
            <Button
              variant="default"
              className="flex-1 text-lg font-semibold"
              onClick={() => processPayment(currentTotal)}
              disabled={isProcessing || paymentComplete}
            >
              Card
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
