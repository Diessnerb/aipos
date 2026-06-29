-- Fix Beth's reservation to use correct table numbers
UPDATE reservations 
SET table_numbers = ARRAY[12, 14, 15]
WHERE id = 'ace84736-1a95-4562-a925-693c7024b85c' 
AND customer_name = 'beth';