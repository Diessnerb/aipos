
-- Add user_id column to rotas to track who created the rota
ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS user_id uuid;

-- (Optional/recommended) Set the user_id to reference users(id)
ALTER TABLE public.rotas ADD CONSTRAINT rotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- If you want `user_id` to be required (non-null on future inserts), you can uncomment this after updating existing records:
-- ALTER TABLE public.rotas ALTER COLUMN user_id SET NOT NULL;
