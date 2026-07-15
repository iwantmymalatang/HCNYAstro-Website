-- Repair hidden forum posts after the first trust moderation migration.
-- Run this once in Supabase SQL Editor if public forum posts disappeared.

alter table public.forum_threads
add column if not exists status text;

update public.forum_threads
set status = 'approved'
where status is null or status = 'pending';

alter table public.forum_threads
alter column status set default 'pending';

alter table public.forum_threads
alter column status set not null;

alter table public.forum_threads drop constraint if exists forum_threads_status_check;
alter table public.forum_threads
add constraint forum_threads_status_check check (status in ('pending', 'approved', 'rejected'));

update public.profiles
set role = 'admin',
    trust_status = 'trusted',
    settings_completed = true
where lower(coalesce(email, '')) = 'hcnyastro@gmail.com';

drop view if exists public.forum_threads_with_counts;
create view public.forum_threads_with_counts as
select
  t.id,
  t.type,
  t.title,
  t.slug,
  t.body,
  t.image_url,
  t.tags,
  t.username,
  t.created_by,
  t.status,
  t.created_at,
  t.updated_at,
  count(c.id)::int as comment_count
from public.forum_threads t
left join public.forum_comments c on c.thread_id = t.id
where t.status = 'approved'
group by t.id;

grant select on public.forum_threads_with_counts to anon, authenticated;
