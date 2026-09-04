create table if not exists public.bible_verses (
  id bigint generated always as identity primary key,
  reference text not null unique,
  verse_text text not null,
  translation text not null default 'KJV',
  sort_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bible_verses enable row level security;
revoke all on table public.bible_verses from anon;
grant select on table public.bible_verses to authenticated;
drop policy if exists bible_verses_read_authenticated on public.bible_verses;
create policy bible_verses_read_authenticated on public.bible_verses
for select to authenticated using (is_active = true);

insert into public.bible_verses(reference,verse_text,translation,sort_order,is_active) values
('John 3:16','For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.','KJV',1,true),
('Philippians 4:13','I can do all things through Christ which strengtheneth me.','KJV',2,true),
('Psalm 23:1','The LORD is my shepherd; I shall not want.','KJV',3,true),
('Psalm 46:10','Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.','KJV',4,true),
('Proverbs 3:5-6','Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.','KJV',5,true),
('Isaiah 41:10','Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.','KJV',6,true),
('Romans 8:28','And we know that all things work together for good to them that love God, to them who are the called according to his purpose.','KJV',7,true),
('Matthew 11:28','Come unto me, all ye that labour and are heavy laden, and I will give you rest.','KJV',8,true),
('Joshua 1:9','Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.','KJV',9,true),
('1 Peter 5:7','Casting all your care upon him; for he careth for you.','KJV',10,true),
('Psalm 118:24','This is the day which the LORD hath made; we will rejoice and be glad in it.','KJV',11,true),
('2 Corinthians 5:7','For we walk by faith, not by sight.','KJV',12,true),
('Psalm 119:105','Thy word is a lamp unto my feet, and a light unto my path.','KJV',13,true),
('Isaiah 40:31','But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.','KJV',14,true),
('Matthew 5:16','Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.','KJV',15,true),
('Romans 15:13','Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.','KJV',16,true),
('Psalm 34:8','O taste and see that the LORD is good: blessed is the man that trusteth in him.','KJV',17,true),
('Psalm 37:4','Delight thyself also in the LORD; and he shall give thee the desires of thine heart.','KJV',18,true),
('Psalm 56:3','What time I am afraid, I will trust in thee.','KJV',19,true),
('Colossians 3:23','And whatsoever ye do, do it heartily, as to the Lord, and not unto men;','KJV',20,true)
on conflict(reference) do update set verse_text=excluded.verse_text,translation=excluded.translation,sort_order=excluded.sort_order,is_active=excluded.is_active;

create or replace function public.vccf_daily_bible_verse(p_date date default null)
returns table(verse_date date, reference text, verse_text text, translation text)
language sql
stable
security invoker
set search_path = public
as $$
  with d as (
    select coalesce(p_date,(now() at time zone 'Asia/Manila')::date) as verse_date
  ), ranked as (
    select reference,verse_text,translation,
           row_number() over(order by sort_order,id) as rn,
           count(*) over() as total
    from public.bible_verses
    where is_active = true
  )
  select d.verse_date,r.reference,r.verse_text,r.translation
  from d
  join ranked r on r.rn = 1 + mod(abs((d.verse_date - date '2026-01-01')::int),r.total::int)
  limit 1;
$$;
revoke all on function public.vccf_daily_bible_verse(date) from public, anon;
grant execute on function public.vccf_daily_bible_verse(date) to authenticated;

create table if not exists public.daily_bible_verse_push_log (
  verse_date date primary key,
  verse_reference text not null,
  push_notification_id uuid unique references public.push_notifications(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.daily_bible_verse_push_log enable row level security;
revoke all on table public.daily_bible_verse_push_log from anon, authenticated;

create or replace function public.vccf_prepare_daily_bible_verse()
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v record;
  v_push_id uuid;
begin
  select * into v from public.vccf_daily_bible_verse(v_date) limit 1;
  if v.reference is null then return null; end if;

  insert into public.daily_bible_verse_push_log(verse_date,verse_reference)
  values(v_date,v.reference)
  on conflict(verse_date) do nothing;

  if not found then
    select push_notification_id into v_push_id
    from public.daily_bible_verse_push_log where verse_date=v_date;
    return v_push_id;
  end if;

  insert into public.push_notifications(
    title,body,audience,is_published,push_enabled,recurrence,daily_time,publish_at,expires_at,push_url
  ) values (
    'Today''s Word · '||v.reference,
    v.verse_text||' — '||v.reference||' ('||v.translation||')',
    'All',true,true,'once',null,now(),((v_date + 1)::timestamp at time zone 'Asia/Manila'),
    '/?daily-verse='||v_date::text
  ) returning id into v_push_id;

  update public.daily_bible_verse_push_log
  set push_notification_id=v_push_id
  where verse_date=v_date;

  return v_push_id;
end;
$$;
revoke all on function public.vccf_prepare_daily_bible_verse() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname='vccf-daily-bible-verse';
select cron.schedule('vccf-daily-bible-verse','0 23 * * *','select public.vccf_prepare_daily_bible_verse();');