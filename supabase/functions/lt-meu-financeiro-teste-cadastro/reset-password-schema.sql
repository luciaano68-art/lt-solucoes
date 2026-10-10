CREATE TABLE public.lt_pf_teste_recovery_internal (
 user_id uuid PRIMARY KEY REFERENCES public.lt_pf_users_internal(id),
 requested_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);
ALTER TABLE public.lt_pf_teste_recovery_internal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lt_pf_teste_recovery_internal FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lt_pf_teste_recovery_internal TO service_role;
CREATE FUNCTION public.lt_pf_teste_reset_password_internal(p_user_id uuid,p_salt text,p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE target public.lt_pf_users_internal%ROWTYPE;
BEGIN
 IF p_hash !~ '^[0-9a-f]{64}$' OR p_salt !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'Invalid password digest'; END IF;
 SELECT * INTO target FROM public.lt_pf_users_internal WHERE id=p_user_id AND is_owner AND username NOT LIKE 'pending.%'
 AND space_id IN ('dde8d6a6-cda9-4728-9f1e-8d14ca54e5f1','95ac6f7a-055f-4d18-a3d3-aaf92167875f','e8f42f5d-fd8a-4f64-aad5-99c9ac2c5253','161bfbc0-4a12-413f-8386-4ecccff04064','54482e74-abb1-496c-b48a-c60edd63dde7') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.lt_pf_users_internal SET password_salt=p_salt,password_hash=p_hash,failed_attempts=0,locked_until=NULL,access_version=access_version+1 WHERE id=target.id;
 DELETE FROM public.lt_pf_tokens_internal WHERE user_id=target.id;
 UPDATE public.lt_pf_teste_recovery_internal SET resolved_at=now() WHERE user_id=target.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.lt_pf_teste_reset_password_internal(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lt_pf_teste_reset_password_internal(uuid,text,text) TO service_role;
