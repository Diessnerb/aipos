-- Fix existing orders that are fully paid but still marked as unpaid
UPDATE orders 
SET payment_status = 'paid', 
    status = 'paid',
    paid_at = NOW()
WHERE amount_paid >= total_amount 
  AND (payment_status != 'paid' OR status != 'paid');