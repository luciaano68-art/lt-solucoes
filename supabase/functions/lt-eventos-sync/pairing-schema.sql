create table public.lt_eventos_pair_codes (
 code_hash text primary key check(length(code_hash)=64),
 space_id uuid not null unique references public.lt_eventos_spaces(id) on delete cascade,
 encrypted_credentials text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index lt_eventos_pair_codes_expires_idx on public.lt_eventos_pair_codes(expires_at);
alter table public.lt_eventos_pair_codes enable row level security;
revoke all on public.lt_eventos_pair_codes from public,anon,authenticated;
grant select,insert,update,delete on public.lt_eventos_pair_codes to service_role;
create table public.lt_eventos_pair_attempts (
 bucket text primary key check(length(bucket)=64),
 attempts integer not null default 1,
 expires_at timestamptz not null
);
create index lt_eventos_pair_attempts_expires_idx on public.lt_eventos_pair_attempts(expires_at);
alter table public.lt_eventos_pair_attempts enable row level security;
revoke all on public.lt_eventos_pair_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.lt_eventos_pair_attempts to service_role;
create function public.lt_eventos_allow_pair_attempt(p_bucket text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if length(p_bucket)<>64 then return false; end if;
 delete from public.lt_eventos_pair_attempts where expires_at<now()-interval '1 day';
 insert into public.lt_eventos_pair_attempts(bucket,attempts,expires_at)
 values(p_bucket,1,now()+interval '1 minute')
 on conflict(bucket) do update set
 attempts=case when lt_eventos_pair_attempts.expires_at<=now() then 1 else lt_eventos_pair_attempts.attempts+1 end,
 expires_at=case when lt_eventos_pair_attempts.expires_at<=now() then now()+interval '1 minute' else lt_eventos_pair_attempts.expires_at end
 returning attempts into n;
 return n<=15;
end $$;
revoke all on function public.lt_eventos_allow_pair_attempt(text) from public,anon,authenticated;
grant execute on function public.lt_eventos_allow_pair_attempt(text) to service_role;
