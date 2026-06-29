-- Create trigger to automatically handle customers when reservations are created
DROP TRIGGER IF EXISTS trigger_handle_new_customer ON reservations;

CREATE TRIGGER trigger_handle_new_customer
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_customer();

-- Enable RLS on customers table for security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customers table
CREATE POLICY "Enable read access for all users" ON customers
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON customers
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON customers
  FOR DELETE USING (true);