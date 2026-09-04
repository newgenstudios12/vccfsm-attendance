create or replace function public.band_fund_summary()
returns table (
  balance numeric,
  total_deposits numeric,
  total_withdrawals numeric,
  transaction_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not private.can_access_band_fund() then
    raise exception 'Band Fund access is limited to Music/Band ministry members and church administrators.' using errcode = '42501';
  end if;
  return query
  select
    coalesce(sum(case when t.transaction_type='deposit' then t.amount else -t.amount end),0)::numeric(12,2),
    coalesce(sum(case when t.transaction_type='deposit' then t.amount else 0 end),0)::numeric(12,2),
    coalesce(sum(case when t.transaction_type='withdraw' then t.amount else 0 end),0)::numeric(12,2),
    count(*)::bigint
  from public.band_fund_transactions t;
end;
$$;

revoke all on function public.band_fund_summary() from public, anon;
grant execute on function public.band_fund_summary() to authenticated;
