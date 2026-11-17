create table public.lt_eventos_spaces (
 id uuid primary key,
 key_hash text not null check(length(key_hash)=64),
 created_at timestamptz not null default now()
);
create table public.lt_eventos_events (
 space_id uuid not null references public.lt_eventos_spaces(id),
 id uuid not null,
 revision bigint not null default 1 check(revision>0),
 data jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(space_id,id)
);
alter table public.lt_eventos_spaces enable row level security;
alter table public.lt_eventos_events enable row level security;
revoke all on public.lt_eventos_spaces, public.lt_eventos_events from public,anon,authenticated;
grant select,insert,update on public.lt_eventos_spaces,public.lt_eventos_events to service_role;
