-- Update Beth's reservation to correct table numbers
UPDATE reservations 
SET table_numbers = '{12,14,15}'::integer[]
WHERE id = 'ace84736-1a95-4562-a925-693c7024b85c';