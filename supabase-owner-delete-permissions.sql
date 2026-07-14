-- Run this once in Supabase SQL Editor.
-- Contributors can delete only their own forum posts/comments.
-- Admin can delete all forum posts/comments.

drop policy if exists "Contributors delete own threads or admin deletes all" on public.forum_threads;
drop policy if exists "Admin deletes forum threads" on public.forum_threads;
create policy "Contributors delete own threads or admin deletes all"
on public.forum_threads
for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Contributors delete own comments or admin deletes all" on public.forum_comments;
drop policy if exists "Signed in users delete comments" on public.forum_comments;
create policy "Contributors delete own comments or admin deletes all"
on public.forum_comments
for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());
