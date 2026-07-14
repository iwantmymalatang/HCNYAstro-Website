-- Run this once in Supabase SQL Editor to enable comment reply threads.
-- This version is safe to run more than once.

alter table public.forum_comments
add column if not exists parent_id uuid;

alter table public.forum_comments
drop constraint if exists forum_comments_parent_id_fkey;

alter table public.forum_comments
add constraint forum_comments_parent_id_fkey
foreign key (parent_id)
references public.forum_comments(id)
on delete cascade;

create or replace view public.forum_comments_with_scores as
select
  c.id,
  c.thread_id,
  c.parent_id,
  c.body,
  c.username,
  c.created_by,
  c.created_at,
  c.updated_at,
  coalesce(sum(v.value), 0)::int as score
from public.forum_comments c
left join public.forum_comment_votes v on v.comment_id = c.id
group by c.id;

grant select on public.forum_comments_with_scores to anon, authenticated;
