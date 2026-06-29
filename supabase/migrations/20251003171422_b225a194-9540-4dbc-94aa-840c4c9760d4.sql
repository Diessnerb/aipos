-- Add SMS reminder settings to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_provider text DEFAULT 'twilio';

-- Add SMS opt-out tracking to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS sms_opt_out boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamp with time zone;

-- Create index for efficient opt-out lookups
CREATE INDEX IF NOT EXISTS idx_customers_sms_opt_out 
ON customers(sms_opt_out) 
WHERE sms_opt_out = true;

-- Add helpful comments
COMMENT ON COLUMN company_settings.sms_reminders_enabled IS 'Enable/disable SMS reminders for the entire company';
COMMENT ON COLUMN company_settings.sms_provider IS 'SMS provider (twilio, etc.)';
COMMENT ON COLUMN customers.sms_opt_out IS 'Customer has opted out of SMS communications';
COMMENT ON COLUMN customers.sms_opt_out_at IS 'Timestamp when customer opted out of SMS';