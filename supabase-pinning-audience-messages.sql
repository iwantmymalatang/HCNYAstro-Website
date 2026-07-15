-- Pinning, trusted-only posts, admin inbox, and dynamic-page hardening.
-- Run this once in Supabase SQL Editor after deploying the site code.

alter table public.forum_threads
add column if not exists is_pinned boolean not null default false;

alter table public.forum_threads
add column if not exists audience text not null default 'public';

alter table public.forum_threads drop constraint if exists forum_threads_audience_check;
alter table public.forum_threads
add constraint forum_threads_audience_check check (audience in ('public', 'trusted'));

alter table public.forum_comments
add column if not exists is_pinned boolean not null default false;

create table if not exists public.forum_admin_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  kind text not null default 'message' check (kind in ('message', 'trust_application')),
  message text not null,
  username text not null default 'Contributor',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_admin_messages enable row level security;

drop view if exists public.forum_comments_with_scores;
create view public.forum_comments_with_scores as
select
  c.id,
  c.thread_id,
  c.parent_id,
  c.body,
  c.username,
  c.created_by,
  c.is_pinned,
  c.created_at,
  c.updated_at,
  coalesce(sum(v.value), 0)::int as score
from public.forum_comments c
left join public.forum_comment_votes v on v.comment_id = c.id
group by c.id;

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
  t.audience,
  t.is_pinned,
  t.created_at,
  t.updated_at,
  count(c.id)::int as comment_count
from public.forum_threads t
left join public.forum_comments c on c.thread_id = t.id
where t.status = 'approved'
  and (t.audience = 'public' or public.is_trusted())
group by t.id;

grant select on public.forum_threads_with_counts to anon, authenticated;
grant select on public.forum_comments_with_scores to anon, authenticated;

drop policy if exists "Forum threads are visible when approved or owned" on public.forum_threads;
create policy "Forum threads are visible when approved or owned"
on public.forum_threads
for select
using (
  created_by = auth.uid()
  or public.is_admin()
  or (
    status = 'approved'
    and (audience = 'public' or public.is_trusted())
  )
);

drop policy if exists "Contributors create forum threads" on public.forum_threads;
create policy "Contributors create forum threads"
on public.forum_threads
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    (status = 'pending' and audience = 'public' and is_pinned = false)
    or (status = 'approved' and audience = 'public' and is_pinned = false and public.is_trusted())
    or public.is_admin()
  )
);

drop policy if exists "Contributors edit own threads or admin edits all" on public.forum_threads;
create policy "Contributors edit own threads or admin edits all"
on public.forum_threads
for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and audience = 'public'
    and is_pinned = false
    and (
      status = 'pending'
      or (status = 'approved' and public.is_trusted())
    )
  )
);

drop policy if exists "Users send admin messages" on public.forum_admin_messages;
create policy "Users send admin messages"
on public.forum_admin_messages
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins read admin messages" on public.forum_admin_messages;
create policy "Admins read admin messages"
on public.forum_admin_messages
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins update admin messages" on public.forum_admin_messages;
create policy "Admins update admin messages"
on public.forum_admin_messages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete admin messages" on public.forum_admin_messages;
create policy "Admins delete admin messages"
on public.forum_admin_messages
for delete
to authenticated
using (public.is_admin());
