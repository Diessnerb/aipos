-- Add payment tracking columns to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS quantity_paid integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
ADD COLUMN IF NOT EXISTS basket_item_id text;

COMMENT ON COLUMN order_items.quantity_paid IS 'Number of units of this item that have been paid for';
COMMENT ON COLUMN order_items.payment_status IS 'Payment status: unpaid (0 paid), partially_paid (some paid), paid (all paid)';
COMMENT ON COLUMN order_items.basket_item_id IS 'Links back to basket item ID for partial payment tracking';

-- Create payment_items junction table
CREATE TABLE IF NOT EXISTS payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  company_id uuid NOT NULL,
  CONSTRAINT payment_items_unique UNIQUE (payment_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_items_payment_id ON payment_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_items_order_item_id ON payment_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_payment_items_company_id ON payment_items(company_id);

COMMENT ON TABLE payment_items IS 'Links payments to specific order items for partial payments';

-- Enable RLS on payment_items
ALTER TABLE payment_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for payment_items
CREATE POLICY payment_items_company_isolation ON payment_items
  FOR ALL
  USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
  WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));