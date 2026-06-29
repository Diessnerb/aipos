
-- Add unique constraint to week_start column to ensure only one rota per week
ALTER TABLE public.rotas ADD CONSTRAINT rotas_week_start_unique UNIQUE (week_start);
