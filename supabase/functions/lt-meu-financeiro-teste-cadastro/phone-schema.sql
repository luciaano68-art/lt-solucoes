ALTER TABLE public.lt_pf_users_internal ADD COLUMN teste_phone text CHECK (teste_phone IS NULL OR teste_phone ~ '^55[1-9][0-9][2-9][0-9]{7,8}$');
