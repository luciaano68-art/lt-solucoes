-- Add access controls without changing financial data, existing identities or passwords.
alter table public.lt_pf_users_internal add column if not exists is_owner boolean not null default false;
alter table public.lt_pf_users_internal add column if not exists permissions jsonb not null default '{"view":true,"entries":true,"invoices":true,"accounts":true,"cards":true,"budgets":true}'::jsonb;
alter table public.lt_pf_users_internal add column if not exists access_version bigint not null default 1;
alter table public.lt_pf_users_internal alter column permissions set default '{"view":true,"entries":false,"invoices":false,"accounts":false,"cards":false,"budgets":false}'::jsonb;
update public.lt_pf_users_internal set is_owner=true where username='luciano.financeiro' and not is_owner;
create unique index if not exists lt_pf_one_owner_per_space on public.lt_pf_users_internal(space_id) where is_owner;
