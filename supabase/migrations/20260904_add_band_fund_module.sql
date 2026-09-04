create schema if not exists private;

grant usage on schema private to authenticated;

create table if not exists public.band_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('deposit','withdraw')),
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null,
  description text,
  reference_no text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now()
);

alter table public.band_fund_transactions enable row level security;

revoke all on table public.band_fund_transactions from anon, authenticated;
grant select on table public.band_fund_transactions to authenticated;

create or replace function private.can_access_band_fund()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and (
          lower(p.role::text) in ('admin','pastor')
          or (
            p.member_id is not null
            and exists (
              select 1
              from public.member_ministries mm
              join public.ministries m on m.id = mm.ministry_id
              where mm.member_id = p.member_id
                and m.is_active is not false
                and (
                  lower(trim(m.name)) like '%music%'
                  or lower(trim(m.name)) like '%band%'
                )
            )
          )
        )
    );
$$;

revoke all on function private.can_access_band_fund() from public;
grant execute on function private.can_access_band_fund() to authenticated;

drop policy if exists "band fund members can read" on public.band_fund_transactions;
create policy "band fund members can read"
on public.band_fund_transactions
for select
to authenticated
using ((select private.can_access_band_fund()));

create or replace function public.band_fund_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_band_fund();
$$;

revoke all on function public.band_fund_access() from public, anon;
grant execute on function public.band_fund_access() to authenticated;

create or replace function public.band_fund_post_transaction(
  p_type text,
  p_amount numeric,
  p_description text default null,
  p_reference_no text default null,
  p_transaction_date date default null
)
returns public.band_fund_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_type text := lower(trim(coalesce(p_type,'')));
  v_amount numeric(12,2) := round(coalesce(p_amount,0)::numeric,2);
  v_balance numeric(12,2);
  v_name text;
  v_row public.band_fund_transactions;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.can_access_band_fund() then
    raise exception 'Band Fund access is limited to Music/Band ministry members and church administrators.' using errcode = '42501';
  end if;

  if v_type not in ('deposit','withdraw') then
    raise exception 'Transaction type must be deposit or withdraw.' using errcode = '22023';
  end if;

  if v_amount <= 0 then
    raise exception 'Amount must be greater than zero.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vccf-band-fund'));

  select coalesce(sum(case when t.transaction_type='deposit' then t.amount else -t.amount end),0)::numeric(12,2)
    into v_balance
  from public.band_fund_transactions t;

  if v_type = 'withdraw' and v_amount > v_balance then
    raise exception 'Withdrawal exceeds the available Band Fund balance of %.', to_char(v_balance,'FM999999999990.00') using errcode = '22003';
  end if;

  select coalesce(nullif(trim(p.display_name),''), 'VCCF Member')
    into v_name
  from public.profiles p
  where p.user_id = v_uid;

  if v_name is null then
    v_name := 'VCCF Member';
  end if;

  insert into public.band_fund_transactions (
    transaction_type,
    amount,
    transaction_date,
    description,
    reference_no,
    created_by,
    created_by_name
  ) values (
    v_type,
    v_amount,
    coalesce(p_transaction_date, (pg_catalog.now() at time zone 'Asia/Manila')::date),
    nullif(trim(coalesce(p_description,'')),''),
    nullif(trim(coalesce(p_reference_no,'')),''),
    v_uid,
    v_name
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.band_fund_post_transaction(text,numeric,text,text,date) from public, anon;
grant execute on function public.band_fund_post_transaction(text,numeric,text,text,date) to authenticated;

create index if not exists band_fund_transactions_date_idx
  on public.band_fund_transactions (transaction_date desc, created_at desc);
create index if not exists band_fund_transactions_created_by_idx
  on public.band_fund_transactions (created_by);
