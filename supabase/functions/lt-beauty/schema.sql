create table public.lt_beauty_accounts(
 id uuid primary key default gen_random_uuid(),
 username text unique,
 password_hash text,
 setup_hash text,
 setup_expires timestamptz,
 revision bigint not null default 0,
 data jsonb not null,
 created_at timestamptz not null default now()
);
create table public.lt_beauty_sessions(
 token_hash text primary key,
 account_id uuid not null references public.lt_beauty_accounts(id) on delete cascade,
 expires_at timestamptz not null
);
create index lt_beauty_sessions_account_idx on public.lt_beauty_sessions(account_id);
create index lt_beauty_sessions_expires_idx on public.lt_beauty_sessions(expires_at);
create table public.lt_beauty_limits(bucket text primary key,attempts int not null,expires_at timestamptz not null);
create index lt_beauty_limits_expires_idx on public.lt_beauty_limits(expires_at);
create table public.lt_beauty_push_config(id integer primary key check(id=1),data jsonb not null);
alter table public.lt_beauty_accounts enable row level security;
alter table public.lt_beauty_sessions enable row level security;
alter table public.lt_beauty_limits enable row level security;
alter table public.lt_beauty_push_config enable row level security;
revoke all on public.lt_beauty_accounts,public.lt_beauty_sessions,public.lt_beauty_limits,public.lt_beauty_push_config from public,anon,authenticated;
grant select,insert,update,delete on public.lt_beauty_accounts,public.lt_beauty_sessions,public.lt_beauty_limits,public.lt_beauty_push_config to service_role;
create function public.lt_beauty_allow(p_bucket text,p_limit integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n int;
begin
 if length(p_bucket)<>64 or p_limit<1 or p_limit>100 then return false; end if;
 delete from public.lt_beauty_limits where expires_at<now()-interval '1 day';
 insert into public.lt_beauty_limits values(p_bucket,1,now()+interval '5 minutes')
 on conflict(bucket) do update set attempts=case when lt_beauty_limits.expires_at<now() then 1 else lt_beauty_limits.attempts+1 end,expires_at=case when lt_beauty_limits.expires_at<now() then now()+interval '5 minutes' else lt_beauty_limits.expires_at end
 returning attempts into n;
 return n<=p_limit;
end $$;
revoke all on function public.lt_beauty_allow(text,integer) from public,anon,authenticated;
grant execute on function public.lt_beauty_allow(text,integer) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('lt-beauty-media','lt-beauty-media',true,1048576,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;

