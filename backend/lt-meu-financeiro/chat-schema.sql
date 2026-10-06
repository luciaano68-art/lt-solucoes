-- Separate from the shared ledger: custom authenticated Edge Function owns access.
create table if not exists public.lt_pf_chat_internal (
 user_id uuid not null references public.lt_pf_users_internal(id),
 message_id uuid not null,
 role text not null check (role in ('me','bot')),
 text text not null check (length(text) between 1 and 50000),
 created_at timestamptz not null,
 primary key (user_id,message_id)
);
create index if not exists lt_pf_chat_user_time_idx on public.lt_pf_chat_internal(user_id,created_at desc,message_id desc);
alter table public.lt_pf_chat_internal enable row level security;
revoke all on public.lt_pf_chat_internal from public,anon,authenticated;
grant select,insert on public.lt_pf_chat_internal to service_role;
