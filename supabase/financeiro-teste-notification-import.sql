-- Used only by the Teste notification intake Edge Function.
create table public.lt_pf_notification_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.lt_pf_users_internal(id),
 token_hash text not null unique check (length(token_hash)=64),
 name text not null check (length(name) between 1 and 80),
 card_id uuid,
 active boolean not null default true,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index lt_pf_notification_connections_user on public.lt_pf_notification_connections(user_id);
create table public.lt_pf_notification_inbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.lt_pf_users_internal(id),
 connection_id uuid not null references public.lt_pf_notification_connections(id),
 fingerprint text not null,
 proposal jsonb not null,
 status text not null default 'pending' check(status in ('pending','confirmed','discarded')),
 received_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique(user_id,fingerprint)
);
create index lt_pf_notification_inbox_user_status on public.lt_pf_notification_inbox(user_id,status,created_at desc);
create index lt_pf_notification_inbox_connection on public.lt_pf_notification_inbox(connection_id);
alter table public.lt_pf_notification_connections enable row level security;
alter table public.lt_pf_notification_inbox enable row level security;
create policy notification_connections_service on public.lt_pf_notification_connections to service_role using (true) with check (true);
create policy notification_inbox_service on public.lt_pf_notification_inbox to service_role using (true) with check (true);
revoke all on public.lt_pf_notification_connections,public.lt_pf_notification_inbox from public,anon,authenticated;
grant select,insert,update on public.lt_pf_notification_connections,public.lt_pf_notification_inbox to service_role;
comment on table public.lt_pf_notification_connections is 'Teste only. Service-role access with explicit active user/space/permission checks; hashed ingestion-only credentials.';
comment on table public.lt_pf_notification_inbox is 'Teste only. Private unconfirmed bank notification suggestions; never included in balances.';
