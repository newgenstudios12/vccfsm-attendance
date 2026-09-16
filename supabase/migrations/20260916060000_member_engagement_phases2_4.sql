-- VCCF Connect Member Engagement Phases 2-4
-- Phase 2: Daily Devotional progress and curated content
-- Phase 3: Community/Area Hub is read-only over existing scoped church data
-- Phase 4: Private sermon bookmarks, notes and reflections

create table if not exists public.daily_devotionals (
  devotional_date date primary key,
  title text,
  reflection text,
  reflection_question text,
  prayer text,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_devotionals enable row level security;
revoke all on table public.daily_devotionals from anon, authenticated;
grant select on table public.daily_devotionals to authenticated;
grant insert, update, delete on table public.daily_devotionals to authenticated;

drop policy if exists "daily devotionals member read" on public.daily_devotionals;
create policy "daily devotionals member read"
on public.daily_devotionals
for select
to authenticated
using (
  is_published
  or exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','pastor')
  )
);

drop policy if exists "daily devotionals manager insert" on public.daily_devotionals;
create policy "daily devotionals manager insert"
on public.daily_devotionals
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','pastor')
  )
  and (created_by is null or created_by = (select auth.uid()))
  and (updated_by is null or updated_by = (select auth.uid()))
);

drop policy if exists "daily devotionals manager update" on public.daily_devotionals;
create policy "daily devotionals manager update"
on public.daily_devotionals
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','pastor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','pastor')
  )
  and (updated_by is null or updated_by = (select auth.uid()))
);

drop policy if exists "daily devotionals manager delete" on public.daily_devotionals;
create policy "daily devotionals manager delete"
on public.daily_devotionals
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','pastor')
  )
);

create table if not exists public.devotional_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  devotional_date date not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, devotional_date)
);

create index if not exists devotional_progress_completed_at_idx
  on public.devotional_progress(completed_at desc);

alter table public.devotional_progress enable row level security;
revoke all on table public.devotional_progress from anon, authenticated;
grant select, insert, delete on table public.devotional_progress to authenticated;

drop policy if exists "devotional progress own read" on public.devotional_progress;
create policy "devotional progress own read"
on public.devotional_progress
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "devotional progress own insert" on public.devotional_progress;
create policy "devotional progress own insert"
on public.devotional_progress
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "devotional progress own delete" on public.devotional_progress;
create policy "devotional progress own delete"
on public.devotional_progress
for delete
to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.sermon_member_engagement (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sermon_id uuid not null references public.vccf_sermons(id) on delete cascade,
  bookmarked boolean not null default false,
  notes text,
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sermon_id)
);

create index if not exists sermon_member_engagement_sermon_id_idx
  on public.sermon_member_engagement(sermon_id);
create index if not exists sermon_member_engagement_updated_at_idx
  on public.sermon_member_engagement(updated_at desc);

alter table public.sermon_member_engagement enable row level security;
revoke all on table public.sermon_member_engagement from anon, authenticated;
grant select, insert, update, delete on table public.sermon_member_engagement to authenticated;

drop policy if exists "sermon engagement own read" on public.sermon_member_engagement;
create policy "sermon engagement own read"
on public.sermon_member_engagement
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "sermon engagement own insert" on public.sermon_member_engagement;
create policy "sermon engagement own insert"
on public.sermon_member_engagement
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "sermon engagement own update" on public.sermon_member_engagement;
create policy "sermon engagement own update"
on public.sermon_member_engagement
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "sermon engagement own delete" on public.sermon_member_engagement;
create policy "sermon engagement own delete"
on public.sermon_member_engagement
for delete
to authenticated
using (user_id = (select auth.uid()));

insert into public.site_settings(key, value, updated_at)
values
  ('member_engagement_phase2_enabled', 'true', now()),
  ('member_engagement_phase3_enabled', 'true', now()),
  ('member_engagement_phase4_enabled', 'true', now())
on conflict (key) do nothing;
