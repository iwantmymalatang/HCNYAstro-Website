-- Run this once in Supabase SQL Editor to harden forum moderation.

create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_threads(id) on delete cascade,
  comment_id uuid references public.forum_comments(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  username text not null default 'Contributor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (thread_id is not null or comment_id is not null)
);

alter table public.forum_reports enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'hcnyastro@gmail.com', false)
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and lower(email) = 'hcnyastro@gmail.com'
        and role = 'admin'
    );
$$;

drop policy if exists "Signed in users delete comments" on public.forum_comments;
drop policy if exists "Contributors delete own comments or admin deletes all" on public.forum_comments;
create policy "Contributors delete own comments or admin deletes all"
on public.forum_comments
for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Contributors create reports" on public.forum_reports;
create policy "Contributors create reports"
on public.forum_reports
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Admins read reports" on public.forum_reports;
create policy "Admins read reports"
on public.forum_reports
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins update reports" on public.forum_reports;
create policy "Admins update reports"
on public.forum_reports
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete reports" on public.forum_reports;
create policy "Admins delete reports"
on public.forum_reports
for delete
to authenticated
using (public.is_admin());
