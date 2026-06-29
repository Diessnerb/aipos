-- Clean up duplicate reservation created during buggy move
DELETE FROM reservations 
WHERE id = '70a5f32d-af00-4a7f-839e-3940ce09c8bb' 
  AND customer_name = 'dec' 
  AND created_at = '2025-07-16 13:09:30.448484+00';