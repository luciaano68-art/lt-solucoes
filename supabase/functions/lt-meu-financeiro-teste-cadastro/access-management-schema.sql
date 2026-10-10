ALTER TABLE public.lt_pf_users_internal ADD COLUMN teste_paused_at timestamptz, ADD COLUMN teste_deleted_at timestamptz;
CREATE FUNCTION public.lt_pf_teste_manage_access_internal(p_user_id uuid,p_username text,p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE u public.lt_pf_users_internal%ROWTYPE;
BEGIN
 SELECT * INTO u FROM public.lt_pf_users_internal WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND OR u.username<>p_username OR u.username LIKE 'pending.%' OR u.teste_deleted_at IS NOT NULL OR u.space_id NOT IN ('dde8d6a6-cda9-4728-9f1e-8d14ca54e5f1'::uuid,'95ac6f7a-055f-4d18-a3d3-aaf92167875f'::uuid,'e8f42f5d-fd8a-4f64-aad5-99c9ac2c5253'::uuid,'161bfbc0-4a12-413f-8386-4ecccff04064'::uuid,'54482e74-abb1-496c-b48a-c60edd63dde7'::uuid) THEN RETURN false; END IF;
 IF p_action NOT IN ('pause','resume','delete') THEN RETURN false; END IF;
 UPDATE public.lt_pf_users_internal SET active=(p_action='resume'),teste_paused_at=CASE WHEN p_action='pause' THEN now() WHEN p_action='resume' THEN NULL ELSE teste_paused_at END,teste_deleted_at=CASE WHEN p_action='delete' THEN now() ELSE NULL END,failed_attempts=CASE WHEN p_action='resume' THEN 0 ELSE failed_attempts END,locked_until=CASE WHEN p_action='resume' THEN NULL ELSE locked_until END,access_version=COALESCE(access_version,0)+1 WHERE id=p_user_id;
 IF u.is_owner AND p_action='delete' THEN UPDATE public.lt_pf_users_internal SET active=false,teste_deleted_at=now(),access_version=COALESCE(access_version,0)+1 WHERE space_id=u.space_id AND id<>p_user_id; END IF;
 DELETE FROM public.lt_pf_tokens_internal WHERE user_id IN (SELECT id FROM public.lt_pf_users_internal WHERE id=p_user_id OR (u.is_owner AND space_id=u.space_id));
 IF p_action='delete' THEN UPDATE public.lt_pf_teste_recovery_internal SET resolved_at=now() WHERE user_id IN (SELECT id FROM public.lt_pf_users_internal WHERE id=p_user_id OR (u.is_owner AND space_id=u.space_id)) AND resolved_at IS NULL; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.lt_pf_teste_manage_access_internal(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lt_pf_teste_manage_access_internal(uuid,text,text) TO service_role;
