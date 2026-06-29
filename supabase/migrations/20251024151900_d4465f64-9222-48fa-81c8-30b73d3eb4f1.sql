-- Add split payment tracking columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS split_index integer,
ADD COLUMN IF NOT EXISTS total_splits integer,
ADD COLUMN IF NOT EXISTS split_amount numeric(10,2);

-- Add comment to explain the columns
COMMENT ON COLUMN payments.split_index IS 'Which split this payment is for (0, 1, 2...). NULL for non-split payments.';
COMMENT ON COLUMN payments.total_splits IS 'Total number of splits (e.g., 3 for 3-way split). NULL for non-split payments.';
COMMENT ON COLUMN payments.split_amount IS 'The specific split amount for this payment. NULL for non-split payments.';