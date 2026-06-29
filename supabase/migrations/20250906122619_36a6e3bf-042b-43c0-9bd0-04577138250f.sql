-- Add foreign key relationship between optimization_log and reservations
ALTER TABLE optimization_log 
ADD CONSTRAINT fk_optimization_log_reservation 
FOREIGN KEY (reservation_id) REFERENCES reservations(id) 
ON DELETE CASCADE;