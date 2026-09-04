create index if not exists daily_bible_verse_selections_created_by_idx
on public.daily_bible_verse_selections(created_by)
where created_by is not null;

create index if not exists daily_bible_verse_selections_updated_by_idx
on public.daily_bible_verse_selections(updated_by)
where updated_by is not null;
