create table public.lt_pf_spaces_internal (
 id uuid primary key default gen_random_uuid(), name text not null,
 revision bigint not null default 0, data jsonb not null,
 created_at timestamptz not null default now()
);
create table public.lt_pf_users_internal (
 id uuid primary key default gen_random_uuid(), username text unique not null,
 display_name text not null, space_id uuid not null references public.lt_pf_spaces_internal(id),
 password_salt text not null, password_hash text not null,
 failed_attempts integer not null default 0, locked_until timestamptz,
 active boolean not null default true
);
create table public.lt_pf_tokens_internal (
 token_hash text primary key, user_id uuid not null references public.lt_pf_users_internal(id),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index lt_pf_tokens_user_idx on public.lt_pf_tokens_internal(user_id);
alter table public.lt_pf_spaces_internal enable row level security;
alter table public.lt_pf_users_internal enable row level security;
alter table public.lt_pf_tokens_internal enable row level security;
revoke all on public.lt_pf_spaces_internal,public.lt_pf_users_internal,public.lt_pf_tokens_internal from public,anon,authenticated;
grant select,insert,update,delete on public.lt_pf_spaces_internal,public.lt_pf_users_internal,public.lt_pf_tokens_internal to service_role;
