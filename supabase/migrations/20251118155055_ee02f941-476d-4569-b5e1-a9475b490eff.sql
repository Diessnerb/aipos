-- Phase 1: Add wastage_batch_id for better grouping
ALTER TABLE wastage_log 
ADD COLUMN IF NOT EXISTS wastage_batch_id UUID;

CREATE INDEX idx_wastage_log_batch_id ON wastage_log(wastage_batch_id);

-- Phase 2: Enable RLS on critical tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own company users"
ON users FOR SELECT
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Users can insert own company users"
ON users FOR INSERT
TO authenticated
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Users can update own company users"
ON users FOR UPDATE
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

CREATE POLICY "Users can delete own company users"
ON users FOR DELETE
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for customers table (already has RLS, this will add to existing policies)
CREATE POLICY "Customers company isolation auth"
ON customers FOR ALL
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for reservations table
CREATE POLICY "Reservations company isolation auth"
ON reservations FOR ALL
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for orders table
CREATE POLICY "Orders company isolation auth"
ON orders FOR ALL
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for payments table (uses order_id to join with orders)
CREATE POLICY "Payments company isolation auth"
ON payments FOR ALL
TO authenticated
USING (
  order_id IN (
    SELECT id FROM orders 
    WHERE company_id IN (SELECT allowed_company_ids_for_current_user())
  )
)
WITH CHECK (
  order_id IN (
    SELECT id FROM orders 
    WHERE company_id IN (SELECT allowed_company_ids_for_current_user())
  )
);

-- RLS Policies for suppliers table
CREATE POLICY "Suppliers company isolation auth"
ON suppliers FOR ALL
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for ingredients table
CREATE POLICY "Ingredients company isolation auth"
ON ingredients FOR ALL
TO authenticated
USING (company_id IN (SELECT allowed_company_ids_for_current_user()))
WITH CHECK (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- RLS Policies for pos_credentials table (admin only)
CREATE POLICY "POS credentials admin only"
ON pos_credentials FOR ALL
TO authenticated
USING (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
)
WITH CHECK (
  company_id IN (SELECT allowed_company_ids_for_current_user())
  AND is_current_user_admin()
);