create index if not exists daily_devotionals_created_by_idx
  on public.daily_devotionals(created_by);

create index if not exists daily_devotionals_updated_by_idx
  on public.daily_devotionals(updated_by);
