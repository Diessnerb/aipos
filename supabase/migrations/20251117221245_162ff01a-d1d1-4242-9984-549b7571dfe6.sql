-- Create delivery_orders table
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_delivery_date TIMESTAMP WITH TIME ZONE,
  actual_delivery_date TIMESTAMP WITH TIME ZONE,
  total_cost DECIMAL(10,2),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery_order_items table
CREATE TABLE IF NOT EXISTS public.delivery_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  suggested_quantity DECIMAL(10,2),
  ordered_quantity DECIMAL(10,2) NOT NULL,
  received_quantity DECIMAL(10,2),
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  variance_quantity DECIMAL(10,2),
  variance_cost DECIMAL(10,2),
  variance_notes TEXT,
  variance_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delivery_orders_company_id ON public.delivery_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_supplier_id ON public.delivery_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON public.delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_order_items_delivery_order_id ON public.delivery_order_items(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_order_items_ingredient_id ON public.delivery_order_items(ingredient_id);

-- Enable RLS
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_orders
CREATE POLICY "Users can view delivery orders from their company"
  ON public.delivery_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert delivery orders for their company"
  ON public.delivery_orders FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update delivery orders from their company"
  ON public.delivery_orders FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete delivery orders from their company"
  ON public.delivery_orders FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for delivery_order_items
CREATE POLICY "Users can view delivery order items from their company"
  ON public.delivery_order_items FOR SELECT
  USING (
    delivery_order_id IN (
      SELECT id FROM public.delivery_orders WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert delivery order items for their company orders"
  ON public.delivery_order_items FOR INSERT
  WITH CHECK (
    delivery_order_id IN (
      SELECT id FROM public.delivery_orders WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update delivery order items from their company"
  ON public.delivery_order_items FOR UPDATE
  USING (
    delivery_order_id IN (
      SELECT id FROM public.delivery_orders WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete delivery order items from their company"
  ON public.delivery_order_items FOR DELETE
  USING (
    delivery_order_id IN (
      SELECT id FROM public.delivery_orders WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_delivery_orders_updated_at BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_order_items_updated_at BEFORE UPDATE ON public.delivery_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();