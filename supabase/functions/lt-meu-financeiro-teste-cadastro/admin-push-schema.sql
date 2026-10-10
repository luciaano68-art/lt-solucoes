CREATE TABLE public.lt_pf_teste_admin_push_config_internal (id integer PRIMARY KEY CHECK (id=1), vapid_public text NOT NULL, vapid_private text NOT NULL);
CREATE TABLE public.lt_pf_teste_admin_push_subscriptions_internal (endpoint text PRIMARY KEY, subscription jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.lt_pf_teste_admin_push_events_internal (event_key text PRIMARY KEY, status text NOT NULL, sent integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.lt_pf_teste_admin_push_config_internal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lt_pf_teste_admin_push_subscriptions_internal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lt_pf_teste_admin_push_events_internal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lt_pf_teste_admin_push_config_internal, public.lt_pf_teste_admin_push_subscriptions_internal, public.lt_pf_teste_admin_push_events_internal FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lt_pf_teste_admin_push_config_internal, public.lt_pf_teste_admin_push_subscriptions_internal, public.lt_pf_teste_admin_push_events_internal TO service_role;
